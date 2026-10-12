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
