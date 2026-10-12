# Data Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the production database undeletable by compose, back it up nightly (encrypted) to Cloudflare R2, alert on failure, and prove restores work every month.

**Architecture:** A new `backup` image (`postgres:16-alpine` + restic) runs busybox `crond` as a sidecar in `deploy/compose.yaml`. `backup-now` streams `pg_dump` into restic; `restore-drill` restores the latest snapshot into a scratch database and checks it. The Postgres volume becomes an external volume. A Docker-only end-to-end script (`backup/test/e2e.sh`) is the test suite, run locally and in a new CI job.

**Tech Stack:** bash, restic 0.18 (Alpine 3.24 package), PostgreSQL 16 client tools, busybox crond, Docker Compose, GitHub Actions, ShellCheck, healthchecks.io, Cloudflare R2 (S3 API).

**Spec:** `docs/superpowers/specs/2026-10-11-data-safety-design.md`

## Global Constraints

- Free tiers only (R2 free tier, healthchecks.io free tier).
- External volume name: `expense-tracker-pgdata`.
- Backup schedule: `0 3 * * *` backup-now; `0 5 1 * *` restore-drill; container `TZ`, default `UTC`.
- Retention: `--keep-daily 7 --keep-weekly 4 --keep-monthly 6`; Sundays `restic check --read-data-subset=10%`.
- Snapshot tag `pgdump`; stdin filename `expenses.dump` (restic stores it as `/expenses.dump`).
- Scratch database: `expenses_restore_drill`. The live `expenses` database is only ever read by the drill.
- Scripts never run `restic init`; initialization is a manual setup step.
- Healthcheck pings: `<url>/start`, `<url>` on success, `<url>/fail` on failure; skipped when the URL is empty; a failed ping never fails a run.
- Image published as `ghcr.io/chrisguzman77/expense-tracker-backup`, tags `<sha>` and `latest`.
- No secrets in images or in git. `.env` files are never committed.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PRs target `dev`.

## Background for the implementer

- **Why `--stdin-from-command`:** with `pg_dump | restic backup --stdin`, restic saves whatever bytes arrived (possibly zero) as a successful snapshot before the shell notices `pg_dump` failed. `restic backup --stdin-from-command -- pg_dump ...` makes restic run `pg_dump` itself and discard the snapshot if it exits non-zero. Requires restic >= 0.17; Alpine 3.24 ships 0.18.1 (verified 2026-10-11).
- **Why `/run/backup.env`:** busybox `crond` starts jobs with an almost empty environment, so `PGHOST`, `RESTIC_*` etc. would be missing. The entrypoint saves the container environment to `/run/backup.env` when the scheduler starts, and `lib.sh` sources it.
- **libpq env vars:** `pg_dump`, `pg_restore`, `psql`, `createdb`, `dropdb` read `PGHOST`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`. The scripts rely on these instead of flags.
- **Schema facts used for seeding:** `users(email, hashed_password)`, `categories(user_id, name)`, `expenses(user_id, category_id, amount, spent_on, note)`; `id` and `created_at` have defaults.
- **No local shellcheck on the dev Mac.** Run it with Docker: `docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:stable -x <files>`. GitHub's `ubuntu-latest` has `shellcheck` preinstalled.

## File Structure

| Path | Responsibility |
|---|---|
| `backup/Dockerfile` | Image: postgres:16-alpine + bash, curl, restic, tzdata, scripts, crontab |
| `backup/.dockerignore` | Keep `test/` out of the build context |
| `backup/lib.sh` | Shared helpers sourced by both jobs: env restore, `log`, `hc_ping` |
| `backup/backup-now.sh` | One backup run (installed as `/usr/local/bin/backup-now`) |
| `backup/restore-drill.sh` | One restore drill (installed as `/usr/local/bin/restore-drill`) |
| `backup/entrypoint.sh` | `scheduler` (default) runs crond; anything else is exec'd |
| `backup/crontab` | The two schedules |
| `backup/test/e2e.sh` | End-to-end tests; needs only Docker |
| `.github/workflows/ci.yml` | New `backup` job; `publish` also pushes the backup image |
| `deploy/compose.yaml` | External volume; `backup` service |
| `deploy/.env.example` | Document new variables |
| `deploy/README.md` | Volume, R2, healthchecks, restic init, disaster recovery |
| `README.md` | Architecture and operations section; running locally |

---

### Task 0: Sync the branch

**Files:** none changed by hand.

- [ ] **Step 1: Merge the runbook PR into dev** (it edits `deploy/README.md`, which Task 6 rewrites)

```bash
gh pr merge 17 --squash --delete-branch
git checkout dev && git pull --ff-only
```

- [ ] **Step 2: Bring dev into the feature branch**

```bash
git checkout feat/data-safety
git merge --no-edit dev
git log --oneline -3
```

Expected: the merge succeeds without conflicts (the branch only adds files under `docs/superpowers/`), and `deploy/README.md` exists.

- [ ] **Step 3: Push**

```bash
git push
```

---

### Task 1: Backup image and `backup-now`

**Files:**
- Create: `backup/test/e2e.sh`, `backup/Dockerfile`, `backup/.dockerignore`, `backup/lib.sh`, `backup/backup-now.sh`

**Interfaces:**
- Produces: image command `backup-now` (exit 0 on success, non-zero on any failure; one new snapshot tagged `pgdump` on success, none on failure). `lib.sh` functions `log MESSAGE...` and `hc_ping URL [SUFFIX]`. e2e helpers `run_backup`, `snapshot_count`, `hc_saw`, `psql_db`, `pass`, `fail`, and env overrides `PGHOST_OVERRIDE`, `PGDATABASE_OVERRIDE`, `REPO_OVERRIDE`; volumes `$REPO`, `$EMPTY_REPO`, `$HOLLOW_REPO`.

- [ ] **Step 1: Write the failing end-to-end test**

Create `backup/test/e2e.sh`:

```bash
#!/bin/bash
# End-to-end tests for the backup image. Needs only Docker; used locally and in CI.
# Run from anywhere: backup/test/e2e.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

