# 7. CI quality gates

- **Date:** 2026-10-07 (PR #14); backup job 2026-10-11 (PR #18)
- **Status:** Accepted

## Context

Several mistakes in this project would pass a normal test suite: a deleted model import that
makes Alembic generate a drop-all-tables migration, an API change merged without regenerating
frontend types, and backup scripts that only fail in production.

## Decision

GitHub Actions runs these jobs on every pull request and on pushes to `main` and `dev`:

- **backend:** Ruff lint and format check; `alembic upgrade head` then `alembic check`
  against a Postgres 16 service (fails if models and migrations disagree); pytest.
- **frontend:** ESLint, Vitest, type-check and production build, and a type-drift check that
  regenerates `schema.d.ts` from the backend and fails on any difference.
- **docker:** builds the api and web images.
- **backup:** ShellCheck (pinned `koalaman/shellcheck:v0.11.0`) and an end-to-end test that
  runs a real backup and restore drill against Postgres, including failure cases.
- **publish:** after all of the above, on pushes to `main` only, pushes images to GHCR
  (record 9).

## Consequences

- `alembic check` was verified to fail when the model import in `alembic/env.py` is removed,
  which is the regression that motivated it.
- The end-to-end backup test needs only Docker and uses a local restic repository, so no cloud
  credentials live in CI. The CI JWT secret is an inline throwaway value.
