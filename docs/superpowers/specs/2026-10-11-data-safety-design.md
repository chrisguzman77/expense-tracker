# Data safety: protected storage, encrypted offsite backups, restore drills

Date: 2026-10-11
Status: approved design, pending implementation plan

## Context

The app is growing from a manual expense log into a personal finance app with bank sync,
budgets and subscription detection. That roadmap is split into five pieces, built in order:

1. **Data safety** (this spec)
2. Accounts and transactions (data model + CSV import)
3. Bank sync through an aggregator
4. Budgets
5. Subscription detection

Data safety comes first because real financial data must not be stored until the database
is protected and backed up. Today `deploy/compose.yaml` keeps Postgres in a compose-managed
named volume, so `docker compose down -v` deletes it, and there are no backups.

Constraints: free tiers only; the app stays reachable only over Tailscale; everything lives in
the repo (no hand-configured host cron).

## Goals

- The production database cannot be deleted by any `docker compose` command.
- Nightly encrypted backups are stored off the VM, in Cloudflare R2.
- A failed or missing backup produces an alert within about a day.
- Restores are proven to work automatically every month.
- A fresh VM can be rebuilt from the runbook plus two secrets kept in a password manager.

## Non-goals

- Point-in-time recovery (WAL archiving). Worst-case data loss is one day; a manual backup can
  be taken before risky changes.
- A dedicated read-only database role for backups. The backup service uses the `app` role.
- Backing up anything other than the Postgres database. Images are rebuildable from git.

## Design

### 1. Components and secrets

**Protected storage.** In `deploy/compose.yaml` the `pgdata` volume becomes external:

```yaml
volumes:
  pgdata:
    external: true
    name: expense-tracker-pgdata
```

It is created once with `docker volume create expense-tracker-pgdata`. Compose never deletes
external volumes, and `up` fails with "external volume not found" if it is missing, instead of
silently starting an empty database.

**Backup image.** New directory `backup/` with a Dockerfile based on `postgres:16-alpine`
(so `pg_dump`/`pg_restore` always match the server's major version) plus `restic`, `curl`,
`tzdata` (so `TZ` works on Alpine) and the scripts below. CI publishes it as `ghcr.io/chrisguzman77/expense-tracker-backup`
with the same `<sha>` and `latest` tags as the other images.

**Backup service.** New `backup` service in `deploy/compose.yaml`, `restart: unless-stopped`,
`depends_on: db (service_healthy)`, no published ports, image tag from `IMAGE_TAG`.

**Secrets** added to `deploy/.env` and documented in `deploy/.env.example`:

| Variable | Purpose |
|---|---|
| `RESTIC_REPOSITORY` | `s3:https://<account-id>.r2.cloudflarestorage.com/<bucket>` |
| `RESTIC_PASSWORD` | Repository encryption key. Must also be stored in a password manager. |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | R2 API token scoped to the one backup bucket |
| `HC_BACKUP_URL` | healthchecks.io ping URL for the nightly backup |
| `HC_DRILL_URL` | healthchecks.io ping URL for the monthly restore drill |
| `TZ` | Timezone for the schedule, default `UTC` |

The backup service reads `POSTGRES_PASSWORD` already present in `.env`.

**Repository initialization is manual**, once, during setup:
`docker compose run --rm backup restic init`. Scripts never auto-initialize, so a wrong
`RESTIC_REPOSITORY` fails loudly instead of creating a new empty repository elsewhere.

### 2. Schedule, retention, monitoring

The container runs busybox `crond` in the foreground with this schedule (container `TZ`):

- `0 3 * * *` run `backup-now`
- `0 5 1 * *` run `restore-drill`

**`backup-now`** (POSIX sh, `set -eu -o pipefail`):

1. Ping `$HC_BACKUP_URL/start`.
2. `pg_dump --format=custom` piped into
   `restic backup --stdin --stdin-filename expenses.dump --tag pgdump`. `pipefail` makes a
   failed `pg_dump` fail the run, so an empty dump can never be recorded as a success. No
   unencrypted dump is written to disk.
3. `restic forget --tag pgdump --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune`.
4. On Sundays, `restic check --read-data-subset=10%`.
5. Ping `$HC_BACKUP_URL` on success, or `$HC_BACKUP_URL/fail` on any error (via a trap),
   and exit non-zero on failure.

Pings are skipped when the URL variable is empty (used in CI). Output goes to the container
log (`docker compose logs backup`). The same command runs on demand:
`docker compose run --rm backup backup-now`.

The healthchecks.io check for backups uses a 1-day period with a few hours of grace, so a
dead container or powered-off VM also alerts.

### 3. Restore drill and disaster recovery

**`restore-drill`** (also `set -eu -o pipefail`, pings `$HC_DRILL_URL` start/success/fail):

1. Drop then create `expenses_restore_drill` on the same server.
2. `restic dump --tag pgdump latest /expenses.dump | pg_restore --no-owner -d expenses_restore_drill`.
3. Fail if any of `users`, `categories`, `expenses`, `alembic_version` is missing from the
   restored database.
4. For `users`, `categories`, `expenses`: fail if the live table has rows but the restored one
   has none. Counts are not compared otherwise, because rows legitimately change between the
   backup and the drill (added or deleted), and an exact comparison would raise false alarms.
5. Fail if `alembic_version` differs between restored and live databases.
6. Drop `expenses_restore_drill` (also on failure, via the trap).

The live `expenses` database is only read.

**Disaster recovery** is a documented manual procedure in `deploy/README.md`, not a script:

1. `docker compose stop api web backup`
2. `docker compose run --rm backup sh -c 'restic dump --tag pgdump <snapshot|latest> /expenses.dump | pg_restore --clean --if-exists --no-owner -d expenses'`
3. `docker compose up -d` (migrate applies anything newer than the backup)

For a lost VM: rebuild from the runbook, create the volume, start `db` only, restore as above,
then start everything. Needs only the R2 credentials and `RESTIC_PASSWORD`.

### 4. Testing and documentation

**CI job `backup`** in `.github/workflows/ci.yml`:

1. Postgres 16 service; `alembic upgrade head`; seed rows into users, categories, expenses.
2. Build the backup image. Use a local filesystem restic repository mounted into the container
   (`RESTIC_REPOSITORY=/repo`), initialized in the job. No R2 credentials in CI.
3. Run `backup-now` then `restore-drill`; both must exit 0.
4. Negative test: `backup-now` with an unreachable database host must exit non-zero, and
   `restic snapshots` must show no new snapshot.
5. ShellCheck on `backup/*.sh`.

After the job is green, add `backup` to the required status checks on `main` and `dev`.
The `publish` job also pushes the backup image.

**Docs:**

- Root `README.md`: new "Architecture and operations" section with the request-path diagram,
  Tailscale-only access, and the data protection story (external volume, encrypted offsite
  backups, monitoring, monthly restore drills), each with a one-line reason.
- `deploy/README.md`: create the external volume; create the R2 bucket and scoped token;
  create the two healthchecks.io checks; store `RESTIC_PASSWORD` in a password manager;
  `restic init`; disaster recovery procedure.

## Risks and prerequisites

- **Lost `RESTIC_PASSWORD` makes every backup unreadable.** Mitigated by the runbook step to
  store it in a password manager before the first backup.
- **R2 requires a payment method on file** even within the free tier.
- **Local disk:** the developer Mac's data volume is ~99% full and Docker's storage went
  read-only. About 5 GB must be freed before building images locally; CI verifies regardless.
- **PR #17** (deploy runbook) touches `deploy/README.md` and should be merged before this work.
