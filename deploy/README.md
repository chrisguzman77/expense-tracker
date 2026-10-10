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

5. **Fill in secrets.** Generate both, never reuse the CI value or your laptop's:
   ```
   sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 32)/" .env
   sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" .env
   chmod 600 .env
   ```
   `POSTGRES_PASSWORD` only takes effect the first time the database volume is created.
   Changing it later means changing it inside Postgres too.

6. **Start the stack.**
   ```
   docker compose pull
   docker compose up -d
   docker compose ps -a      # migrate: Exited (0); db, api: healthy; web: Up
   curl -s http://127.0.0.1:8080/api/health
   ```

7. **Put HTTPS in front.** This persists across reboots.
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

## Useful commands

```
docker compose logs -f api          # follow backend logs
docker compose exec db psql -U app -d expenses
docker compose down                 # stop; data stays in the pgdata volume
```
Never run `docker compose down -v` here: `-v` deletes the database volume.
