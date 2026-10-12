# Close registration by default

Date: 2026-10-12
Status: approved design, pending implementation plan

## Context

The app is single-user, permanently. The owner's account exists on the production VM, but
`POST /api/auth/register` is still open, so anyone who reaches the app (any device on the
tailnet) could create an account. Production behavior in this project is already driven by
environment settings (`ENVIRONMENT=production` makes the auth cookie `Secure`).

## Goal

Registration is closed unless explicitly enabled, in every environment, with production
behavior visible in the repository.

## Non-goals

- Admin tooling or invites for additional users (there will be none).
- Removing the register page or endpoint (local development still uses them).
- Changing password policy (the separate bcrypt 72-byte issue stays open).

## Design

### Backend

- `backend/app/config.py`: `Settings.allow_registration: bool = False`, read from
  `ALLOW_REGISTRATION`. A missing value means closed.
- `backend/app/routers/auth.py`: a dependency on `POST /api/auth/register` raises
  `HTTPException(403, "Registration is closed")` when `settings.allow_registration` is false,
  before any account is created. It is deployment configuration, not a business rule, so it
  lives at the router rather than in `services/users.py`. Login, logout and `/me` are unchanged.

### Tests

- `backend/tests/conftest.py`: an autouse fixture sets `settings.allow_registration = True`
  (via monkeypatch) so existing tests that sign up through the endpoint keep working unchanged.
- New tests in `backend/tests/test_auth.py`, with registration closed:
  - register returns 403 with detail `Registration is closed`, and the `users` table gains no row;
  - a user created while open can still log in and call `/api/auth/me` after it closes.
- Frontend: a `RegisterPage` test that a 403 with detail `Registration is closed` is shown in
  the page's `role="alert"` element.

### Configuration

- `deploy/compose.yaml`: the API environment gets
  `ALLOW_REGISTRATION: ${ALLOW_REGISTRATION:-false}`. Off unless the VM's `.env` turns it on.
- `backend/.env` (local development, the owner's file) and `backend/.env.example` (committed
  documentation) get `ALLOW_REGISTRATION=true`. Agents are blocked from editing env files, so
  the owner adds both lines.
- CI needs no change; tests enable registration through the fixture.

### Frontend

- `frontend/src/pages/LoginPage.tsx`: remove the "No account? Register" link.
- `RegisterPage` and its route stay; the page already shows the server's error message.

### Documentation

- `deploy/README.md`, one-time setup step 9: to create the account on a new install, add
  `ALLOW_REGISTRATION=true` to `.env`, run `docker compose up -d`, register, remove the line,
  and run `docker compose up -d` again. The VM-loss path needs no registration, since the
  restore brings the account back.
- Decision record 17: registration closed by default (alternatives: close after first user,
  command-line-only accounts).
- `docs/devlog.md`: entry for this change.

## Rollout

Merge to `dev`, land `dev` in `main` (publishes images). On the VM: re-download
`compose.yaml`, `docker compose pull`, `docker compose up -d`. Registration closes because the
new default is off; verify with a register attempt returning 403.
