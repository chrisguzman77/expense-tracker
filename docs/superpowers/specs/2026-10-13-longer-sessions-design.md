# Longer sessions on trusted devices

Date: 2026-10-13
Status: approved design, pending implementation plan

## Context

Login sets one JWT in an httpOnly cookie (`access_token`). Token and cookie both expire 60
minutes after login (`jwt_expire_minutes`), and nothing renews them, so the iPhone home-screen
app logs out every hour even while in use. The server keeps no session state: logout deletes the
cookie on that device only, and a copied token stays valid until it expires
([record 2](../../decisions/0002-jwt-in-httponly-cookie.md)).

The frontend has no global handling of 401 responses. `App.tsx` creates a bare
`new QueryClient()`, and only `RequireAuth` redirects to `/login`, when the `/me` query fails.
`/me` has a 5-minute `staleTime`, so when a session ends mid-use, screens show the raw API error
("Invalid or expired") until `/me` refetches.

The app is reachable only from the owner's tailnet devices, so a stolen cookie is usable only
from one of them. That lowers the cost of a long session; it does not remove it.

## Goal

Stay logged in on a trusted device as long as the app is used at least once every 30 days, with
a way to end every session at once, and send the user to the login screen whenever a session
ends.

## Decisions (made during brainstorming)

- **Sliding window,** not a fixed period or "until logout": the session lasts while the app is
  used at least once per window.
- **"Keep me logged in" checkbox** decides which logins are long; unticked logins stay short.
- **Keep the stateless JWT** and add a per-user token version for "log out everywhere"
  (option A), instead of a server-side sessions table (B) or access plus refresh tokens (C).
  B would give per-device listing and revocation and make logout kill the token everywhere; A
  was chosen as the smaller change that keeps record 2 intact. C's main benefit (verifying
  tokens without a database) doesn't apply: there is one API and it already loads the user on
  every request.
- **Global 401 handling** is in scope.
- **No absolute cap** on session age.

## Backend

### Token

`create_token` encodes these claims:

| Claim | Value |
|---|---|
| `sub` | user id as a string (unchanged) |
| `exp` | now + the session's idle limit |
| `iat` | now |
| `ver` | the user's `token_version` |
| `rm` | `true` if "keep me logged in" was ticked, else `false` |

### Two session kinds

| | `rm: true` | `rm: false` |
|---|---|---|
| Idle limit (`exp`) | `remember_days` days (new setting, default 30) | `jwt_expire_minutes` minutes (existing, default 60) |
| Cookie | persistent, `max_age` = `remember_days * 86400` | browser-session cookie, no `max_age` |

- `UserLogin` gains `remember: bool = False`. Login uses it.
- Register always issues `rm: false`.
- Cookie attributes are otherwise unchanged: `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` when
  `ENVIRONMENT=production`.

### Sliding

On every successful authentication, `get_current_user` issues a fresh token with a new `exp`
and `iat` and the same `rm` and `ver`, and sets the cookie on the response (FastAPI merges
cookies set on a dependency's `Response` into the route's response). Reissuing on every
request is simpler than deciding when to refresh and makes the rule exact: the session ends
after one full idle limit without an authenticated request.

### Token version

- `users.token_version`: integer, not null, server default `0`. One Alembic migration.
- `get_current_user` returns 401 if the token's `ver` is missing or differs from the user's
  `token_version`. The user row is already loaded, so this adds no query.
- Tokens issued before this change have no `ver`, so every device is logged out once at deploy.

### Endpoints

- `POST /api/auth/login`: accepts `remember`; sets the cookie as above.
- `POST /api/auth/logout`: unchanged. Deletes this device's cookie only; a copied token stays
  valid until it expires or "log out everywhere" is used.
- `POST /api/auth/logout-all` (new): requires authentication. Increments the user's
  `token_version`, deletes this device's cookie, returns 204. Every previously issued token,
  on every device, is rejected afterward.

