# Close Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `POST /api/auth/register` refuses with 403 unless `ALLOW_REGISTRATION` is explicitly enabled, in every environment.

**Architecture:** A `Settings.allow_registration` flag (default `False`) gates the register route through a router-level FastAPI dependency. Tests enable it with an autouse fixture. Production compose passes `${ALLOW_REGISTRATION:-false}`. The login page drops its register link.

**Tech Stack:** FastAPI, pydantic-settings, pytest, React + Vitest + MSW, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-10-12-close-registration-design.md`

## Global Constraints

- Setting name `allow_registration`, env var `ALLOW_REGISTRATION`, default `False` (missing means closed).
- Closed response: HTTP 403 with JSON detail exactly `Registration is closed`; no account is created.
- Login, logout and `/api/auth/me` behavior is unchanged.
- Production compose: `ALLOW_REGISTRATION: ${ALLOW_REGISTRATION:-false}`.
- Agents never edit `.env` or `.env.example` files; the owner adds `ALLOW_REGISTRATION=true` to `backend/.env` and `backend/.env.example`.
- Run backend tooling from `backend/` with `uv run ...`; Postgres for tests must be up (`docker compose up -d db` from the repo root; host port 5434).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch `feat/close-registration`, PR into `dev`.

## File Structure

| Path | Change |
|---|---|
| `backend/app/config.py` | add `allow_registration: bool = False` |
| `backend/app/routers/auth.py` | add `require_registration_open` dependency on the register route |
| `backend/tests/conftest.py` | autouse fixture enabling registration for tests |
| `backend/tests/test_auth.py` | two new tests for the closed state |
| `frontend/src/pages/LoginPage.tsx` | remove the register link |
| `frontend/src/pages/RegisterPage.test.tsx` | one test for the 403 message |
| `deploy/compose.yaml` | `ALLOW_REGISTRATION` in the shared api env |
| `deploy/README.md` | first-install account creation in step 9 |
| `docs/decisions/0017-registration-closed-by-default.md`, `docs/decisions/README.md`, `docs/devlog.md` | docs |

---

### Task 1: Backend gate

**Files:**
- Modify: `backend/app/config.py`, `backend/app/routers/auth.py`, `backend/tests/conftest.py`
- Test: `backend/tests/test_auth.py`

**Interfaces:**
- Produces: `settings.allow_registration: bool`; `require_registration_open() -> None` in `app/routers/auth.py`; 403 `{"detail": "Registration is closed"}` from `POST /api/auth/register` when closed.

- [ ] **Step 1: Add the setting, and enable registration for all existing tests**

`backend/app/config.py`, add to `Settings` after `environment` (the route doesn't read it yet):

```python
    allow_registration: bool = False
```

Pydantic settings objects reject attributes they don't define, so the field must exist before
tests can patch it. In `backend/tests/conftest.py`, add after the imports (keep everything else):

```python
from app.config import settings
```

and add this fixture after the `schema` fixture:

```python
@pytest.fixture(autouse=True)
def registration_open(monkeypatch):
    # Production defaults to closed; most tests sign up through the endpoint.
    monkeypatch.setattr(settings, "allow_registration", True)
```

Run (from `backend/`): `uv run pytest -q`. Expected: 8 passed (nothing reads the setting yet).

- [ ] **Step 2: Write the failing tests**

Append to `backend/tests/test_auth.py`:

```python
from sqlalchemy import func, select

from app.config import settings
from app.models.user import User


def test_register_is_403_when_registration_closed(client, db, monkeypatch):
    monkeypatch.setattr(settings, "allow_registration", False)
    r = client.post(
        "/api/auth/register", json={"email": "a@b.com", "password": "hunter22!"}
    )
    assert r.status_code == 403
    assert r.json() == {"detail": "Registration is closed"}
    assert db.scalar(select(func.count()).select_from(User)) == 0


def test_existing_user_can_log_in_when_registration_closed(client, monkeypatch):
    body = {"email": "a@b.com", "password": "hunter22!"}
    assert client.post("/api/auth/register", json=body).status_code == 201
    client.post("/api/auth/logout")
    monkeypatch.setattr(settings, "allow_registration", False)
    assert client.post("/api/auth/login", json=body).status_code == 200
    assert client.get("/api/auth/me").json()["email"] == "a@b.com"
