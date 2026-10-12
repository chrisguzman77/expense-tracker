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
