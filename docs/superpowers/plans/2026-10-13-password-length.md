# Password Length Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop over-long passwords from causing 500s: reject more than 72 bytes at registration (422) and treat them as wrong at login (401).

**Architecture:** A `BCRYPT_MAX_BYTES = 72` constant in `app/auth.py`; `verify_password` short-circuits to `False` above it; `UserCreate` validates the UTF-8 byte length; the register form mirrors the rule with `TextEncoder`.

**Tech Stack:** FastAPI, Pydantic v2, bcrypt 5.0.0, pytest; React + React Hook Form + Zod 4, Vitest + RTL + MSW.

Spec: `docs/superpowers/specs/2026-10-13-password-length-design.md`.

## Global Constraints

- The limit is 72 **bytes** of UTF-8, not characters. Constant name: `BCRYPT_MAX_BYTES`, in `backend/app/auth.py`.
- Error message, exact, backend and frontend: `Password is too long: 72 bytes max (emoji and accented letters count as more than one)`
- `UserCreate.password` keeps `min_length=8`; `max_length=120` is removed.
- `UserLogin` keeps no length rules (record 2). Login with an over-long password returns 401 `Invalid credentials`.
- No migration; stored hashes unchanged.
- Backend tooling from `backend/` with `uv run ...`; Ruff clean. `frontend/src/api/schema.d.ts` is generated only.
- Never read or edit any `.env` or `.env.example` file.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

Branch: `fix/password-length` (exists, holds the spec).

---

### Task 1: Backend enforces 72 bytes

**Files:**
- Modify: `backend/app/auth.py`
- Modify: `backend/app/schemas/user.py`
- Modify: `backend/tests/test_auth.py`
- Modify (generated, only if it changes): `frontend/src/api/schema.d.ts`

**Interfaces:**
- Produces: `app.auth.BCRYPT_MAX_BYTES: int = 72`.

- [ ] **Step 1: Write the failing tests**

Append to `backend/tests/test_auth.py`:

```python
def test_register_accepts_a_72_byte_password(client):
    r = client.post(
        "/api/auth/register", json={"email": "a@b.com", "password": "a" * 72}
    )
    assert r.status_code == 201


def test_register_rejects_a_73_byte_password(client):
    r = client.post(
        "/api/auth/register", json={"email": "a@b.com", "password": "a" * 73}
    )
    assert r.status_code == 422
    assert "72 bytes max" in r.text


def test_register_counts_bytes_not_characters(client):
    password = "😀" * 19
    assert len(password) == 19
    assert len(password.encode()) == 76
    r = client.post("/api/auth/register", json={"email": "a@b.com", "password": password})
    assert r.status_code == 422


def test_login_with_an_over_long_password_is_401(client):
    client.post(
        "/api/auth/register", json={"email": "a@b.com", "password": "hunter22!"}
    )
    r = client.post("/api/auth/login", json={"email": "a@b.com", "password": "a" * 100})
    assert r.status_code == 401
```

- [ ] **Step 2: Run them to confirm the failures**

From `backend/` (Postgres up: `docker compose up -d db` from the repo root):
`uv run pytest tests/test_auth.py -v`
Expected: `test_register_accepts_a_72_byte_password` passes (it guards the boundary). The other three fail with `ValueError: password cannot be longer than 72 bytes` raised out of bcrypt (the TestClient re-raises server exceptions; in production these are 500s).

- [ ] **Step 3: Add the constant and the login short-circuit**

In `backend/app/auth.py`, below `COOKIE_NAME = "access_token"`:

```python
# bcrypt uses at most 72 bytes of a password and raises on longer input.
BCRYPT_MAX_BYTES = 72
```

Replace `verify_password` with:

```python
def verify_password(raw: str, hashed: str) -> bool:
    # No stored password can be longer, so this is simply a wrong password.
    if len(raw.encode()) > BCRYPT_MAX_BYTES:
        return False
    return bcrypt.checkpw(raw.encode(), hashed.encode())
```

- [ ] **Step 4: Validate the byte length at registration**