P=et-backup-e2e
NET=$P-net
DB=$P-db
HC=$P-hc
SCHED=$P-sched
REPO=$P-repo
EMPTY_REPO=$P-empty-repo
HOLLOW_REPO=$P-hollow-repo
PGPASS=e2e-db-password
RESTIC_PW=e2e-restic-password
BACKUP_IMG=expense-tracker-backup:e2e
API_IMG=expense-tracker-api:e2e

cleanup() {
  docker rm -f "$DB" "$HC" "$SCHED" >/dev/null 2>&1 || true
  docker volume rm "$REPO" "$EMPTY_REPO" "$HOLLOW_REPO" >/dev/null 2>&1 || true
  docker network rm "$NET" >/dev/null 2>&1 || true
}
trap cleanup EXIT

pass() { echo "PASS: $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }

# run_backup CMD...: run the backup image against the test database and repository.
# Overrides: PGHOST_OVERRIDE, PGDATABASE_OVERRIDE, REPO_OVERRIDE.
run_backup() {
  docker run --rm --network "$NET" \
    -v "${REPO_OVERRIDE:-$REPO}:/repo" \
    -e RESTIC_REPOSITORY=/repo -e RESTIC_PASSWORD="$RESTIC_PW" \
    -e PGHOST="${PGHOST_OVERRIDE:-$DB}" -e PGUSER=app -e PGPASSWORD="$PGPASS" \
    -e PGDATABASE="${PGDATABASE_OVERRIDE:-expenses}" \
    -e HC_BACKUP_URL="http://$HC:8000/backup" -e HC_DRILL_URL="http://$HC:8000/drill" \
    "$BACKUP_IMG" "$@"
}

# snapshot_count [VOLUME]: number of pgdump snapshots in a repository volume.
snapshot_count() {
  REPO_OVERRIDE="${1:-$REPO}" run_backup restic snapshots --tag pgdump --json \
    | grep -o '"short_id"' | wc -l | tr -d ' '
}

# hc_saw PATH: true if the fake healthchecks server received GET PATH.
hc_saw() { docker logs "$HC" 2>&1 | grep -q "\"GET $1 HTTP"; }

psql_db() { docker exec "$DB" psql -U app -d "$1" -tAc "$2"; }

setup() {
  cleanup
  docker build -q -t "$API_IMG" backend >/dev/null
  docker build -q -t "$BACKUP_IMG" backup >/dev/null
  docker network create "$NET" >/dev/null
  for v in "$REPO" "$EMPTY_REPO" "$HOLLOW_REPO"; do docker volume create "$v" >/dev/null; done
  docker run -d --name "$DB" --network "$NET" -e POSTGRES_USER=app \
    -e POSTGRES_PASSWORD="$PGPASS" -e POSTGRES_DB=expenses postgres:16 >/dev/null
  # Stand-in for healthchecks.io: logs every request line to stderr.
  docker run -d --name "$HC" --network "$NET" python:3.12-alpine \
    python -u -m http.server 8000 >/dev/null
  # The image only enables TCP after its init phase, so this waits for the real server.
  for _ in $(seq 1 60); do
    docker exec "$DB" psql -h 127.0.0.1 -U app -d expenses -c 'select 1' >/dev/null 2>&1 && break
    sleep 1
  done
  docker run --rm --network "$NET" \
    -e DATABASE_URL="postgresql+psycopg://app:$PGPASS@$DB:5432/expenses" \
    -e JWT_SECRET=e2e-only-jwt-secret-at-least-32-bytes-long \
    "$API_IMG" uv run --no-sync alembic upgrade head >/dev/null 2>&1
  psql_db expenses "
    insert into users (email, hashed_password) values ('e2e@example.com', 'x');
    insert into categories (user_id, name) select id, 'Food' from users;
    insert into expenses (user_id, category_id, amount, spent_on, note)
      select u.id, c.id, 12.50, current_date, 'seed'
      from users u join categories c on c.user_id = u.id;" >/dev/null
  for v in "$REPO" "$EMPTY_REPO" "$HOLLOW_REPO"; do
    REPO_OVERRIDE="$v" run_backup restic init >/dev/null
  done
}

test_restic_supports_stdin_from_command() {
  run_backup restic backup --help | grep -q -- '--stdin-from-command' \
    || fail "restic in the image is too old for --stdin-from-command"
  pass "restic supports --stdin-from-command"
}

test_backup_creates_snapshot_and_pings() {
  run_backup backup-now >/dev/null || fail "backup-now exited non-zero"
  [ "$(snapshot_count)" = 1 ] || fail "expected 1 snapshot, got $(snapshot_count)"
  hc_saw /backup/start || fail "no /backup/start ping"
  hc_saw /backup || fail "no /backup success ping"
  pass "backup-now creates a snapshot and pings start and success"
}

test_backup_fails_loudly_when_db_unreachable() {
  if PGHOST_OVERRIDE=no-such-host run_backup backup-now >/dev/null 2>&1; then
    fail "backup-now succeeded against an unreachable database"
  fi
  [ "$(snapshot_count)" = 1 ] || fail "a failed dump still created a snapshot"
  hc_saw /backup/fail || fail "no /backup/fail ping"
  pass "backup-now fails, records no snapshot, and pings /fail when the db is unreachable"
}

setup
test_restic_supports_stdin_from_command
test_backup_creates_snapshot_and_pings
test_backup_fails_loudly_when_db_unreachable
echo "ALL BACKUP E2E TESTS PASSED"
```

Then:

```bash
chmod +x backup/test/e2e.sh
```

- [ ] **Step 2: Run it and watch it fail**

Run: `backup/test/e2e.sh`
Expected: exits non-zero during `setup` because `docker build ... backup` fails (no `backup/Dockerfile`; message like `unable to prepare context` or `failed to read dockerfile`).

- [ ] **Step 3: Write the image and `backup-now`**

`backup/.dockerignore`:

```
test/
```

`backup/lib.sh`:

```bash
# shellcheck shell=bash
# Shared helpers for backup-now and restore-drill. Sourced, never executed.

log() { echo "[$(date '+%Y-%m-%dT%H:%M:%S%z')] $*"; }

# hc_ping URL [SUFFIX]: best-effort healthchecks.io ping. Skipped when URL is empty;
# a failed ping is logged but never fails the caller.
hc_ping() {
  local url="$1" suffix="${2:-}"
  [ -n "$url" ] || return 0
  curl -fsS -m 10 --retry 3 --retry-connrefused -o /dev/null "${url}${suffix}" \
    || log "warning: healthcheck ping to ${url}${suffix} failed"
}
```

`backup/backup-now.sh`:

```bash
#!/bin/bash
# One backup run: pg_dump streamed into restic (encrypted, deduplicated), then
# retention, plus a partial integrity check on Sundays. Exits non-zero on any failure.
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib.sh
source /usr/local/lib/backup/lib.sh

on_exit() {
  local status=$?
  if [ "$status" -eq 0 ]; then
    log "backup ok"
    hc_ping "${HC_BACKUP_URL:-}"
  else
    log "backup FAILED (exit $status)"
    hc_ping "${HC_BACKUP_URL:-}" /fail
  fi
}
trap on_exit EXIT

hc_ping "${HC_BACKUP_URL:-}" /start
log "backing up database ${PGDATABASE} on ${PGHOST}"
# restic runs pg_dump itself and discards the snapshot if pg_dump exits non-zero.
# A plain `pg_dump | restic backup --stdin` would save a truncated dump as a success.
restic backup --tag pgdump --stdin-filename expenses.dump --stdin-from-command -- \
  pg_dump --format=custom
restic forget --tag pgdump --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
if [ "$(date +%u)" = 7 ]; then
  log "weekly integrity check"
  restic check --read-data-subset=10%
fi
```

`backup/Dockerfile`:

```dockerfile
# pg_dump/pg_restore from the same major version as the server (16).
FROM postgres:16-alpine
RUN apk add --no-cache bash curl restic tzdata
COPY lib.sh /usr/local/lib/backup/lib.sh
COPY --chmod=0755 backup-now.sh /usr/local/bin/backup-now
# This image only runs client tools; drop the Postgres server entrypoint.
ENTRYPOINT []
CMD ["backup-now"]
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `backup/test/e2e.sh`
Expected output ends with:

```
PASS: restic supports --stdin-from-command
PASS: backup-now creates a snapshot and pings start and success
PASS: backup-now fails, records no snapshot, and pings /fail when the db is unreachable
ALL BACKUP E2E TESTS PASSED
```

Also confirm cleanup: `docker ps -a --format '{{.Names}}' | grep et-backup-e2e` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add backup/
git commit -m "feat(backup): backup image with backup-now and end-to-end tests

pg_dump runs under restic --stdin-from-command so a failed dump never
becomes a snapshot. Healthcheck pings for start/success/fail.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `restore-drill`

**Files:**
- Create: `backup/restore-drill.sh`
- Modify: `backup/Dockerfile`, `backup/test/e2e.sh`

**Interfaces:**
- Consumes: `lib.sh` (`log`, `hc_ping`); e2e helpers from Task 1.
- Produces: image command `restore-drill` (exit 0 when the latest snapshot restores and passes checks; non-zero otherwise; prints `<table> restored empty although the live table has rows` for the empty-table case). Always drops `expenses_restore_drill` on exit.

- [ ] **Step 1: Add the failing tests**

In `backup/test/e2e.sh`, add these functions directly above the line `setup` near the bottom:

```bash
test_restore_drill_passes_and_cleans_up() {
  run_backup restore-drill >/dev/null || fail "restore-drill exited non-zero"
  [ "$(psql_db postgres "select count(*) from pg_database where datname = 'expenses_restore_drill'")" = 0 ] \
    || fail "scratch database was not dropped"
  hc_saw /drill/start || fail "no /drill/start ping"
  hc_saw /drill || fail "no /drill success ping"
  pass "restore-drill restores the latest snapshot, checks it, and drops the scratch db"
}

test_restore_drill_fails_without_snapshots() {
  if REPO_OVERRIDE="$EMPTY_REPO" run_backup restore-drill >/dev/null 2>&1; then
    fail "restore-drill succeeded with no snapshots"
  fi
  hc_saw /drill/fail || fail "no /drill/fail ping"
  pass "restore-drill fails and pings /fail when there is nothing to restore"
}

test_restore_drill_rejects_backup_with_empty_tables() {
  psql_db postgres "drop database if exists hollow" >/dev/null
  psql_db postgres "create database hollow" >/dev/null
  docker exec "$DB" sh -c 'pg_dump -U app --schema-only expenses | psql -q -U app -d hollow' >/dev/null
  PGDATABASE_OVERRIDE=hollow REPO_OVERRIDE="$HOLLOW_REPO" run_backup backup-now >/dev/null \
    || fail "could not back up the hollow database"
  local out
  if out=$(REPO_OVERRIDE="$HOLLOW_REPO" run_backup restore-drill 2>&1); then
    fail "restore-drill accepted a backup whose tables are empty"
  fi
  grep -q "restored empty" <<<"$out" || fail "drill failed for the wrong reason: $out"
  pass "restore-drill rejects a backup whose tables came back empty"
}
```

And replace the bottom block with:

```bash
setup
test_restic_supports_stdin_from_command
test_backup_creates_snapshot_and_pings
test_backup_fails_loudly_when_db_unreachable
test_restore_drill_passes_and_cleans_up
test_restore_drill_fails_without_snapshots
test_restore_drill_rejects_backup_with_empty_tables
echo "ALL BACKUP E2E TESTS PASSED"
```

- [ ] **Step 2: Run and watch the new test fail**

Run: `backup/test/e2e.sh`
Expected: the three Task 1 tests pass, then `FAIL: restore-drill exited non-zero` (the command does not exist in the image yet).

- [ ] **Step 3: Write `restore-drill`**

`backup/restore-drill.sh`:

```bash
#!/bin/bash
# Restore drill: restore the latest snapshot into a scratch database and sanity-check it.
# Only reads the live database. Exits non-zero if the backup can't be restored or looks wrong.
set -euo pipefail
# shellcheck source-path=SCRIPTDIR source=lib.sh
source /usr/local/lib/backup/lib.sh

DRILL_DB=expenses_restore_drill
LIVE_DB="$PGDATABASE"

on_exit() {
  local status=$?
  dropdb --if-exists "$DRILL_DB" >/dev/null 2>&1 || true
  if [ "$status" -eq 0 ]; then
    log "restore drill ok"
    hc_ping "${HC_DRILL_URL:-}"
  else
    log "restore drill FAILED (exit $status)"
    hc_ping "${HC_DRILL_URL:-}" /fail
  fi
}
trap on_exit EXIT

q() { psql -X -v ON_ERROR_STOP=1 -d "$1" -tAc "$2"; }

hc_ping "${HC_DRILL_URL:-}" /start
dropdb --if-exists "$DRILL_DB"
createdb "$DRILL_DB"
log "restoring latest snapshot into $DRILL_DB"
restic dump --tag pgdump latest /expenses.dump \
  | pg_restore --no-owner --exit-on-error -d "$DRILL_DB"

for table in users categories expenses alembic_version; do
  [ "$(q "$DRILL_DB" "select to_regclass('public.$table') is not null")" = t ] \
    || { log "table missing from restore: $table"; exit 1; }
done

# Counts legitimately change between backup and drill, so only an empty restore of a
# non-empty live table is treated as a failure.
for table in users categories expenses; do
  live=$(q "$LIVE_DB" "select count(*) from $table")
  restored=$(q "$DRILL_DB" "select count(*) from $table")
  log "$table: live=$live restored=$restored"
  if [ "$live" -gt 0 ] && [ "$restored" -eq 0 ]; then
    log "$table restored empty although the live table has rows"
    exit 1
  fi
done

live_version=$(q "$LIVE_DB" "select version_num from alembic_version")
restored_version=$(q "$DRILL_DB" "select version_num from alembic_version")
if [ "$live_version" != "$restored_version" ]; then
  log "migration version differs: live=$live_version restored=$restored_version"
  exit 1
fi
```

In `backup/Dockerfile`, add after the `backup-now` COPY line:

```dockerfile
COPY --chmod=0755 restore-drill.sh /usr/local/bin/restore-drill
```

- [ ] **Step 4: Run and watch all tests pass**

Run: `backup/test/e2e.sh`
Expected: six `PASS:` lines, then `ALL BACKUP E2E TESTS PASSED`.

- [ ] **Step 5: Commit**

```bash
git add backup/
git commit -m "feat(backup): monthly restore drill into a scratch database

Checks tables exist, non-empty live tables don't restore empty, and the
migration version matches. Tested against a good backup, an empty
repository, and a backup with empty tables.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Scheduler

**Files:**
- Create: `backup/entrypoint.sh`, `backup/crontab`
- Modify: `backup/Dockerfile`, `backup/lib.sh`, `backup/test/e2e.sh`

**Interfaces:**
- Consumes: `backup-now`, `restore-drill`.
- Produces: default container command `scheduler` (runs crond in the foreground); any other command is exec'd unchanged (`docker compose run --rm backup <cmd>`). `/run/backup.env` written at scheduler start, mode 600.

- [ ] **Step 1: Add the failing tests**

In `backup/test/e2e.sh`, add above the `setup` line:

```bash
test_timezone_is_honored() {
  local tz
  tz=$(docker run --rm -e TZ=America/Chicago "$BACKUP_IMG" date +%Z)
  case "$tz" in CST|CDT) ;; *) fail "TZ not honored, got $tz" ;; esac
  pass "TZ is honored"
}

