# 12. Encrypted offsite backups with restic, verified by restore drills

- **Date:** 2026-10-11 (PR #18)
- **Status:** Accepted

## Context

The roadmap adds real bank data (record 13). Before any of it is stored, the database needs
backups that live off the server, can't be read by the storage provider, alert when they stop,
and are proven restorable. Free tiers only.

## Decision

- A `backup` service (image based on `postgres:16-alpine` so `pg_dump` matches the server,
  plus restic) runs busybox cron inside the production stack.
- Nightly at 03:00, `backup-now` runs `restic backup --stdin-from-command -- pg_dump`.
  restic encrypts and deduplicates the dump and uploads it to a **Cloudflare R2** bucket, using
  an API token scoped to that bucket. No unencrypted dump touches disk.
- Retention keeps 7 daily, 4 weekly and 6 monthly snapshots. On Sundays restic re-reads 10% of
  stored data to detect corruption.
- On the 1st of each month, `restore-drill` restores the latest snapshot into a scratch
  database, checks tables, non-empty data and the migration version, then drops it.
- Both jobs ping **healthchecks.io**; a failed or missing run sends an email.
- The restic encryption key is kept in a password manager as well as on the VM.
- CI runs the same backup and restore end to end against a local restic repository.

## Alternatives considered

- **pg_dump, age and rclone wired together.** Each step visible, but hand-rolls retention and
  has no integrity check.
- **A cron job on the VM host.** Simplest, but lives outside the repository and is lost on a
  VM rebuild.
- **Destinations:** a home NAS (no protection against fire or theft), local plus cloud (the
  3-2-1 rule, most setup), my laptop (only reachable when it's on). **Providers:** Backblaze B2
  and Amazon S3; R2 chosen for its free tier and free downloads.
- **Point-in-time recovery** (WAL archiving). Not worth the complexity yet.

## Consequences

- Worst-case data loss is about one day; a manual `backup-now` can be run before risky changes.
- Losing the restic password makes every backup unreadable.
- The R2 token (read and write) and the restic password both live on the VM, because pruning
  old snapshots needs delete permission. A compromised VM could therefore delete the offsite
  backups. Accepted for a private, Tailscale-only personal app; a second copy elsewhere, or
  pruning from another machine with a locked bucket, would close the gap.
- Restores use `pg_restore --single-transaction`, so a failed restore leaves the database
  unchanged instead of half-dropped.
- R2 requires a payment card on file even within the free tier.
- Two subtle bugs were found and fixed while building this; see `docs/lessons-learned.md`.
