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
# Fixed --host: container hostnames are random, and forget groups snapshots by host.
restic backup --host expense-tracker --tag pgdump --stdin-filename expenses.dump --stdin-from-command -- \
  pg_dump --format=custom
restic forget --tag pgdump --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune
if [ "$(date +%u)" = 7 ]; then
  log "weekly integrity check"
  restic check --read-data-subset=10%
fi
