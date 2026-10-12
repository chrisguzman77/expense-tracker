# Expense Tracker

A self-hosted personal finance app: track spending by category and see monthly summaries.
Built as an end-to-end practice project covering scoping, architecture, tests, CI and deployment.

**Roadmap:** accounts and transactions with CSV import, bank sync, budgets, and detection of
forgotten subscriptions.

## Stack

- **Backend:** Python 3.12, FastAPI, SQLAlchemy 2, Alembic, Pydantic v2, Postgres 16
- **Frontend:** React, TypeScript, Vite, TanStack Query, React Router, React Hook Form + Zod, Tailwind
- **Ops:** Docker Compose, GitHub Actions, GHCR, Tailscale, restic + Cloudflare R2

## Architecture and operations

```
browser --https--> tailscale serve --> nginx --> FastAPI --> Postgres
                                        (static React build, /api proxy)
```

- **Private by default.** The app is reachable only from devices on my Tailscale network.
  nginx listens on the server's loopback interface and `tailscale serve` terminates HTTPS with
  an automatically renewed certificate. Postgres and the API publish no ports at all.
- **Same-origin auth.** The JWT lives in an httpOnly, SameSite=Lax, Secure cookie, so no token
  is ever readable by JavaScript and CSRF is covered by SameSite plus same-origin requests.
- **Types can't drift.** Frontend API types are generated from the backend's OpenAPI schema,
  and CI fails if the committed types don't match.
- **Migrations are checked.** CI runs `alembic check`, which fails if the models and the
  migrations disagree.
- **The database can't be deleted by deploy tooling.** It lives in an external Docker volume
  (`expense-tracker-pgdata`) that `docker compose down -v` does not remove; if the volume is missing, startup fails
  instead of silently creating an empty database.
- **Backups are encrypted, offsite and verified.** A backup service streams `pg_dump` into
  restic every night. restic encrypts it before upload to Cloudflare R2 and refuses to record
  a snapshot if the dump fails. Every month the service restores the latest backup into a
  scratch database and checks it, because a backup is only proven by a restore.
  healthchecks.io alerts on any missed or failed run. CI runs the same backup and restore end
  to end on every pull request.
- **Deploys are reproducible.** Merging to `main` publishes images tagged with the commit SHA;
  a rollback is changing one variable. Branch protection requires every CI check to pass.

## Running locally

Requires Docker, [uv](https://docs.astral.sh/uv/) and Node 24.

```
docker compose up -d db                                   # Postgres on localhost:5434
cd backend && cp .env.example .env                        # then set JWT_SECRET (openssl rand -hex 32)
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --port 8010
cd ../frontend && npm ci && npm run dev                   # http://localhost:5173
```

Tests: `uv run pytest` in `backend/`, `npx vitest run` in `frontend/`, `backup/test/e2e.sh`
for the backup image.

## Deploying

See [deploy/README.md](deploy/README.md).
