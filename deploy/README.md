# Deploying to the Proxmox VM

The VM runs the stack in `compose.yaml` from images CI publishes to GHCR on every merge to `main`.
Nothing is reachable except through Tailscale: nginx listens on `127.0.0.1:8080`, and
`tailscale serve` puts HTTPS in front of it with a certificate it issues and renews itself.

```
browser --https--> tailscale serve (VM, :443) --http--> 127.0.0.1:8080 nginx --> api --> db
```

## One-time setup

1. **Create the VM.** Ubuntu Server 24.04, 2 vCPU, 1.5–2 GB RAM and a 20 GB disk is plenty.
   Put it on your home network bridge, never on an isolated lab network. From an Ubuntu
   cloud-init template on Proxmox (here template `9000`, new VM ID `500`; pick a free
   address on your network), in the Proxmox host shell:
   ```
   qm clone 9000 500 --name expense-tracker --full 1
   qm set 500 --memory 1536 --balloon 1024 --cores 2 --onboot 1
   qm resize 500 scsi0 20G
   qm set 500 --ciuser <you> --sshkeys <file with your laptop's public key>
   qm set 500 --ipconfig0 ip=<address>/24,gw=<router> --nameserver 1.1.1.1
   qm start 500
   ```
   To log in from the Proxmox shell before Tailscale is set up, also add the host's own key
   (`/root/.ssh/id_rsa.pub`) to the key file, then `qm stop 500 && qm start 500` so cloud-init
   applies it. Once logged in, install the guest agent so `qm reboot` and `qm shutdown` work:
   ```
   sudo apt-get update && sudo apt-get upgrade -y
   sudo apt-get install -y qemu-guest-agent && sudo systemctl start qemu-guest-agent
   ```