test_scheduler_runs_jobs_with_cron_environment() {
  docker run -d --name "$SCHED" --network "$NET" -v "$REPO:/repo" \
    -e RESTIC_REPOSITORY=/repo -e RESTIC_PASSWORD="$RESTIC_PW" \
    -e PGHOST="$DB" -e PGUSER=app -e PGPASSWORD="$PGPASS" -e PGDATABASE=expenses \
    "$BACKUP_IMG" >/dev/null
  sleep 2
  docker exec "$SCHED" pgrep crond >/dev/null || fail "crond is not running"
  docker exec "$SCHED" crontab -l | grep -q '^0 3 \* \* \* .*backup-now' \
    || fail "nightly backup job missing"
  docker exec "$SCHED" crontab -l | grep -q '^0 5 1 \* \* .*restore-drill' \
    || fail "monthly drill job missing"
  local before
  before=$(snapshot_count)
  # cron starts jobs with an empty environment; reproduce that exactly.
  docker exec "$SCHED" env -i /usr/local/bin/backup-now >/dev/null \
    || fail "backup-now failed under cron's empty environment"
  [ "$(snapshot_count)" = $((before + 1)) ] || fail "cron-style run created no snapshot"
  pass "scheduler runs crond with both jobs, and jobs work with an empty environment"
}
```

Replace the bottom block with:

```bash
setup
test_restic_supports_stdin_from_command
test_backup_creates_snapshot_and_pings
test_backup_fails_loudly_when_db_unreachable
test_restore_drill_passes_and_cleans_up
test_restore_drill_fails_without_snapshots
test_restore_drill_rejects_backup_with_empty_tables
test_timezone_is_honored
test_scheduler_runs_jobs_with_cron_environment
echo "ALL BACKUP E2E TESTS PASSED"
```

- [ ] **Step 2: Run and watch it fail**

Run: `backup/test/e2e.sh`
Expected: seven `PASS:` lines (TZ already works because `tzdata` is installed), then `FAIL: crond is not running` (the default command is still `backup-now`).

- [ ] **Step 3: Implement the scheduler**

`backup/crontab`:

```
# min hour dom mon dow  command   (times use the container's TZ)
0 3 * * * /usr/local/bin/backup-now > /proc/1/fd/1 2>&1
0 5 1 * * /usr/local/bin/restore-drill > /proc/1/fd/1 2>&1
```

`backup/entrypoint.sh`:

```bash
#!/bin/bash
# Default command `scheduler` runs cron in the foreground. Anything else runs as given,
# e.g. `docker compose run --rm backup backup-now` or `... restic snapshots`.
set -euo pipefail

