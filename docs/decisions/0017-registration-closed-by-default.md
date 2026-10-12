# 17. Registration is closed by default

- **Date:** 2026-10-12
- **Status:** Accepted

## Context

The app is single-user, permanently. After the owner's account existed, `POST
/api/auth/register` was still open, so any device on the tailnet could create an account.

## Decision

`Settings.allow_registration` (env `ALLOW_REGISTRATION`) defaults to off. While off, the
register endpoint returns 403 `Registration is closed` before creating anything. Production
compose passes `${ALLOW_REGISTRATION:-false}`; the owner turns it on in `.env` only for the
first sign-up on a new install. Local development and tests turn it on explicitly. The login
page no longer links to registration.

## Alternatives considered

- **Close automatically once one account exists.** No setting, but registration silently
  reopens whenever the users table is empty, for example on a rebuilt VM before the backup is
  restored.
- **Command-line-only accounts.** Removes the endpoint entirely; most locked-down, but requires
  rewriting every test that signs up through the endpoint, for little gain on a private app.

## Consequences

- Fails closed: a missing setting means no sign-ups.
- A new install needs a short open-register-close sequence, documented in the setup guide.
- The check lives in the router as deployment configuration, not in the user service.
