# Password length: respect bcrypt's 72-byte limit

Date: 2026-10-13
Status: approved design

## Problem

bcrypt 5.0.0 raises `ValueError` for any password over 72 **bytes**, in both `hashpw` and
`checkpw`.

- Registration: `UserCreate.password` allows up to 120 characters, so a long password passes
  validation and then fails hashing with a 500.
- Login: `UserLogin.password` deliberately has no length rules
  ([record 2](../../decisions/0002-jwt-in-httponly-cookie.md)), so any visitor who reaches the
  login page can cause a 500 by typing a long password. It should be a 401.
- The limit is in UTF-8 bytes, not characters: an emoji is 4 bytes, "é" is 2. A 72-character
  cap would still fail.

Recorded as an open issue in [record 3](../../decisions/0003-bcrypt-without-passlib.md).

## Decision

Enforce 72 bytes at registration and treat longer login passwords as wrong. Considered and
rejected: a 72-character cap (still fails on multi-byte characters; login 500 remains), and
pre-hashing with SHA-256 (removes the limit but changes every stored hash; switching to Argon2
would be the better long-term answer and is a separate decision).

## Backend

- `app/auth.py`: `BCRYPT_MAX_BYTES = 72`.
- `verify_password(raw, hashed)`: returns `False` when `len(raw.encode()) > BCRYPT_MAX_BYTES`,
  without calling bcrypt. No stored password can be that long, so this is always correct. Login
  then returns the usual 401 "Invalid credentials".
- `app/schemas/user.py`, `UserCreate.password`: keeps `min_length=8`; `max_length=120` is
  replaced by a validator that rejects a UTF-8 byte length over `BCRYPT_MAX_BYTES` with
  "Password is too long: 72 bytes max (emoji and accented letters count as more than one)".
  Pydantic returns 422.
- `UserLogin` unchanged. No migration; existing hashes unchanged.

## Frontend

- `RegisterPage`'s Zod schema: `.max(120, ...)` becomes a refine on
  `new TextEncoder().encode(v).length <= 72` with the same message; the "Mirrors the backend"
  comment is updated.
- `schema.d.ts` regenerated (the OpenAPI spec loses `maxLength: 120`).
- Login page unchanged.

## Tests (first)

Backend:
- register with 72 ASCII bytes → 201;
- register with 73 ASCII bytes → 422;
- register with 19 emoji (19 characters, 76 bytes) → 422;
- log in with a 100-byte password → 401 (500 today).

Frontend:
- the register form shows the "too long" message for a password of 40 "é" (40 characters,
  80 bytes) and sends no request.

## Docs

- Record 3: the open issue becomes resolved.
- lessons-learned: the passlib entry's "Still open" line updated.
- Devlog entry, including the rollout note for longer sessions.

## Delivery

One branch, `fix/password-length`, one PR into `dev`.
