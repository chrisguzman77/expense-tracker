# 20. Sliding sessions, remember me, and log out everywhere

- **Date:** 2026-10-13
- **Status:** Accepted (amends the session lifetime in [record 2](0002-jwt-in-httponly-cookie.md))

## Context

Sessions lasted 60 minutes from login and nothing renewed them, so the iPhone home-screen app
logged out every hour, even mid-use. Record 2 accepted that a logged-out token stays valid
until it expires because 60 minutes is short; a month-long session changes that tradeoff.

The app is reachable only from my own tailnet devices, so a stolen cookie is usable only from
one of them. That makes long sessions cheaper here than on a public site, not free.

## Decision

- **Sliding window.** Every authenticated request reissues the token with a fresh expiry, so a
  session ends only after a full idle period.
- **"Keep me logged in" decides the period.** Ticked: 30 days idle (`remember_days`) and a
  persistent cookie. Unticked: 60 minutes idle and a cookie that ends with the browser.
- **Keep the stateless JWT** and add `users.token_version`. Each token carries the version it
  was issued with; "log out everywhere" increments it, so every outstanding token is rejected.
  The check is free because the user row is already loaded on every request.
- **No absolute cap** on session age; log out everywhere covers a lost device.
- The frontend sends the user to the login screen on any 401, instead of showing the raw error.

## Alternatives considered

- **Server-side sessions table** (opaque token, hashed in the database). Logout would kill the
  token everywhere, and Settings could list devices and end one. More code and a reversal of
  record 2's token choice; for one user on two devices, log out everywhere is enough.
- **Short access token plus a rotating refresh token.** The standard answer when many services
  verify tokens without a database. Here there is one API and it reads the database on every
  request anyway, so it would add the complexity of both designs without that benefit.
- **A longer fixed expiry** (log in once a month regardless of use). Simplest, but logs out an
  app in daily use, and still has no way to end a stolen session early.

## Consequences

- Logout still only deletes the cookie on that device; a copied token stays valid for up to 30
  days unless log out everywhere is used.
- There is no list of signed-in devices and no way to end just one.
- Every device was logged out once at deploy, because older tokens have no version.
- Every authenticated response sets a cookie.
