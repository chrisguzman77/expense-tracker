# Deploying to the Proxmox VM

The VM runs the stack in `compose.yaml` from images CI publishes to GHCR on every merge to `main`.
Nothing is reachable except through Tailscale: nginx listens on `127.0.0.1:8080`, and
`tailscale serve` puts HTTPS in front of it with a certificate it issues and renews itself.

```
browser --https--> tailscale serve (VM, :443) --http--> 127.0.0.1:8080 nginx --> api --> db
```

## One-time setup

1. **Create the VM.** Ubuntu Server LTS, 2 vCPU, 2 GB RAM and 20 GB disk is plenty. Enable SSH during install.

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
     pair into `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.
   - **Encryption key:** `openssl rand -hex 32` into `RESTIC_PASSWORD`, and save the same value
     in your password manager now. Without it, no backup can ever be restored.
   - **Monitoring:** at healthchecks.io create two checks. "expense-tracker backup": period
     1 day, grace 3 hours. "expense-tracker restore drill": period 31 days, grace 1 day. Put
     their ping URLs in `HC_BACKUP_URL` and `HC_DRILL_URL`. Set `TZ` to your timezone.
     `TZ` controls when the schedule runs, and a `TZ` exported in the VM user's shell overrides
     the value in `.env` (compose interpolation precedence), so set it only in `.env`.
   - **Initialize the repository once.** `--no-deps` is used because initializing the
     repository only talks to R2 and doesn't need the database (whose volume doesn't exist yet):
     ```
     docker compose run --rm --no-deps backup restic init
     ```

7. **Create the database volume and start the stack.**
   ```
   docker volume create expense-tracker-pgdata
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
   Open `https://<vm-name>.<tailnet>.ts.net` from any device on your tailnet and register.

## Deploying a new version

Merge `dev` into `main`, wait for the CI `publish` job, then on the VM:
```
cd ~/expense-tracker
docker compose pull
docker compose up -d
```
`migrate` runs again on every `up` and applies only migrations that are new. If it exits non-zero,
compose stops with an error instead of starting the new api. Check `docker compose logs migrate`.

If `compose.yaml` itself changed on `main`, re-download it first (step 4, without overwriting `.env`).

## Rolling back

Every image is also tagged with the commit SHA it was built from. To run an older build, set it in `.env`:
```
IMAGE_TAG=<full commit sha from main>
```
then `docker compose up -d`. Caveat: this rolls back code, not the database. If the newer version
ran a migration, the older code may not match the schema. Restore from a backup in that case.

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

Use this after data loss or a bad migration. It replaces the live database's contents.

```
docker compose stop api web backup
docker compose run --rm backup bash -c \
  'restic dump --tag pgdump latest /expenses.dump | pg_restore --clean --if-exists --no-owner -d expenses'
docker compose up -d
```

Replace `latest` with a snapshot ID from `restic snapshots` to restore an older one.
On startup, `migrate` applies any migrations newer than the backup.

**If the VM is gone:** the repository in R2 already exists, so on a new VM:

1. Follow one-time setup steps 1 to 6, reusing the same `RESTIC_REPOSITORY`, R2 token and
   `RESTIC_PASSWORD` (from your password manager). **Skip `restic init`.**
2. Do **not** run steps 7 and 8: they would migrate and back up an empty database, and that
   backup would become the new `latest` snapshot.
3. Instead, create the volume and restore into it:
   ```
   docker volume create expense-tracker-pgdata
   docker compose up -d db
   # run the restore command from this section (the docker compose run ... pg_restore one)
   docker compose up -d
   ```
4. Then do step 9 (`tailscale serve`). Optionally run `docker compose run --rm backup restore-drill`
   once to confirm.

## Useful commands

```
docker compose logs -f api          # follow backend logs
docker compose exec db psql -U app -d expenses
docker compose down                 # stop; data stays in the expense-tracker-pgdata volume
```
The database lives in the external volume `expense-tracker-pgdata`, which `docker compose down -v`
does not remove. Only `docker volume rm expense-tracker-pgdata` deletes it; don't.
