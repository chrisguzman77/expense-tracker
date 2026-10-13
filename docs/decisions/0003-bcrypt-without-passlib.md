# 3. Hash passwords with bcrypt directly, not passlib

- **Date:** 2026-09-03 (PR #2)
- **Status:** Accepted

## Context

passlib is the usual wrapper for password hashing in FastAPI tutorials, but it is no longer
maintained and breaks with bcrypt 4.x, which removed an attribute passlib reads.

## Decision

Call `bcrypt.hashpw` and `bcrypt.checkpw` directly in `backend/app/auth.py`, and drop passlib.

## Alternatives considered

- **Pin bcrypt below 4.** Keeps the tutorial code working but freezes a security library.
- **Argon2 via argon2-cffi.** A stronger modern default; not chosen because bcrypt is adequate
  here and the direct API is two calls.

## Consequences

- bcrypt only uses the first 72 bytes of a password and newer versions reject longer input.
  The password schema should cap length at 72. **Resolved 2026-10-13:** registration now
  rejects passwords over 72 UTF-8 bytes (not characters; emoji and accented letters take
  several) with a 422, and login treats a longer password as wrong (401) instead of passing it
  to bcrypt, which raised a server error on both paths.
