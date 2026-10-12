# 10. Database migrations run as a one-shot compose service

- **Date:** 2026-10-08 (PR #15)
- **Status:** Accepted

## Context

Migrations must run before the API starts serving a new version, exactly once per deploy.

## Decision

- The production compose file has a `migrate` service that uses the api image to run
  `alembic upgrade head` and then exits.
- The `api` service waits for `migrate` with `condition: service_completed_successfully`, so
  a failed migration stops the deploy before new code serves traffic.
- The `api` has a healthcheck, and nginx (`web`) waits for it to be healthy. Without this,
  nginx returned 502 for the first seconds after startup.

## Alternatives considered

- **Migrate in the API's startup.** Ties schema changes to process restarts and races if more
  than one API process ever runs.
- **Run migrations by hand.** Easy to forget.

## Consequences

- Every `docker compose up -d` re-runs migrate; it is a no-op when the schema is current.
- Deploy order is enforced by compose rather than by a script.
