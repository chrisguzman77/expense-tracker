# 2. Authentication: JWT in an httpOnly cookie, same origin

- **Date:** 2026-09-03 (PR #2)
- **Status:** Accepted

## Context

A React single-page app talks to a FastAPI backend. The app needs email/password login and
must keep the session token away from JavaScript, since any XSS bug could otherwise steal it.

## Decision

- On register and login the API sets a JWT (HS256, PyJWT) in a cookie named `access_token`:
  `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` when `ENVIRONMENT=production`.
- The frontend stores no token and no auth state. `GET /api/auth/me` is the single source of
  truth; a 401 means logged out.
- Browser and API are always same origin: the Vite dev server proxies `/api` locally, nginx
  proxies it in production. CSRF is covered by `SameSite=Lax` plus same-origin requests.
- Registration (`UserCreate`) enforces the password policy; login (`UserLogin`) does not, so a
  policy change never locks out existing users.

## Alternatives considered

- **Token in localStorage with an `Authorization` header.** Simple and common, but readable by
  any script on the page.
- **Server-side sessions table.** Allows instant revocation, at the cost of a database lookup
  per request and more state to manage. Not needed for a single-user app.

## Consequences

- Frontend and API must share an origin. This later ruled out hosting the frontend on a
  separate domain (for example Vercel) without extra CORS and CSRF work.
- `Secure` cookies require HTTPS in production, which drove the TLS decision (record 8).
- Logout deletes the cookie, but a stolen token stays valid until it expires (60 minutes).
