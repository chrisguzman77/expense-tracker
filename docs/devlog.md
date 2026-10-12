# Devlog

A dated log of working sessions: what I set out to do, what happened, and what was decided.
The reasoning behind decisions lives in [decision records](decisions/); bugs and surprises
live in [lessons learned](lessons-learned.md). Entries before October are reconstructed from
git history.

## 2026-09-01 to 2026-09-10 — Backend MVP

Built by hand following a guided walkthrough: scaffolding, a walking skeleton (health check,
Postgres, Docker Compose), email/password auth, then categories, expenses and a monthly
summary.

- Auth stores a JWT in an httpOnly cookie; `/api/auth/me` is the only auth state
  ([decision 2](decisions/0002-jwt-in-httponly-cookie.md)).
- passlib broke with bcrypt 4, so passwords are hashed with bcrypt directly
  ([decision 3](decisions/0003-bcrypt-without-passlib.md)).
- Money is a decimal string end to end ([decision 4](decisions/0004-money-as-decimal-strings.md)).
- A linter autofix deleted a side-effect import and produced a drop-all-tables migration,
  caught before it ran ([lessons](lessons-learned.md#backend)).

PRs #1–#3.

## 2026-10-01 — Picking the project back up

Verified the project notes against the repository. The backend matched; the frontend was
further behind than the notes said (no API client yet, starter page still in place).

- Created the long-lived `dev` branch for the frontend phase
  ([decision 6](decisions/0006-branching-and-merging.md)).
- Chose `openapi-fetch` over a hand-written fetch wrapper, since the API types were already
  generated from the backend ([decision 5](decisions/0005-generated-api-types-and-openapi-fetch.md)).

## 2026-10-02 — API client plumbing

Generated the TypeScript types, built the `openapi-fetch` client with an `unwrap` helper for
TanStack Query, and set up Vitest. Another project on the laptop already held port 5432, so
local Postgres moved to 5434. PRs #4–#5.

## 2026-10-06 — The whole frontend in a day

Auth shell (login, register, logout, protected routes), then the categories, expenses and
monthly summary screens, each test-first with MSW and React Testing Library. The local API
moved to port 8010 for the same port-conflict reason.

- Smoke-testing the summary against the real backend exposed a SQL bug: categories with
  expenses only in other months disappeared. Fixed by moving the date filter from `WHERE`
  into the outer join's `ON` clause, test first.
- Landed `dev` in `main` with a merge commit to keep each feature's history.

PRs #6–#12.

## 2026-10-07 — Containers and CI

Frontend Dockerfile and nginx (SPA routing, asset caching, `/api` proxy). nginx returned 502
for a few seconds at startup until the API got a healthcheck. CI now runs Ruff, migrations
plus `alembic check`, pytest, ESLint, Vitest, the build, a type-drift check and image builds;
`alembic check` was proven to catch the old import bug. Branch protection requires the checks.
PRs #13–#14. ([decision 7](decisions/0007-ci-quality-gates.md))

## 2026-10-08 — Designing production

Chose TLS through `tailscale serve` over mounting certificates into nginx, public images on
GHCR (the repo is public and images hold no secrets), and publishing only from `main`, tagged
by commit for rollbacks. Production compose got a one-shot migration service the API waits on.
PR #15. ([decisions 8–10](decisions/))

## 2026-10-09 — First publish

Landing `dev` in `main` published the first images; they came out public without any manual
step. Wrote the VM setup guide (#17). The laptop's disk filled up and Docker went read-only;
pruning build cache recovered 17 GB.

## 2026-10-11 — "Why would one command delete my database?"

A question about `docker compose down -v` turned into a look at how the industry protects
production data, a tour of hosting options (cloud VMs, managed platforms), and a new
direction: grow this into a personal finance app with bank sync, budgets and subscription
detection ([decision 13](decisions/0013-personal-finance-roadmap.md)). Data safety comes first.

- Designed it through brainstorming: Cloudflare R2 for offsite storage, restic in a backup
  container, healthchecks.io for alerts, monthly restore drills. Wrote a spec and a plan.
- Executed the plan with subagents, one task at a time, each reviewed. Reviews caught that
  retention would never have pruned (random container hostnames) and a flaky test caused by
  `grep -q` under `pipefail`.
- Realized the reasoning behind the project only lived in chat, so wrote 13 decision records
  and a lessons-learned log.

## 2026-10-12 — Finishing data safety and going live

Finished the production compose and docs tasks. The final whole-branch review found problems
in the manual procedures someone would follow under pressure: a non-atomic restore, rollbacks
to older builds that would break every service, no upgrade path for an existing VM, and my own
"take a safety backup first" advice, which could have pruned the snapshot being restored. All
fixed. Merged data safety (#18) and the decision records (#19), and landed `dev` in `main`
(#20), which published the backup image.

Then deployment:

- Hosting: a dedicated VM on the home Proxmox server rather than sharing the public-facing
  portfolio VM or moving to the cloud ([decision 14](decisions/0014-dedicated-vm-on-proxmox.md)).
- iPhone: a home-screen web app, since native iPhone apps can't be installed from a website
  outside the EU ([decision 15](decisions/0015-mobile-access-as-home-screen-web-app.md)).
- Monitoring: healthchecks.io now, Grafana as a later project
  ([decision 16](decisions/0016-backup-monitoring-with-healthchecks.md)).
- Created the VM from a cloud-init template, installed Tailscale and Docker, set up the R2
  bucket and a bucket-scoped token, the encryption key (saved to a password manager), and two
  healthchecks.io checks. First backup and restore drill passed. The app is live at its
  Tailscale address, reachable only from my own devices.
- Snags along the way are in [lessons learned](lessons-learned.md#going-live): a reboot that
  needed the guest agent, a missing `s3:` prefix, and making sure Tailscale Funnel stayed off.

Closing registration: the app had one account but still accepted sign-ups from any device on
the tailnet. Registration is now off unless `ALLOW_REGISTRATION` is set, returning 403
otherwise; the setup guide opens it only for the first sign-up
([decision 17](decisions/0017-registration-closed-by-default.md)).

**Next:** confirm the first scheduled 3 a.m. backup; phone polish (icons, full-screen,
layout); then piece 2, accounts and transactions with CSV import.
