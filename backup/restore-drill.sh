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

# Silence the "does not exist, skipping" notice from dropdb --if-exists; errors still show.
export PGOPTIONS="-c client_min_messages=warning"

q() { psql -X -v ON_ERROR_STOP=1 -d "$1" -tAc "$2"; }

hc_ping "${HC_DRILL_URL:-}" /start
dropdb --if-exists "$DRILL_DB"
createdb "$DRILL_DB"
log "restoring latest snapshot into $DRILL_DB"
restic dump --retry-lock 10m --tag pgdump latest /expenses.dump \
  | pg_restore --no-owner --exit-on-error -d "$DRILL_DB"

for table in users accounts categories transactions alembic_version; do
  [ "$(q "$DRILL_DB" "select to_regclass('public.$table') is not null")" = t ] \
    || { log "table missing from restore: $table"; exit 1; }
done

# Counts legitimately change between backup and drill, so only an empty restore of a
# non-empty live table is treated as a failure.
for table in users accounts categories transactions; do
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