if [ "${1:-scheduler}" = scheduler ]; then
  # busybox crond starts jobs with an almost empty environment. Save this container's
  # environment (database and R2 settings) so lib.sh can restore it inside each job.
  (umask 077 && export -p > /run/backup.env)
  echo "scheduler started (TZ=${TZ:-UTC}); jobs:"
  crontab -l
  exec crond -f -d 8
fi
exec "$@"
```

In `backup/lib.sh`, add directly below the two header comment lines:

```bash

# Under cron the job starts with an almost empty environment; the entrypoint saved the
# container's environment here when the scheduler started.
if [ -f /run/backup.env ]; then
  # shellcheck disable=SC1091
  source /run/backup.env
fi
```

Replace `backup/Dockerfile` with:

```dockerfile
# pg_dump/pg_restore from the same major version as the server (16).
FROM postgres:16-alpine
RUN apk add --no-cache bash curl restic tzdata
COPY lib.sh /usr/local/lib/backup/lib.sh
COPY --chmod=0755 backup-now.sh /usr/local/bin/backup-now
COPY --chmod=0755 restore-drill.sh /usr/local/bin/restore-drill
COPY --chmod=0755 entrypoint.sh /usr/local/bin/entrypoint
COPY crontab /etc/crontabs/root
ENTRYPOINT ["/usr/local/bin/entrypoint"]
CMD ["scheduler"]
```

- [ ] **Step 4: Run and watch all tests pass**

Run: `backup/test/e2e.sh`
Expected: eight `PASS:` lines, then `ALL BACKUP E2E TESTS PASSED`.

- [ ] **Step 5: ShellCheck**

Run:

```bash
docker run --rm -v "$PWD:/mnt" -w /mnt koalaman/shellcheck:stable -x backup/*.sh backup/test/*.sh
```

Expected: no output, exit 0. Fix any finding in the script rather than disabling the check, unless the finding is a false positive; then disable that single code on that line with a comment saying why.

- [ ] **Step 6: Commit**

```bash
git add backup/
git commit -m "feat(backup): cron scheduler with environment hand-off to jobs

Default command runs busybox crond with the nightly backup and monthly
drill. The entrypoint saves the container env to /run/backup.env because
cron jobs start with an empty environment.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: CI job and publishing

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `backup/test/e2e.sh`, `backup/Dockerfile`.
- Produces: required-check name `backup`; GHCR image `ghcr.io/chrisguzman77/expense-tracker-backup:{<sha>,latest}` on push to main.

- [ ] **Step 1: Add the `backup` job**

In `.github/workflows/ci.yml`, insert this job between the `docker` job and the `publish` job:

```yaml
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: ShellCheck
        run: shellcheck -x backup/*.sh backup/test/*.sh
      - name: Backup image end-to-end tests
        run: backup/test/e2e.sh
```

- [ ] **Step 2: Make `publish` wait for it and push the backup image**

In the `publish` job, change:

```yaml
    needs: [backend, frontend, docker]
```

to:

```yaml
    needs: [backend, frontend, docker, backup]
```

and change:

```bash
          for pair in api:backend web:frontend; do
```

to:

```bash
          for pair in api:backend web:frontend backup:backup; do
```

- [ ] **Step 3: Verify the workflow parses**

Run:

```bash
python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml')); print(list(d['jobs'])); print(d['jobs']['publish']['needs'])"
```

Expected:

```
['backend', 'frontend', 'docker', 'backup', 'publish']
['backend', 'frontend', 'docker', 'backup']
```

- [ ] **Step 4: Commit, push, open the PR, watch CI**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: backup job (ShellCheck + end-to-end) and publish the backup image

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

```bash
gh pr create --base dev --head feat/data-safety \
  --title "feat: data safety: protected storage, encrypted backups, restore drills" \
  --body "Implements docs/superpowers/specs/2026-10-11-data-safety-design.md (plan: docs/superpowers/plans/2026-10-11-data-safety.md).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
gh pr checks feat/data-safety --watch --interval 15
```

Expected: `backend`, `frontend`, `docker`, `backup` pass; `publish` skipped.

- [ ] **Step 5: Require the new check on main and dev** (only after Step 4 is green)

```bash
for B in main dev; do
  gh api -X PUT repos/chrisguzman77/expense-tracker/branches/$B/protection/required_status_checks \
    -F strict=false -f 'contexts[]=backend' -f 'contexts[]=frontend' -f 'contexts[]=docker' -f 'contexts[]=backup' \
    --jq '.contexts'
done
```

Expected for each branch: `["backend","frontend","docker","backup"]`.

---

### Task 5: Production compose

**Files:**
- Modify: `deploy/compose.yaml`, `deploy/.env.example`

**Interfaces:**
- Consumes: backup image (`scheduler` default, `backup-now`, `restore-drill`, `restic`).
- Produces: compose service `backup`; external volume `expense-tracker-pgdata`; env vars `RESTIC_REPOSITORY`, `RESTIC_PASSWORD`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `HC_BACKUP_URL`, `HC_DRILL_URL`, `TZ`.

- [ ] **Step 1: Make the volume external**

In `deploy/compose.yaml`, replace:

```yaml
volumes:
  pgdata:
```

with:

```yaml
volumes:
  # Created once by hand: `docker volume create expense-tracker-pgdata` (see README).
  # Compose never removes external volumes, so `docker compose down -v` can't delete the
  # database, and `up` refuses to start if the volume is missing instead of creating an
  # empty one.
  pgdata:
    external: true
    name: expense-tracker-pgdata
```

- [ ] **Step 2: Add the backup service**

In `deploy/compose.yaml`, add this service after `web` (before the top-level `volumes:` key):

```yaml
  # Nightly encrypted backups to Cloudflare R2 and a monthly restore drill (see README).
  backup:
    image: ghcr.io/chrisguzman77/expense-tracker-backup:${IMAGE_TAG:-latest}
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    environment:
      TZ: ${TZ:-UTC}
      PGHOST: db
      PGUSER: app
      PGDATABASE: expenses
      PGPASSWORD: ${POSTGRES_PASSWORD:?set POSTGRES_PASSWORD in .env}
      RESTIC_REPOSITORY: ${RESTIC_REPOSITORY:?set RESTIC_REPOSITORY in .env}
      RESTIC_PASSWORD: ${RESTIC_PASSWORD:?set RESTIC_PASSWORD in .env}
      AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:?set AWS_ACCESS_KEY_ID in .env}
      AWS_SECRET_ACCESS_KEY: ${AWS_SECRET_ACCESS_KEY:?set AWS_SECRET_ACCESS_KEY in .env}
      # R2 uses the region name "auto".
      AWS_DEFAULT_REGION: auto
      HC_BACKUP_URL: ${HC_BACKUP_URL:?set HC_BACKUP_URL in .env}
      HC_DRILL_URL: ${HC_DRILL_URL:?set HC_DRILL_URL in .env}
```

- [ ] **Step 3: Document the variables**

Append to `deploy/.env.example`:

```
# --- Backups (see README "Backups") ---
# Cloudflare R2 bucket, as a restic S3 repository:
#   s3:https://<account-id>.r2.cloudflarestorage.com/<bucket-name>
RESTIC_REPOSITORY=
# R2 API token scoped to that one bucket (Object Read & Write).
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
# Encryption key for every backup: openssl rand -hex 32
# Store it in your password manager too. Without it no backup can ever be restored.
RESTIC_PASSWORD=
# healthchecks.io ping URLs: one check for nightly backups, one for monthly drills.
HC_BACKUP_URL=
HC_DRILL_URL=
# Timezone for the backup schedule, e.g. America/Chicago
TZ=UTC
```

- [ ] **Step 4: Verify config and the missing-volume failure**

From `deploy/`, with throwaway values (nothing here touches R2):

```bash
cd deploy
export IMAGE_TAG=local POSTGRES_PASSWORD=$(openssl rand -hex 16) JWT_SECRET=$(openssl rand -hex 32) \
  RESTIC_REPOSITORY=/repo RESTIC_PASSWORD=local-test AWS_ACCESS_KEY_ID=x AWS_SECRET_ACCESS_KEY=x \
  HC_BACKUP_URL=http://127.0.0.1:9/hc HC_DRILL_URL=http://127.0.0.1:9/hc
docker compose -p expense-prod config --quiet && echo "config ok"
docker volume inspect expense-tracker-pgdata >/dev/null 2>&1 && echo "STOP: volume already exists, do not continue"
docker compose -p expense-prod up -d db 2>&1 | tail -1
```

Expected: `config ok`; no STOP line; the last command fails with an error containing `external volume "expense-tracker-pgdata" not found`.

- [ ] **Step 5: Verify `down -v` keeps the data**

```bash
docker build -q -t ghcr.io/chrisguzman77/expense-tracker-api:local ../backend
docker build -q -t ghcr.io/chrisguzman77/expense-tracker-web:local ../frontend
docker build -q -t ghcr.io/chrisguzman77/expense-tracker-backup:local ../backup
docker volume create expense-tracker-pgdata
docker compose -p expense-prod up -d api web
docker compose -p expense-prod exec -T db psql -U app -d expenses -c "insert into users (email, hashed_password) values ('survivor@example.com', 'x')"
docker compose -p expense-prod down -v
docker volume inspect expense-tracker-pgdata --format 'volume still exists: {{.Name}}'
docker compose -p expense-prod up -d api web
docker compose -p expense-prod exec -T db psql -U app -d expenses -tAc "select email from users"
```

Expected: `volume still exists: expense-tracker-pgdata` and `survivor@example.com`.

- [ ] **Step 6: Verify the backup service end to end (local repository instead of R2)**

```bash
docker volume create expense-prod-test-repo
docker compose -p expense-prod run --rm -v expense-prod-test-repo:/repo backup \
  bash -c 'restic init && backup-now && restore-drill && restic snapshots'
```

Expected: `backup ok`, `restore drill ok`, one snapshot listed; warnings about the unreachable healthcheck URL are expected and must not fail the run.

- [ ] **Step 7: Clean up the local test stack**

```bash
docker compose -p expense-prod down
docker volume rm expense-tracker-pgdata expense-prod-test-repo
docker image rm ghcr.io/chrisguzman77/expense-tracker-{api,web,backup}:local
cd ..
```

Expected: no `expense-prod` containers and neither volume remains (`docker volume ls | grep -E 'expense-tracker-pgdata|expense-prod'` prints nothing).

- [ ] **Step 8: Commit**

```bash
git add deploy/compose.yaml deploy/.env.example
git commit -m "feat(deploy): external database volume and backup service

down -v can no longer delete the database; a missing volume fails loudly.
Backup sidecar runs nightly backups to R2 and monthly restore drills.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
```

---

### Task 6: Documentation

**Files:**
- Modify: `deploy/README.md`, `README.md`

- [ ] **Step 1: Update the runbook's one-time setup**

In `deploy/README.md`, replace steps 5 and 6 of "One-time setup" (from `5. **Fill in secrets.**` through the end of step 6's code block) with:

````markdown
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
   - **Initialize the repository once:**
     ```
     docker compose run --rm backup restic init
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
````

Renumber the old step 7 (`Put HTTPS in front`) to 9.

- [ ] **Step 2: Add backup and recovery sections to the runbook**

In `deploy/README.md`, add before `## Useful commands`:

````markdown
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

**If the VM is gone:** build a new one with the one-time setup above, reusing the same
`RESTIC_REPOSITORY`, R2 token and `RESTIC_PASSWORD` (from your password manager) and skipping
`restic init`. Create the volume, start only the database with `docker compose up -d db`, run
the restore command above, then `docker compose up -d`.
````

- [ ] **Step 3: Correct the `down -v` warning**

In `deploy/README.md`, replace:

```
Never run `docker compose down -v` here: `-v` deletes the database volume.
```

with:

```
The database lives in the external volume `expense-tracker-pgdata`, which `docker compose down -v`
does not remove. Only `docker volume rm expense-tracker-pgdata` deletes it; don't.
```

- [ ] **Step 4: Rewrite the root README**

Replace `README.md` with:

````markdown
# Expense Tracker

A self-hosted personal finance app: track spending by category and see monthly summaries.
Built as an end-to-end practice project covering scoping, architecture, tests, CI and deployment.

**Roadmap:** accounts and transactions with CSV import, bank sync, budgets, and detection of
forgotten subscriptions.

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, Postgres 16
- **Frontend:** React, TypeScript, Vite, TanStack Query, React Router, React Hook Form + Zod, Tailwind
- **Ops:** Docker Compose, GitHub Actions, GHCR, Tailscale, restic + Cloudflare R2

## Architecture and operations

```
browser --https--> tailscale serve --> nginx --> FastAPI --> Postgres
                                        (static React build, /api proxy)
```

- **Private by default.** The app is reachable only from devices on my Tailscale network.
  nginx listens on the server's loopback interface and `tailscale serve` terminates HTTPS with
  an automatically renewed certificate. Postgres and the API publish no ports at all.
- **Same-origin auth.** The JWT lives in an httpOnly, SameSite=Lax, Secure cookie, so no token
  is ever readable by JavaScript and CSRF is covered by SameSite plus same-origin requests.
- **Types can't drift.** Frontend API types are generated from the backend's OpenAPI schema,
  and CI fails if the committed types don't match.
- **Migrations are checked.** CI runs `alembic check`, which fails if the models and the
  migrations disagree.
- **The database can't be deleted by deploy tooling.** It lives in an external Docker volume
  that `docker compose down -v` does not remove; if the volume is missing, startup fails
  instead of silently creating an empty database.
- **Backups are encrypted, offsite and verified.** A backup service streams `pg_dump` into
  restic every night. restic encrypts it before upload to Cloudflare R2 and refuses to record
  a snapshot if the dump fails. Every month the service restores the latest backup into a
  scratch database and checks it, because a backup is only proven by a restore.
  healthchecks.io alerts on any missed or failed run. CI runs the same backup and restore end
  to end on every pull request.
- **Deploys are reproducible.** Merging to `main` publishes images tagged with the commit SHA;
  a rollback is changing one variable. Branch protection requires every CI check to pass.

## Running locally

Requires Docker, [uv](https://docs.astral.sh/uv/) and Node 24.

```
docker compose up -d db                                   # Postgres on localhost:5434
cd backend && cp .env.example .env                        # then set JWT_SECRET (openssl rand -hex 32)
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8010
cd ../frontend && npm ci && npm run dev                   # http://localhost:5173
```

Tests: `uv run pytest` in `backend/`, `npx vitest run` in `frontend/`, `backup/test/e2e.sh`
for the backup image.

## Deploying

See [deploy/README.md](deploy/README.md).
````

- [ ] **Step 5: Verify the docs against reality**

```bash
grep -n "expense-tracker-pgdata" README.md deploy/README.md deploy/compose.yaml
grep -nE "^[0-9]+\. \*\*" deploy/README.md
grep -n "Never run" deploy/README.md || echo "old down -v warning removed"
```

Expected: the volume name appears in all three files; setup steps are numbered 1 to 9 with no gaps; `old down -v warning removed`.

Also confirm the local-run commands still match `backend/.env.example` (it must contain `DATABASE_URL` pointing at port 5434 and a `JWT_SECRET` line) and the frontend `dev` script.

- [ ] **Step 6: Commit and push**

```bash
git add README.md deploy/README.md
git commit -m "docs: architecture and operations, backup setup and restore runbook

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git push
gh pr checks feat/data-safety --watch --interval 15
```

Expected: all five checks pass (`backend`, `frontend`, `docker`, `backup`; `publish` skipped).

---

## After the plan

Squash-merge the PR into `dev`. Landing `dev` into `main` (merge commit) publishes the backup
image. Then the VM setup in `deploy/README.md` can be followed for real.