The version increment lives in the users service as `log_out_everywhere(db, user) -> None`;
the router stays thin. `logout-all` authenticates through `get_current_user`, which also sets a
refreshed cookie on the response; the route's `delete_cookie` comes after it, and that refreshed
token carries the old `ver`, so it would be rejected even if a client kept it.

## Frontend

### Login screen

- A "Keep me logged in" checkbox below the password field, unticked by default.
- Its value is sent as `remember` in the login request.
- The register screen has no checkbox.

### Settings screen

- Below Log out, a secondary "Log out everywhere" button.
- Pressing it shows an inline confirmation (the same pattern as Delete on the expense detail
  screen): "This logs out every device, including this one", with Confirm and Cancel. No modal.
- Confirm posts `/api/auth/logout-all`, clears the query cache, and navigates to `/login`, as
  Log out does.

### Global 401 handling

- `onError` handlers on the `QueryClient`'s query cache and mutation cache, defined in their own
  module (not inline in `App.tsx`) so they can be tested.
- When the error is an `ApiError` with status 401:
  1. remove every cached query except `/me`;
  2. invalidate `/me`; it refetches, gets 401, and `RequireAuth` redirects to `/login`.
- Two exclusions:
  - the `/me` query itself (handling its own 401 would loop; `RequireAuth` already covers it);
  - the login mutation (a wrong password is 401 "Invalid credentials" and must stay on the form).
- Unchanged: no auth state or token in JavaScript; the frontend never knows when a session
  expires and only reacts to 401s.

## Testing

### Backend (pytest), test first

- Login without `remember`: cookie has no `Max-Age`; token `exp` about 60 minutes ahead;
  `rm` false.
- Login with `remember: true`: cookie `Max-Age` is 30 days; token `exp` about 30 days ahead;
  `rm` true.
- Sliding: a token signed in the test with an earlier `exp`, sent to `/me`, gets a new cookie
  whose token has a later `exp` and the same `rm` and `ver`.
- An expired token, a token with a mismatched `ver`, and a token without `ver` each get 401.
- Log out everywhere: logins produce tokens A and B; B calls `logout-all`; afterward A and B
  both get 401; a fresh login works.
- `logout-all` without a cookie gets 401.
- Existing auth and ownership tests stay green.

### Frontend (Vitest, RTL, MSW)

- Login sends `remember: false` by default and `remember: true` when ticked.
- Settings: Log out everywhere → Confirm posts `logout-all` and lands on the login screen;
  Cancel sends nothing.
- 401 handling: a data request returning 401 ends on the login screen; a wrong password stays
  on the form with its error; a `/me` 401 does not loop (count the requests).

## Documentation

- ADR 20, "Sliding sessions, remember me, and log out everywhere": the three options and why A
  won; its limits (no per-device list; a normal logout doesn't kill a copied token); no
  absolute cap.
- ADR 2 status line: "Accepted; session lifetime amended by [record 20]". Decisions README
  gets row 20.
- Devlog entry; lessons-learned entries for any surprises.

## Delivery

Feature branches into `dev`, squash-merged:

1. `feat/sliding-sessions`: this spec, backend changes, migration, tests, regenerated
   `schema.d.ts`, ADR 20, ADR 2 status and README row. `remember` defaults to false, so the
   existing frontend keeps working with this PR alone.
2. `feat/session-ui`: checkbox, Settings button, 401 handling, tests, devlog entry.

Then land `dev` into `main` with a merge commit; images publish.

## Rollout

1. On the VM, run `backup-now` (this release has a migration), then `docker compose pull` and
   `docker compose up -d`. The `migrate` service adds `token_version`.
2. Every device is logged out once. Log in on the laptop as usual.
3. On the iPhone, log in inside the home-screen app (it has its own cookie storage, separate
   from Safari) with "Keep me logged in" ticked.

No new environment variables are required: `remember_days` defaults to 30.

## Out of scope

- The `UserCreate.password` max-length fix (separate small PR, next).
- A per-device session list and revoking a single device.
- An absolute session cap.