```

Move the three new import lines to the top of the file (Ruff's import sorting will otherwise flag them).

- [ ] **Step 3: Run and watch them fail**

Run (from `backend/`): `uv run pytest tests/test_auth.py -v`
Expected: `test_register_is_403_when_registration_closed` FAILS with `assert 201 == 403` (the route isn't gated yet). `test_existing_user_can_log_in_when_registration_closed` passes already (it guards against over-blocking); the existing four pass.

- [ ] **Step 4: Implement**

`backend/app/routers/auth.py`, add after `router = APIRouter(...)`:

```python
def require_registration_open() -> None:
    # Deployment configuration, not a business rule, so it is enforced here.
    if not settings.allow_registration:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Registration is closed")
```

and change the register decorator to:

```python
@router.post(
    "/register",
    response_model=UserRead,
    status_code=201,
    dependencies=[Depends(require_registration_open)],
)
```

- [ ] **Step 5: Run the full backend suite and lint**

Run (from `backend/`):
```
uv run pytest -v
uv run ruff check . && uv run ruff format --check .
```
Expected: 10 passed (8 existing + 2 new); Ruff clean.

- [ ] **Step 6: Confirm the API schema is unchanged** (the frontend's generated types must not drift)

Run (from `backend/`):
```
DATABASE_URL=postgresql+psycopg://x:x@localhost:1/x JWT_SECRET=0123456789abcdef0123456789abcdef uv run python -c "import json; from app.main import app; print(json.dumps(app.openapi()))" > /private/tmp/claude-501/-Users-christopherguzman-Desktop-coding-projects-expense-tracker/b0fc6bb7-4815-4230-ab77-a7d0e2cb5d4d/scratchpad/openapi.json
cd ../frontend && npx openapi-typescript /private/tmp/claude-501/-Users-christopherguzman-Desktop-coding-projects-expense-tracker/b0fc6bb7-4815-4230-ab77-a7d0e2cb5d4d/scratchpad/openapi.json -o /private/tmp/claude-501/-Users-christopherguzman-Desktop-coding-projects-expense-tracker/b0fc6bb7-4815-4230-ab77-a7d0e2cb5d4d/scratchpad/schema.d.ts && diff -q src/api/schema.d.ts /private/tmp/claude-501/-Users-christopherguzman-Desktop-coding-projects-expense-tracker/b0fc6bb7-4815-4230-ab77-a7d0e2cb5d4d/scratchpad/schema.d.ts && echo "schema unchanged"
```
Expected: `schema unchanged`. If it differs, run `npm run gen:api` against a running backend on port 8010 and commit the regenerated file.

- [ ] **Step 7: Commit**

```bash
git add backend/app/config.py backend/app/routers/auth.py backend/tests/conftest.py backend/tests/test_auth.py
git commit -m "feat(auth): registration closed unless ALLOW_REGISTRATION is set

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Frontend

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`
- Test: `frontend/src/pages/RegisterPage.test.tsx`

**Interfaces:**
- Consumes: the 403 `{"detail": "Registration is closed"}` response from Task 1.

- [ ] **Step 1: Add the test for the closed message**

In `frontend/src/pages/RegisterPage.test.tsx`, add inside the `describe("RegisterPage", ...)` block, after the 409 test:

```tsx
  it("shows that registration is closed on 403", async () => {
    server.use(
      http.post("/api/auth/register", () =>
        HttpResponse.json({ detail: "Registration is closed" }, { status: 403 }),
      ),
    );
    renderRegister();

    await fillAndSubmit("chris@example.com", "longenough");

    expect(await screen.findByRole("alert")).toHaveTextContent("Registration is closed");
  });