2. **Install Docker Engine and the compose plugin** using Docker's apt repository
   (https://docs.docker.com/engine/install/ubuntu/), then let your user run it:
   ```
   sudo usermod -aG docker $USER   # log out and back in afterwards
   docker compose version
   ```

3. **Join the tailnet.**
   ```
   curl -fsSL https://tailscale.com/install.sh | sh
   sudo tailscale up
   ```
   In the Tailscale admin console, under DNS, enable **MagicDNS** and **HTTPS Certificates**.
   Note the VM's name, for example `expenses.<tailnet>.ts.net`.

4. **Fetch the deploy files.** Only this directory is needed on the VM, not the whole repo.
   ```
   mkdir -p ~/expense-tracker && cd ~/expense-tracker
   base=https://raw.githubusercontent.com/chrisguzman77/expense-tracker/main/deploy
   curl -fsSLO "$base/compose.yaml"
   curl -fsSL "$base/.env.example" -o .env
   ```

5. **Fill in the app secrets.** Generate both, never reuse the CI value or your laptop's:
   ```
   sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 32)/" .env
   sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
   chmod 600 .env
   ```
   `POSTGRES_PASSWORD` only takes effect the first time the database volume is created.
   Changing it later means changing it inside Postgres too.

6. **Set up backups** (see [Backups](#backups) for why each piece exists).
   - **R2:** in the Cloudflare dashboard, create an R2 bucket (for example
     `expense-tracker-backups`), then an R2 API token with **Object Read & Write** limited to
     that bucket. Put the S3 endpoint and bucket into `RESTIC_REPOSITORY` and the token's key
     pair into `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`. The repository must start with
     `s3:` (`s3:https://<account-id>.r2.cloudflarestorage.com/<bucket>`); without it restic
     fails with "invalid backend". The `AWS_*` names are just what S3-compatible tools call
     their credentials; nothing here uses Amazon.
   - **Encryption key:** `openssl rand -hex 32` into `RESTIC_PASSWORD`, and save the same value
     in your password manager now. Without it, no backup can ever be restored.
   - **Monitoring:** at healthchecks.io create two checks. "expense-tracker backup": period
     1 day, grace 3 hours. "expense-tracker restore drill": period 31 days, grace 1 day.
     Put their ping URLs in `HC_BACKUP_URL` and `HC_DRILL_URL`. Set `TZ` to your timezone.
     `TZ` controls when the schedule runs, and a `TZ` exported in the VM user's shell
     overrides the value in `.env` (compose interpolation precedence), so set it only in
     `.env`.
   - **Create the database volume, then initialize the repository once.** Compose refuses to
     run any command while an external volume is missing, even with `--no-deps`, so the volume
     comes first. `--no-deps` keeps `db` from starting, since initializing the repository only
     talks to R2:
     ```
     docker volume create expense-tracker-pgdata
     docker compose run --rm --no-deps backup restic init
     ```

7. **Start the stack.**
   ```
   docker compose pull
   docker compose up -d
   docker compose ps -a      # migrate: Exited (0); db, api: healthy; web, backup: Up
   curl -s http://127.0.0.1:8080/api/health
   ```

8. **Take the first backup and drill now** instead of waiting for the schedule:
   ```
   docker compose run --rm backup backup-now
   docker compose run --rm backup restore-drill
   ```
   Both healthchecks.io checks should turn green.

9. **Put HTTPS in front.** This persists across reboots.
   ```
   sudo tailscale serve --bg http://127.0.0.1:8080
   tailscale serve status
   ```
   Open `https://<vm-name>.<tailnet>.ts.net` from any device on your tailnet.

   **Create your account.** Registration is closed by default. Open it just long enough to
   sign up:
   ```
   printf '\nALLOW_REGISTRATION=true\n' >> .env && docker compose up -d
   ```
   Register in the app, then close it again and confirm sign-ups are refused. The probe sends
   an empty body, so it cannot create an account either way: `403` means registration is
   closed; `422` means it is still open (check that the `ALLOW_REGISTRATION` line is gone and
   that `IMAGE_TAG` in `.env` isn't pinned to an image from before registration was closed):
   ```
   sed -i '/^ALLOW_REGISTRATION=/d' .env && docker compose up -d
   curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' \
     -d '{}' http://127.0.0.1:8080/api/auth/register
   ```

   If the probe prints `502`, the app is still restarting; wait a few seconds and run it again.

   If Tailscale asks you to enable Serve in the admin console, do so. Do **not** use
   `tailscale funnel` for this app: Funnel publishes it to the whole internet, where anyone
   could register. `tailscale serve status` should say `(tailnet only)`.

## Upgrading a VM set up before backups existed

An earlier version of this compose file kept the database in the compose-managed volume
`expense-tracker_pgdata` (underscore). This version uses the external volume
`expense-tracker-pgdata` (hyphen). Without copying the data across, the new stack starts with an
empty database, even though the old data is untouched. First check whether you need this:
```
docker volume ls | grep expense-tracker_pgdata
```
If nothing is listed, skip this section. Otherwise, from `~/expense-tracker`:

1. Stop the stack: `docker compose stop`
2. Download the new `compose.yaml`, and fetch `.env.example` under another name to see the new
   variables, without overwriting `.env`:
   ```
   base=https://raw.githubusercontent.com/chrisguzman77/expense-tracker/main/deploy
   curl -fsSLO "$base/compose.yaml"
   curl -fsSL "$base/.env.example" -o .env.new
   ```
3. Create the new volume and copy the data into it:
   ```
   docker volume create expense-tracker-pgdata
   docker run --rm -v expense-tracker_pgdata:/from -v expense-tracker-pgdata:/to alpine cp -a /from/. /to/
   ```
4. Add the backup variables to `.env` and initialize the repository: one-time setup step 6,
   including `restic init` with `--no-deps`. Skip the volume creation there, you just did it.
5. `docker compose pull && docker compose up -d`
6. Confirm your data is there in the app.
7. Run `docker compose run --rm backup backup-now` and `docker compose run --rm backup restore-drill`.
8. Only after both succeed: `docker volume rm expense-tracker_pgdata`

## Deploying a new version

Merge `dev` into `main`, wait for the CI `publish` job, then on the VM.

If the release adds a database migration, take a backup first:
```
cd ~/expense-tracker
docker compose run --rm backup backup-now
```
Then deploy:
```
cd ~/expense-tracker
docker compose pull
docker compose up -d
```

The home-screen app picks up the new version the next time it is opened (close it from the app
switcher and reopen).

`migrate` runs again on every `up` and applies only migrations that are new. If it exits non-zero,
compose stops with an error instead of starting the new api. Check `docker compose logs migrate`.

If `compose.yaml` itself changed on `main`, re-download it first (step 4, without overwriting `.env`).

## Installing on iPhone

1. Connect Tailscale on the phone.
2. In Safari, open the app's Tailscale address (`https://<vm-name>.<tailnet>.ts.net`).
3. Tap Share, then **Add to Home Screen**. The name defaults to "Expenses".
4. Open it from the home screen and log in. Home-screen apps keep their own cookies, separate
   from Safari, so this one login is needed even if Safari is already signed in.

## Rolling back

Every image is also tagged with the commit SHA it was built from. To run an older build, set it in `.env`:
```
IMAGE_TAG=<full commit sha from main>
```
then `docker compose up -d`. `IMAGE_TAG` rolls back the app (api, web, migrate); the backup
service follows `BACKUP_IMAGE_TAG` instead, so an app rollback doesn't change the backup scripts.
The restore drill checks for specific tables, though, so when a rollback also restores a backup
from before a migration that renamed or added tables, set `BACKUP_IMAGE_TAG` to the same commit
(backup images carry the same SHA tags); otherwise the next drill reports a missing table.
Caveat: this rolls back code, not the database. If the newer version ran a migration, the older
code may not match the schema. Restore from a backup in that case (see below).
Rolling `IMAGE_TAG` back to a commit from before registration was closed reopens sign-ups,
because older images ignore `ALLOW_REGISTRATION`; re-run the step 9 probe after any rollback.

## Backups

- **What runs:** the `backup` service takes a backup every night at 03:00 (`TZ`) and restores
  the latest one into a scratch database on the 1st of each month to prove it works.
- **Where it goes:** encrypted by restic before upload to Cloudflare R2. R2 only ever sees
  ciphertext. Retention keeps 7 daily, 4 weekly and 6 monthly snapshots; on Sundays restic
  also re-reads 10% of the stored data to catch corruption.
- **How you find out it broke:** healthchecks.io emails you if a run fails or if no run
  reports in on time.

```
docker compose run --rm backup backup-now      # backup right now, e.g. before a risky deploy
docker compose run --rm backup restic snapshots
docker compose logs backup
```

## Restoring from a backup

Use this after data loss or a bad migration. It replaces the live database's contents with the
backup's, and discards every change made after that backup.

Optional first step: if you might want changes made since the last backup, save a safety copy:

```
docker compose run --rm backup bash -c 'restic backup --host expense-tracker --tag pre-restore --stdin-filename expenses.dump --stdin-from-command -- pg_dump --format=custom'
```

It uses its own tag because the nightly retention only prunes `pgdump` snapshots, so this copy is
never pruned automatically and doesn't become the restore's `latest`. (Do not use `backup-now`
for this: its retention can replace today's good snapshot.) `pre-restore` snapshots stay until
removed; delete one when no longer needed with
`docker compose run --rm backup restic forget <id> --prune`.

```
docker compose stop api web backup
docker compose run --rm backup bash -c 'set -o pipefail; restic dump --tag pgdump latest /expenses.dump | pg_restore --clean --if-exists --no-owner --single-transaction -d expenses'
docker compose up -d
```

`--single-transaction` means a failed restore leaves the database unchanged.

To restore an older snapshot instead of the newest, replace `latest` with a snapshot ID from
`docker compose run --rm backup restic snapshots`.

On startup, `migrate` applies any migrations newer than the backup.

**After a bad migration:**
- Set `IMAGE_TAG` in `.env` to the commit from before the migration before running
  `docker compose up -d`, otherwise `migrate` re-applies the same migration.
- `--clean` only drops objects that exist in the backup, so tables or columns created by the newer
  migration survive the restore. For a clean slate, with the stack stopped, recreate the database
  first (`db` must be running), then restore:
  ```
  docker compose up -d db
  docker compose exec db dropdb -U app expenses
  docker compose exec db createdb -U app expenses
  ```
  Once the database is dropped, the transaction no longer protects it: a failed restore leaves it
  empty rather than unchanged, so re-run the restore to recover.

**If the VM is gone:** the repository in R2 already exists, so on a new VM:

1. Follow one-time setup steps 1 to 6, reusing the same `RESTIC_REPOSITORY`, R2 token and
   `RESTIC_PASSWORD` (from your password manager). **Skip `restic init`** (but do create the
   volume): the R2 bucket, token and both healthchecks.io checks already exist and must not be
   recreated.
2. Do **not** run steps 7 and 8: they would migrate and back up an empty database, and that
   backup would become the new `latest` snapshot.
3. Instead, restore into the volume step 6 created:
   ```
   docker compose up -d db
   docker compose run --rm backup bash -c 'set -o pipefail; restic dump --tag pgdump latest /expenses.dump | pg_restore --clean --if-exists --no-owner --single-transaction -d expenses'
   docker compose up -d
   ```
   No registration is needed; the restore brings your account back.
4. Then do only the `tailscale serve` part of step 9, and skip "Create your account", because the
   restored database already has it. Optionally run `docker compose run --rm backup restore-drill`
   once to confirm.

## Useful commands

```
docker compose logs -f api          # follow backend logs
docker compose exec db psql -U app -d expenses
docker compose down                 # stop; data stays in the expense-tracker-pgdata volume
```
The database lives in the external volume `expense-tracker-pgdata`, which `docker compose down -v`
does not remove. Only `docker volume rm expense-tracker-pgdata` deletes it; don't.
