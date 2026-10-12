# 6. Branching, merging and branch protection

- **Date:** 2026-10-01 (dev branch); 2026-10-06 (merge strategy); 2026-10-07 (protection)
- **Status:** Accepted

## Context

Work happens in phases (backend MVP, frontend, deployment readiness, data safety). Each phase
lands as several pull requests. `main` should only ever hold finished, working phases.

## Decision

- Each change is a `feat/`, `fix/`, `chore/`, `ci/` or `docs/` branch with a pull request into
  the long-lived `dev` branch, **squash-merged** and deleted afterwards. Commits follow
  Conventional Commits.
- At the end of a phase, `dev` lands in `main` with a **merge commit**, which keeps each
  pull request's squashed commit visible in `main`'s history.
- `main` and `dev` are protected: the `backend`, `frontend`, `docker` and `backup` CI checks must
  pass before merging; force pushes and branch deletion are blocked.

## Alternatives considered

- **Squash `dev` into `main` too.** Would collapse a whole phase into one commit and lose the
  per-feature history.
- **Strict protection (branch must be up to date)** and **required reviews.** Both add
  friction with no benefit for a single developer; GitHub also doesn't allow approving your
  own pull requests.

## Consequences

- `dev` never receives `main`'s merge commits; that is expected with this strategy.
- Admins are not forced through the checks, so `gh pr merge --admin` remains an emergency
  bypass.
- Required checks are matched by job name: renaming a CI job requires updating the rule.