```

This documents behavior the page already has (it renders any server `detail`), so it is expected to pass on first run. Confirm it would catch a regression: temporarily change the expected text to `"Registration is open"`, run, see it FAIL, then restore.

- [ ] **Step 2: Remove the register link from the login page**

In `frontend/src/pages/LoginPage.tsx`, delete the paragraph containing `No account? <Link to="/register" className="underline">Register</Link>` (the whole `<p ...>...</p>` element). If `Link` is no longer used in the file, remove it from the `react-router-dom` import.

- [ ] **Step 3: Verify**

Run (from `frontend/`):
```
npx vitest run
npx tsc -b
npx eslint .
```
Expected: all tests pass (28: 27 existing + 1 new), tsc and ESLint clean. `grep -n "/register" src/pages/LoginPage.tsx` prints nothing.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.test.tsx
git commit -m "feat(frontend): drop the register link; show the closed-registration message

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Production config and docs

**Files:**
- Modify: `deploy/compose.yaml`, `deploy/README.md`, `docs/decisions/README.md`, `docs/devlog.md`
- Create: `docs/decisions/0017-registration-closed-by-default.md`

- [ ] **Step 1: Production compose**

In `deploy/compose.yaml`, inside the `x-api-env: &api-env` block, add after the `JWT_SECRET` line:

```yaml
  # Registration is closed unless .env sets ALLOW_REGISTRATION=true (first install only).
  ALLOW_REGISTRATION: ${ALLOW_REGISTRATION:-false}
```

Verify (from `deploy/`), with throwaway values:
```
POSTGRES_PASSWORD=x JWT_SECRET=x RESTIC_REPOSITORY=x RESTIC_PASSWORD=x AWS_ACCESS_KEY_ID=x AWS_SECRET_ACCESS_KEY=x HC_BACKUP_URL=x HC_DRILL_URL=x docker compose config | grep ALLOW_REGISTRATION
```
Expected: `ALLOW_REGISTRATION: "false"` for both `api` and `migrate`.

- [ ] **Step 2: Setup guide**

In `deploy/README.md`, one-time setup step 9, replace the sentence
`Open \`https://<vm-name>.<tailnet>.ts.net\` from any device on your tailnet and register.`
with:

````markdown
   Open `https://<vm-name>.<tailnet>.ts.net` from any device on your tailnet.

   **Create your account.** Registration is closed by default. Open it just long enough to
   sign up:
   ```
   echo 'ALLOW_REGISTRATION=true' >> .env && docker compose up -d
   ```
   Register in the app, then close it again and confirm a sign-up attempt is refused (`403`):
   ```
   sed -i '/^ALLOW_REGISTRATION=/d' .env && docker compose up -d
   curl -s -o /dev/null -w '%{http_code}\n' -X POST -H 'Content-Type: application/json' \
     -d '{"email":"probe@example.com","password":"longenough"}' http://127.0.0.1:8080/api/auth/register
   ```
````

Keep the Serve/Funnel sentences that follow. In the "If the VM is gone" list, add one sentence after the final `docker compose up -d` step: `No registration is needed; the restore brings your account back.`

- [ ] **Step 3: Decision record 17**

Create `docs/decisions/0017-registration-closed-by-default.md`:

```markdown
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
```

In `docs/decisions/README.md`, append a row after record 16:

```markdown
| 17 | [Registration is closed by default](0017-registration-closed-by-default.md) | 2026-10-12 |
```

- [ ] **Step 4: Devlog**

In `docs/devlog.md`, insert this section before the line starting with `**Next:**` in the 2026-10-12 entry, and change that `**Next:**` line to drop "close registration now that the one account exists; ":

```markdown
Closing registration: the app had one account but still accepted sign-ups from any device on
the tailnet. Registration is now off unless `ALLOW_REGISTRATION` is set, returning 403
otherwise; the setup guide opens it only for the first sign-up
([decision 17](decisions/0017-registration-closed-by-default.md)).
```

- [ ] **Step 5: Commit**

```bash
git add deploy/compose.yaml deploy/README.md docs/decisions docs/devlog.md
git commit -m "docs: production config and setup guide for closed registration; decision 17

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## After the plan (controller and owner)

1. Owner adds `ALLOW_REGISTRATION=true` to `backend/.env` and `backend/.env.example` (agents are blocked from env files), commits the example file, pushes.
2. Push, open the PR into `dev`, CI green, squash-merge; land `dev` in `main` (merge commit), which publishes images.
3. On the VM, from `~/expense-tracker`: re-download `compose.yaml`, `docker compose pull`, `docker compose up -d`, then the `curl` probe from Task 3 Step 2 must print `403`, and logging in on the phone/laptop still works.