Replace the top of `backend/app/schemas/user.py` through the end of `UserCreate` with:

```python
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from ..auth import BCRYPT_MAX_BYTES


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def fits_bcrypt(cls, value: str) -> str:
        # The limit is bytes: emoji and accented letters take more than one each.
        if len(value.encode()) > BCRYPT_MAX_BYTES:
            raise ValueError(
                "Password is too long: 72 bytes max "
                "(emoji and accented letters count as more than one)"
            )
        return value
```

(`UserRead` and `UserLogin` below it stay unchanged.)

- [ ] **Step 5: Run the tests and lint**

From `backend/`:

```bash
uv run pytest -v
uv run ruff check . && uv run ruff format --check .
```

Expected: 33 passed (29 + 4); Ruff clean (run `uv run ruff format .` if it lists files, then re-check).

- [ ] **Step 6: Regenerate the API types**

Check port 8010 is free (`lsof -i :8010`). From `backend/`, start `uv run uvicorn app.main:app --port 8010` in the background; from `frontend/`, run `npm run gen:api`; stop uvicorn.
Run `git diff --stat frontend/src/api/schema.d.ts`. Expected: no change, or only the removal of a `maxLength`-related line for `UserCreate.password`. Anything else: stop and report.
From `frontend/`: `npx tsc -b` (expected: clean).

- [ ] **Step 7: Commit**

```bash
git add backend/app/auth.py backend/app/schemas/user.py backend/tests/test_auth.py
git add frontend/src/api/schema.d.ts   # only if it changed
git commit -m "fix: enforce bcrypt's 72-byte password limit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Register form mirrors the limit

**Files:**
- Modify: `frontend/src/pages/RegisterPage.tsx`
- Modify: `frontend/src/pages/RegisterPage.test.tsx`

- [ ] **Step 1: Write the failing test**

Add inside the `describe` block of `frontend/src/pages/RegisterPage.test.tsx`:

```tsx
  it("rejects passwords over 72 bytes without calling the API", async () => {
    let called = false;
    server.use(
      http.post("/api/auth/register", () => {
        called = true;
        return HttpResponse.json({ id: 1, email: "chris@example.com" }, { status: 201 });
      }),
    );
    renderRegister();

    // 40 characters, but 80 bytes: each "é" is two bytes in UTF-8.
    await fillAndSubmit("chris@example.com", "é".repeat(40));

    expect(await screen.findByText(/too long: 72 bytes max/i)).toBeInTheDocument();
    expect(called).toBe(false);
  });
```

- [ ] **Step 2: Run it to confirm it fails**

From `frontend/`: `npx vitest run src/pages/RegisterPage.test.tsx`
Expected: the new test FAILS (the current 120-character rule accepts 40 characters, so the request is sent and the message never appears).

- [ ] **Step 3: Replace the length rule**

In `frontend/src/pages/RegisterPage.tsx`, replace the comment and schema:

```tsx
// Mirrors the backend UserCreate schema: at least 8 characters, at most 72 bytes
// (bcrypt's limit; emoji and accented letters take more than one byte each).
const encoder = new TextEncoder();
const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .refine(
      (value) => encoder.encode(value).length <= 72,
      "Password is too long: 72 bytes max (emoji and accented letters count as more than one)",
    ),
});
```

- [ ] **Step 4: Run tests, types, lint**

From `frontend/`:

```bash
npx vitest run src/pages/RegisterPage.test.tsx
npx tsc -b
npx eslint .
npx vitest run
```

Expected: RegisterPage tests all pass; tsc and eslint clean; full suite 88 passed (87 + 1). On a heavily loaded machine, an unrelated page test may hit the 5s timeout; re-run that file alone and report it rather than changing it.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/RegisterPage.tsx frontend/src/pages/RegisterPage.test.tsx
git commit -m "fix: register form checks the 72-byte password limit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After Task 2 (controller)

- Docs commit: record 3's open issue marked resolved; the lessons-learned passlib entry's
  "Still open" line updated; devlog entry including the longer-sessions rollout note.
- Push, open the PR against `dev`, wait for CI and Chris's merge.
