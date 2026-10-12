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
  The password schema should cap length at 72. **Open issue:** `UserCreate` currently allows
  120 characters, so a very long password would cause a server error at registration.
