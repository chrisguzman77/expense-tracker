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

# snapshot_count: number of pgdump snapshots in the $REPO volume.
snapshot_count() {
  REPO_OVERRIDE="$REPO" run_backup restic snapshots --tag pgdump --json \
    | grep -o '"short_id"' | wc -l | tr -d ' '
}

# latest_snapshot_id: id of the newest pgdump snapshot (restic lists oldest first).
latest_snapshot_id() {
  run_backup restic snapshots --tag pgdump --json | grep -o '"short_id":"[^"]*"' | tail -1
}

# hc_saw PATH: true if the fake healthchecks server received GET PATH.
# Reads the whole log first: piping `docker logs` into `grep -q` can die of SIGPIPE under pipefail.
hc_saw() {
  local log
  log=$(docker logs "$HC" 2>&1)
  grep -q "\"GET $1 HTTP" <<<"$log"
}

psql_db() { docker exec -e PGOPTIONS="-c client_min_messages=warning" "$DB" psql -U app -d "$1" -tAc "$2"; }

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
    python -u -c "
import http.server
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Length', '0')
        self.end_headers()
http.server.HTTPServer(('', 8000), H).serve_forever()" >/dev/null
  local hc_ready=0
  for _ in $(seq 1 30); do
    if docker exec "$HC" python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/ready')" >/dev/null 2>&1; then
      hc_ready=1
      break
    fi
    sleep 1
  done
  [ "$hc_ready" = 1 ] || fail "fake healthchecks server did not become ready"
  # The image only enables TCP after its init phase, so this waits for the real server.
  for _ in $(seq 1 60); do
    docker exec "$DB" psql -h 127.0.0.1 -U app -d expenses -c 'select 1' >/dev/null 2>&1 && break
    sleep 1
  done
  docker exec "$DB" psql -h 127.0.0.1 -U app -d expenses -c 'select 1' >/dev/null 2>&1 \
    || fail "postgres did not become ready"
  local migrate_out
  migrate_out=$(docker run --rm --network "$NET" \
    -e DATABASE_URL="postgresql+psycopg://app:$PGPASS@$DB:5432/expenses" \
    -e JWT_SECRET=e2e-only-jwt-secret-at-least-32-bytes-long \
    "$API_IMG" uv run --no-sync alembic upgrade head 2>&1) \
    || fail "alembic migration failed: $migrate_out"
  psql_db expenses "
    insert into users (email, hashed_password) values ('e2e@example.com', 'x');
    insert into categories (user_id, name) select id, 'Food' from users;
    insert into accounts (user_id, name, type) select id, 'Wallet', 'cash' from users;
    insert into transactions (user_id, account_id, category_id, amount, occurred_on, note)
      select u.id, a.id, c.id, -12.50, current_date, 'seed'
      from users u
      join accounts a on a.user_id = u.id
      join categories c on c.user_id = u.id;" >/dev/null
  for v in "$REPO" "$EMPTY_REPO" "$HOLLOW_REPO"; do
    REPO_OVERRIDE="$v" run_backup restic init >/dev/null
  done
}

test_restic_supports_stdin_from_command() {
  local help
  help=$(run_backup restic backup --help 2>&1)
  grep -q -- '--stdin-from-command' <<<"$help" \
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

test_snapshots_share_a_fixed_host() {
  local before hosts
  before=$(latest_snapshot_id)
  run_backup backup-now >/dev/null || fail "second backup-now exited non-zero"
  [ "$(latest_snapshot_id)" != "$before" ] || fail "second backup-now produced no new latest snapshot"
  hosts=$(run_backup restic snapshots --tag pgdump --json | grep -o '"hostname":"[^"]*"' | sort -u)
  [ "$hosts" = '"hostname":"expense-tracker"' ] || fail "snapshots do not share the fixed host: $hosts"
  pass "snapshots share a fixed host so retention groups them"
}

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
  local crond_up=0
  for _ in $(seq 1 15); do
    if docker exec "$SCHED" pgrep crond >/dev/null 2>&1; then
      crond_up=1
      break
    fi
    sleep 1
  done
  [ "$crond_up" = 1 ] || fail "crond is not running"
  local sched_log crontab_out
  sched_log=$(docker logs "$SCHED" 2>&1)
  grep -q 'scheduler started' <<<"$sched_log" || fail "scheduler log missing 'scheduler started'"
  crontab_out=$(docker exec "$SCHED" crontab -l)
  grep -q '^0 3 \* \* \* .*backup-now' <<<"$crontab_out" \
    || fail "nightly backup job missing"
  grep -q '^0 5 1 \* \* .*restore-drill' <<<"$crontab_out" \
    || fail "monthly drill job missing"
  # Retention keeps one snapshot per day, so a same-day run replaces the previous one:
  # compare the newest snapshot's id rather than the count.
  local before
  before=$(latest_snapshot_id)
  # cron starts jobs with an empty environment; reproduce that exactly.
  docker exec "$SCHED" env -i /usr/local/bin/backup-now >/dev/null \
    || fail "backup-now failed under cron's empty environment"
  [ "$(latest_snapshot_id)" != "$before" ] || fail "cron-style run created no snapshot"
  pass "scheduler runs crond with both jobs, and jobs work with an empty environment"
}

setup
test_restic_supports_stdin_from_command
test_backup_creates_snapshot_and_pings
test_backup_fails_loudly_when_db_unreachable
test_snapshots_share_a_fixed_host
test_restore_drill_passes_and_cleans_up
test_restore_drill_fails_without_snapshots
test_restore_drill_rejects_backup_with_empty_tables
test_timezone_is_honored
test_scheduler_runs_jobs_with_cron_environment
echo "ALL BACKUP E2E TESTS PASSED"
