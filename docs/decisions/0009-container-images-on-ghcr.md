# 9. Container images on GHCR, public, tagged by commit

- **Date:** 2026-10-08 (PR #15); first publish 2026-10-09
- **Status:** Accepted

## Context

The VM should run exactly what CI tested, not build from source. Images need a registry and
a tagging scheme that makes rollbacks easy.

## Decision

- CI's `publish` job pushes `ghcr.io/chrisguzman77/expense-tracker-{api,web,backup}` only after
  a push to `main` and only when every check passed.
- Each image is tagged with the commit SHA and `latest`. The production compose file reads
  `IMAGE_TAG` for the app (api, web, migrate), so a rollback is changing one value in `.env`.
- The backup service reads its own `BACKUP_IMAGE_TAG` (default `latest`), decided 2026-10-12.
  The backup image only exists for commits from 2026-10-12 onward, so a shared tag would make
  rolling the app back to an older commit fail for every service. Separate tags also keep the
  newest backup scripts running while the app is rolled back.
- Packages are **public**. The source repository is already public and the images contain no
  secrets: both `.dockerignore` files exclude `.env`, and secrets are injected at runtime from
  the VM's `.env`. A published image was pulled anonymously and checked for secrets.

## Alternatives considered

- **Private packages.** The VM would need a personal access token to pull; protects nothing
  the public repo doesn't already show.
- **Publishing from `dev` as well.** Useful for a staging environment, which doesn't exist.

## Consequences

- The VM pulls without credentials.
- Rolling back code doesn't roll back the database schema; a rollback across a migration needs
  a restore (record 12).
- Images are built for amd64 only; an ARM host would need multi-platform builds.
- The packages inherited the repository's public visibility automatically on first publish.
