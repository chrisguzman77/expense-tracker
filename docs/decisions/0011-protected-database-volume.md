# 11. The production database lives in an external volume

- **Date:** 2026-10-11 (PR #18)
- **Status:** Accepted

## Context

The production compose file kept Postgres in a compose-managed named volume.
`docker compose down -v` removes such volumes, so one command typed out of habit from local
development would have deleted every expense with no warning and no undo.

## Decision

The `pgdata` volume is declared `external: true` with the name `expense-tracker-pgdata` and is
created once by hand during VM setup. Compose never removes external volumes, and `up` fails
with "external volume not found" if it is missing instead of starting an empty database.

## Alternatives considered

- **Bind mount to a host folder** (`/srv/expense-tracker/pgdata`). Also survives `down -v` and,
  with `create_host_path: false`, fails loudly when missing. Costs folder ownership handling
  and is just as easy to delete with `rm -rf`.
- **Managed Postgres** (Neon, Supabase, Vultr). The industry default, but puts the database on
  the public internet with a third party, and free tiers pause or cap databases.
- **A dedicated database VM.** Closest to how companies self-host; doubles the machines to
  maintain for a single-user app. A reasonable later exercise.

## Consequences

- Verified locally: after `down -v` the volume and its rows were still there.
- Storage protection only guards against one wrong command. Disk failure, a bad migration or a
  deliberate `docker volume rm` still need backups (record 12).
