# UI Redesign and Home-Screen App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the expense tracker into a phone-first "bold and colorful" app (gradient header, category colors and emoji, donut breakdown, light/dark/system theme) and make it installable on the iPhone home screen.

**Architecture:** One small backend change (categories gain `color` and `icon`). Everything else is frontend: theme tokens as CSS variables swapped by `data-theme` on `<html>`, a handful of hand-built components on Tailwind v4, tab screens inside `AppLayout` and "pushed" screens (new expense, expense detail, new category, settings) outside it, and a web app manifest plus nginx cache headers. No new runtime dependencies.

**Tech Stack:** FastAPI, SQLAlchemy 2, Alembic, Pydantic v2 (backend); React 19, TypeScript ~5.9, Vite, Tailwind v4, TanStack Query, React Router 7, React Hook Form + Zod 4, Vitest + RTL + MSW (frontend); nginx 1.27.

**Spec:** `docs/superpowers/specs/2026-10-12-ui-redesign-design.md`

## Global Constraints

- No new runtime dependencies. One new devDependency only: `@resvg/resvg-js@2.6.2` (icon generation, Task 12).
- Money is never floating point: amounts are decimal strings; all arithmetic on integer cents via `src/lib/money.ts`.
- Category palette names, exactly: `amber`, `emerald`, `sky`, `violet`, `rose`, `orange`, `teal`, `indigo`, `lime`, `slate`.
- Category defaults: color `slate`, icon `🏷️`. Icon length limit 16 (code points), min 1. Name 1..50.
- Gradient: `linear-gradient(135deg, #2563eb, #7c3aed)`.
- Theme `localStorage` key `theme`, values `light` | `dark` | `system`, default `system`. Breakdown card key `breakdown-collapsed` (`"true"`/`"false"`), default expanded.
- Wide-screen breakpoint: Tailwind `md` (768px).
- Tap targets ≥ 44px (`min-h-11`/`size-11`); form inputs use 16px text (`text-base`).
- Tests query by role/label/text, never by CSS class.
- Ownership rules unchanged: every category/expense query scoped to the current user; other users' rows are 404.
- Pushed screens use `Screen` with an explicit `backTo` route (standalone home-screen apps have no browser back).
- Home-screen name `Expenses`; manifest `name` and browser tab title `Expense Tracker`.
- No service worker.
- Do not commit `CLAUDE.md`. Never read or edit `.env` / `.env.example`.
- Conventional commits; every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Run backend tooling from `backend/` with `uv run ...`; frontend tooling from `frontend/`.

## Pull requests

| PR | Branch (from `dev`) | Tasks |
|---|---|---|
| 1 | `feat/category-appearance` (already exists, has the spec commit) | 1, 2 |
| 2 | `feat/ui-foundation` | 3, 4, 5, 6, 7 |
| 3 | `feat/ui-screens` | 8, 9, 10, 11 |
| 4 | `feat/home-screen-app` | 12, 13 |

**PR checkpoint (after Tasks 2, 7, 11, 13):** push the branch, open a PR against `dev`, wait for CI (`backend`, `frontend`, `docker`) to pass and for the owner to approve the merge. Squash-merge, delete the branch, `git checkout dev && git pull`, then create the next branch from the updated `dev`. Each UI PR description includes this manual checklist for the owner: phone width (390px) in devtools, dark mode, laptop width, and (after deploy) the real iPhone.

## File map

Backend
- Modify `backend/app/models/expense.py` — `Category.color`, `Category.icon`
- Create `backend/alembic/versions/<rev>_add_category_color_and_icon.py`
- Modify `backend/app/schemas/expense.py` — `CategoryColor`, fields on create/read/summary
- Modify `backend/app/services/expenses.py` — `create_category` signature, summary columns
- Modify `backend/app/routers/expenses.py` — pass color/icon
- Modify `backend/tests/test_expenses.py` — new tests
- Modify `frontend/src/api/schema.d.ts` — regenerated

Frontend lib
- Modify `src/lib/money.ts` (+ test) — sign-safe cents, `formatCents`, `formatUsd`, `sharePercent`
- Create `src/lib/dates.ts` (+ test) — local-date helpers moved out of `ExpensesPage`, labels, month math
- Create `src/lib/palette.ts` (+ test) — palette names, labels, CSS variable lookup
- Create `src/lib/theme.ts` (+ test) — theme preference, resolution, system watcher

Frontend components (`src/components/`)
- `icons.tsx`, `styles.ts`, `Button.tsx`, `Card.tsx`, `Field.tsx`, `Screen.tsx`, `TabBar.tsx`, `GradientHeader.tsx`, `CategoryChip.tsx`, `MoneyText.tsx`, `Donut.tsx`, `AuthCard.tsx` (+ tests for Donut, Screen, CategoryChip)

Frontend pages (`src/pages/`, `src/auth/`)
- Modify `src/auth/AppLayout.tsx` (+ test)
- Create `src/pages/SettingsPage.tsx` (+ test)
- Modify `LoginPage.tsx`, `RegisterPage.tsx`
- Rewrite `ExpensesPage.tsx` (+ test); create `BreakdownCard.tsx`, `ExpenseList.tsx`
- Create `NewExpensePage.tsx`, `ExpenseDetailPage.tsx` (+ tests)
- Create `CategoryForm.tsx`, `NewCategoryPage.tsx` (+ test); rewrite `CategoriesPage.tsx` (+ test)
- Rewrite `SummaryPage.tsx` (+ test)
- Modify `src/router.tsx`, `src/main.tsx`, `src/index.css`, `index.html`, `src/test/setup.ts`
- Modify `src/api/expenses.ts`, `src/api/categories.ts`, `src/api/summary.ts`

Home-screen app
- Create `public/icon.svg`, `public/apple-touch-icon.png`, `public/icon-192.png`, `public/icon-512.png`, `public/manifest.webmanifest`, `scripts/gen-icons.mjs`, `src/pwa.test.ts`
- Delete `public/favicon.svg` (Vite's default logo, replaced by `icon.svg`)
- Modify `frontend/nginx.conf`, `frontend/package.json`

Docs
- `docs/devlog.md`, `docs/lessons-learned.md`, `docs/decisions/0018-hand-built-ui-components.md`, `docs/decisions/0015-mobile-access-as-home-screen-web-app.md`, `docs/decisions/README.md`, `deploy/README.md`

---

## PR 1 — `feat/category-appearance`

### Task 1: Categories get a color and an icon (backend)

**Files:**
- Modify: `backend/app/models/expense.py:19-27`
- Create: `backend/alembic/versions/<generated>_add_category_color_and_icon.py`
- Modify: `backend/app/schemas/expense.py`
- Modify: `backend/app/services/expenses.py:27-36` and `:93-114`
- Modify: `backend/app/routers/expenses.py:22-30`
- Test: `backend/tests/test_expenses.py`
- Modify (generated): `frontend/src/api/schema.d.ts`

**Interfaces:**
- Produces (API): `POST /api/categories` accepts optional `color` (one of the ten palette names, default `"slate"`) and `icon` (1..16 chars, default `"🏷️"`). `CategoryRead`, `ExpenseRead.category` and `CategorySummary` all include `color` and `icon`. Bad color or icon → 422.
- Produces (TS, generated): `components["schemas"]["CategoryRead"]["color"]` is the union `"amber" | "emerald" | ... | "slate"`.
- Produces (service): `create_category(db, user_id: int, name: str, color: str, icon: str) -> Category`.

- [ ] **Step 1: Start the database**

From the repo root: `docker compose up -d db`

- [ ] **Step 2: Write the failing tests**

Append to `backend/tests/test_expenses.py` (add `import pytest` as the first line of the file):

```python
def test_category_color_and_icon_round_trip(client):
    signup(client, "a@b.com")
    r = client.post(
        "/api/categories", json={"name": "Food", "color": "amber", "icon": "🍔"}
    )
    assert r.status_code == 201, r.text
    cat = r.json()
    assert cat == {"id": cat["id"], "name": "Food", "color": "amber", "icon": "🍔"}
    assert client.get("/api/categories").json() == [cat]

    exp = client.post(
        "/api/expenses",
        json={"category_id": cat["id"], "amount": "3.00", "spent_on": "2026-08-30"},
    ).json()
    assert exp["category"] == cat


def test_category_color_and_icon_default_when_omitted(client):
    signup(client, "a@b.com")
    cat = client.post("/api/categories", json={"name": "Food"}).json()
    assert cat["color"] == "slate"
    assert cat["icon"] == "🏷️"


def test_category_accepts_multi_codepoint_emoji(client):
    signup(client, "a@b.com")
    r = client.post("/api/categories", json={"name": "Family", "icon": "👨‍👩‍👧"})
    assert r.status_code == 201, r.text
    assert r.json()["icon"] == "👨‍👩‍👧"


@pytest.mark.parametrize(
    "extra",
    [{"color": "chartreuse"}, {"icon": ""}, {"icon": "x" * 17}],
)
def test_category_rejects_bad_color_or_icon(client, extra):
    signup(client, "a@b.com")
    r = client.post("/api/categories", json={"name": "Food", **extra})
    assert r.status_code == 422
    assert client.get("/api/categories").json() == []


def test_summary_includes_color_and_icon(client):
    signup(client, "a@b.com")
    food = client.post(
        "/api/categories", json={"name": "Food", "color": "amber", "icon": "🍔"}
    ).json()["id"]
    client.post(
        "/api/expenses",
        json={"category_id": food, "amount": "10.00", "spent_on": "2026-08-01"},
    )
    assert client.get("/api/summary?year=2026&month=8").json() == [
        {
            "category_id": food,
            "name": "Food",
            "color": "amber",
            "icon": "🍔",
            "total": "10.00",
        }
    ]
```

- [ ] **Step 3: Run the tests to verify they fail**

Run (from `backend/`): `uv run pytest tests/test_expenses.py -v`
Expected: the five new tests (seven cases) FAIL (missing `color`/`icon` keys, 201 instead of 422); the four existing tests PASS.

- [ ] **Step 4: Add the columns to the model**

In `backend/app/models/expense.py`, `Category` becomes:

```python
class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (UniqueConstraint("user_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(50))
    # Server defaults fill existing rows when the migration adds the columns.
    color: Mapped[str] = mapped_column(String(20), server_default="slate")
    icon: Mapped[str] = mapped_column(String(16), server_default="🏷️")
```

- [ ] **Step 5: Update the schemas**

In `backend/app/schemas/expense.py`, add `from typing import Literal` to the imports and replace the two category classes and `CategorySummary`:

```python
# Must match the frontend palette (frontend/src/lib/palette.ts). Validated here
# only, not with a database CHECK, so adding a color is a code change.
CategoryColor = Literal[
    "amber", "emerald", "sky", "violet", "rose",
    "orange", "teal", "indigo", "lime", "slate",
]


class CategoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=50)
    color: CategoryColor = "slate"
    # Any short text; not checked to be an emoji (that needs a Unicode library).
    # 16 code points leaves room for multi-part emoji such as 👨‍👩‍👧.
    icon: str = Field(default="🏷️", min_length=1, max_length=16)


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    color: CategoryColor
    icon: str
```

and

```python
class CategorySummary(BaseModel):
    category_id: int
    name: str
    color: CategoryColor
    icon: str
    total: Decimal
```

(Ruff format may wrap the `Literal[...]` differently; accept its formatting.)

- [ ] **Step 6: Update the service**

In `backend/app/services/expenses.py`, replace `create_category`:

```python
def create_category(
    db: Session, user_id: int, name: str, color: str, icon: str
) -> Category:
    cat = Category(user_id=user_id, name=name, color=color, icon=icon)
    db.add(cat)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise NameTaken()
    db.refresh(cat)
    return cat
```

and in `summary_by_category`, select the two new columns and return them:

```python
    q = (
        select(
            Category.id,
            Category.name,
            Category.color,
            Category.icon,
            func.coalesce(func.sum(Expense.amount), 0).label("total"),
        )
```

(the `.join(...)`, `.where(...)`, `.group_by(Category.id)` and `.order_by(...)` lines stay exactly as they are; grouping by the primary key lets Postgres select the other category columns)

```python
    return [
        {"category_id": r[0], "name": r[1], "color": r[2], "icon": r[3], "total": r[4]}
        for r in db.execute(q)
    ]
```

- [ ] **Step 7: Update the router**

In `backend/app/routers/expenses.py`, `create_category`'s call becomes:

```python
        return svc.create_category(db, user.id, body.name, body.color, body.icon)
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `uv run pytest -v`
Expected: all tests PASS (the test database is built with `create_all`, so it already has the columns).

- [ ] **Step 9: Generate the migration and read it**

Run: `uv run alembic revision --autogenerate -m "add category color and icon"`

Open the new file in `backend/alembic/versions/`. Its `upgrade()` and `downgrade()` must contain only these operations (formatting may differ; nothing touching other tables — if anything else appears, stop: model imports are broken):

```python
def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('categories', sa.Column('color', sa.String(length=20), server_default='slate', nullable=False))
    op.add_column('categories', sa.Column('icon', sa.String(length=16), server_default='🏷️', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('categories', 'icon')
    op.drop_column('categories', 'color')
```

- [ ] **Step 10: Apply and check the migration**

Run: `uv run alembic upgrade head && uv run alembic check`
Expected: upgrade succeeds; `check` prints `No new upgrade operations detected.`

- [ ] **Step 11: Lint**

Run: `uv run ruff check --fix . && uv run ruff format .`
Expected: no errors.

- [ ] **Step 12: Regenerate the frontend API types**

From `backend/` (same method as CI; needs no server or database):

```bash
DATABASE_URL=postgresql+psycopg://unused:unused@localhost:1/unused \
JWT_SECRET=ci-only-jwt-secret-not-used-anywhere-else-0123456789 \
uv run --no-sync python -c "import json; from app.main import app; print(json.dumps(app.openapi()))" > "${TMPDIR:-/tmp}/openapi.json"
cd ../frontend && npx openapi-typescript "${TMPDIR:-/tmp}/openapi.json" -o src/api/schema.d.ts
```

Verify: `grep -n '"amber"' src/api/schema.d.ts` shows the union in `CategoryCreate`, `CategoryRead` and `CategorySummary`.

- [ ] **Step 13: Frontend still type-checks and passes**

Run (from `frontend/`): `npx tsc -b && npx vitest run`
Expected: PASS (existing frontend tests use their own local fixture types, so the new fields don't affect them).

- [ ] **Step 14: Commit**

```bash
git add backend/app backend/alembic/versions backend/tests frontend/src/api/schema.d.ts
git commit -m "feat: categories have a color and an emoji icon

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Devlog catch-up

**Files:**
- Modify: `docs/devlog.md` (append)

- [ ] **Step 1: Append the entry**

Append to `docs/devlog.md`:

```markdown
## 2026-10-12 — Rolling out closed registration; designing the redesign

Rolled the closed-registration release out to the VM. The first attempt ran the commands from
the home directory instead of `~/expense-tracker`, so compose found no `.env`. Nothing changed:
the production compose file requires every secret with `${VAR:?}`, so compose refused to start
instead of running with blank secrets. Re-ran from the right directory; the closure probe
returned `403`.

A false alarm along the way: my account seemed to be missing when logging in from my phone. It
was a typo on the phone keyboard. Worth remembering that checking the simple explanation first
(log in again, carefully) beats digging into the database.

Then designed the UI redesign with mockups in a browser companion: a bold gradient style,
category colors and emoji, a donut breakdown that can collapse, separate screens for adding and
viewing an expense, a responsive layout for the laptop, light/dark/system themes, and a
home-screen icon so the app launches full screen on the iPhone. Wrote the
[spec](superpowers/specs/2026-10-12-ui-redesign-design.md) and a four-PR plan. Longer phone
sessions are deliberately a separate, later project because they change auth.
```

- [ ] **Step 2: Commit**

```bash
git add docs/devlog.md
git commit -m "docs: devlog for the registration rollout and the redesign design

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**PR checkpoint:** open PR 1 (`feat/category-appearance` → `dev`), title `feat: categories have a color and an emoji icon`. Body: what changed, the migration (adds two columns with defaults; existing categories become slate/🏷️), and that it carries the redesign spec and devlog notes. Wait for CI and owner approval; squash-merge; update `dev`; create `feat/ui-foundation`.

---

## PR 2 — `feat/ui-foundation`

### Task 3: Money and date helpers

**Files:**
- Modify: `frontend/src/lib/money.ts`
- Modify: `frontend/src/lib/money.test.ts`
- Create: `frontend/src/lib/dates.ts`
- Create: `frontend/src/lib/dates.test.ts`
- Modify: `frontend/src/pages/ExpensesPage.tsx` (import date helpers instead of local copies)
- Modify: `docs/lessons-learned.md` (Frontend section)

**Interfaces:**
- Produces (`src/lib/money.ts`): `toCents(amount: string): number`, `formatAmount(amount: string): string` (unchanged behavior for positives), `sumAmounts(amounts: string[]): string`, `formatCents(cents: number): string` (`123456` → `"$1,234.56"`), `formatUsd(amount: string): string` (`"1284.5"` → `"$1,284.50"`), `sharePercent(partCents: number, totalCents: number): number` (integer percent, 0 when total is 0).
- Produces (`src/lib/dates.ts`): `formatLocal(d: Date): string`, `localToday(): string`, `addDays(iso: string, days: number): string`, `dayLabel(iso: string, today?: string): string`, `longDate(iso: string): string`, `currentMonthValue(): string` (`"YYYY-MM"`), `shiftMonth(value: string, delta: number): string`, `monthLabel(value: string): string` (`"October 2026"`), `monthName(value: string): string` (`"October"`).

- [ ] **Step 1: Write the failing money tests**

Replace `frontend/src/lib/money.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { formatAmount, formatCents, formatUsd, sharePercent, sumAmounts, toCents } from "./money";

describe("toCents", () => {
  it("converts decimal strings to integer cents, including negatives", () => {
    expect(toCents("0")).toBe(0);
    expect(toCents("12.5")).toBe(1250);
    expect(toCents("12.50")).toBe(1250);
    expect(toCents("-12.5")).toBe(-1250);
    expect(toCents("-0.05")).toBe(-5);
  });
});

describe("formatAmount", () => {
  it("normalizes decimal strings to two places", () => {
    expect(formatAmount("0")).toBe("0.00");
    expect(formatAmount("12.5")).toBe("12.50");
    expect(formatAmount("12.50")).toBe("12.50");
    expect(formatAmount("1234567890.99")).toBe("1234567890.99");
    expect(formatAmount("-0.5")).toBe("-0.50");
  });
});

describe("sumAmounts", () => {
  it("adds decimal strings exactly, without float error", () => {
    expect(sumAmounts(["0.10", "0.20"])).toBe("0.30");
    expect(sumAmounts(["12.50", "0", "900.00"])).toBe("912.50");
    expect(sumAmounts([])).toBe("0.00");
    expect(sumAmounts(["-12.50", "2.00"])).toBe("-10.50");
  });
});

describe("formatUsd / formatCents", () => {
  it("adds a dollar sign and thousands separators", () => {
    expect(formatUsd("1284.5")).toBe("$1,284.50");
    expect(formatUsd("0")).toBe("$0.00");
    expect(formatUsd("999.99")).toBe("$999.99");
    expect(formatUsd("1234567890.99")).toBe("$1,234,567,890.99");
    expect(formatCents(123456)).toBe("$1,234.56");
  });

  it("puts the minus sign before the dollar sign", () => {
    expect(formatUsd("-12.5")).toBe("-$12.50");
    expect(formatUsd("-0.05")).toBe("-$0.05");
  });
});

describe("sharePercent", () => {
  it("rounds to a whole percent and handles a zero total", () => {
    expect(sharePercent(1, 3)).toBe(33);
    expect(sharePercent(2, 3)).toBe(67);
    expect(sharePercent(90000, 91250)).toBe(99);
    expect(sharePercent(0, 0)).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `frontend/`): `npx vitest run src/lib/money.test.ts`
Expected: FAIL — `toCents`/`formatCents`/`formatUsd`/`sharePercent` not exported; negative cases wrong.

- [ ] **Step 3: Implement**

Replace `frontend/src/lib/money.ts` with:

```ts
// Amounts are decimal strings from the API (NUMERIC(12,2)). We never put them
// through floating point: all arithmetic is on integer cents.

export function toCents(amount: string): number {
  // The sign is handled separately: "-12.5" is -(12 dollars + 50 cents), not -12 + 50.
  const negative = amount.startsWith("-");
  const [whole, frac = ""] = (negative ? amount.slice(1) : amount).split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return negative ? -cents : cents;
}

function splitCents(cents: number): { sign: string; dollars: string; frac: string } {
  const abs = Math.abs(cents);
  return {
    sign: cents < 0 ? "-" : "",
    dollars: String(Math.floor(abs / 100)),
    frac: String(abs % 100).padStart(2, "0"),
  };
}

function fromCents(cents: number): string {
  const { sign, dollars, frac } = splitCents(cents);
  return `${sign}${dollars}.${frac}`;
}

export function formatAmount(amount: string): string {
  return fromCents(toCents(amount));
}

export function sumAmounts(amounts: string[]): string {
  return fromCents(amounts.reduce((acc, a) => acc + toCents(a), 0));
}

export function formatCents(cents: number): string {
  const { sign, dollars, frac } = splitCents(cents);
  return `${sign}$${dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
}

export function formatUsd(amount: string): string {
  return formatCents(toCents(amount));
}

export function sharePercent(partCents: number, totalCents: number): number {
  return totalCents === 0 ? 0 : Math.round((partCents * 100) / totalCents);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run src/lib/money.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the failing date tests**

Create `frontend/src/lib/dates.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { addDays, currentMonthValue, dayLabel, formatLocal, longDate, monthLabel, monthName, shiftMonth } from "./dates";

describe("local date helpers", () => {
  it("formats a Date as a local YYYY-MM-DD string", () => {
    expect(formatLocal(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("labels days relative to today", () => {
    expect(dayLabel("2026-10-12", "2026-10-12")).toBe("Today");
    expect(dayLabel("2026-10-10", "2026-10-12")).toBe("Oct 10");
    expect(dayLabel("2025-03-05", "2026-10-12")).toBe("Mar 5, 2025");
  });

  it("writes a long date for the detail screen", () => {
    expect(longDate("2026-10-10")).toBe("Saturday, October 10, 2026");
  });
});

describe("month helpers", () => {
  it("returns the current month as YYYY-MM", () => {
    expect(currentMonthValue()).toMatch(/^\d{4}-\d{2}$/);
  });

  it("shifts months across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-10", 0)).toBe("2026-10");
  });

  it("labels months", () => {
    expect(monthLabel("2026-10")).toBe("October 2026");
    expect(monthName("2026-10")).toBe("October");
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npx vitest run src/lib/dates.test.ts`
Expected: FAIL — module `./dates` not found.

- [ ] **Step 7: Implement**

Create `frontend/src/lib/dates.ts`:

```ts
// Dates here are local calendar dates as "YYYY-MM-DD" strings, matching the
// API's spent_on. Parsing goes through new Date(y, m - 1, d) so the browser's
// time zone never shifts a date by one.

const pad = (n: number) => String(n).padStart(2, "0");

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localToday(): string {
  return formatLocal(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parse(iso);
  return formatLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

export function dayLabel(iso: string, today: string = localToday()): string {
  if (iso === today) return "Today";
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(parse(iso));
}

export function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parse(iso));
}

// Month values are "YYYY-MM", the same shape as <input type="month">.
export function currentMonthValue(): string {
  return localToday().slice(0, 7);
}

export function shiftMonth(value: string, delta: number): string {
  const [y, m] = value.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(parse(`${value}-01`));
}

export function monthName(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(parse(`${value}-01`));
}
```

- [ ] **Step 8: Point ExpensesPage at the shared helpers**

In `frontend/src/pages/ExpensesPage.tsx`, add `import { addDays, localToday } from "../lib/dates";` to the imports and delete the three local functions at the bottom of the file (`localToday`, `addDays`, `formatLocal`). Nothing else in the file changes.

- [ ] **Step 9: Run the frontend checks**

Run: `npx vitest run && npx tsc -b && npm run lint`
Expected: all PASS.

- [ ] **Step 10: Lessons entry**

In `docs/lessons-learned.md`, at the end of the `## Frontend` section (before `## Local development`), add:

```markdown
**Negative amounts would have been off by a dollar** (found while planning the redesign, 2026-10-12)
- *Cause:* `toCents("-12.5")` split on the dot and computed `-12 * 100 + 50 = -1150`, adding
  the cents to a negative whole part. Formatting `-50` cents also lost the sign (`-0` prints as
  `0`).
- *Impact:* none yet; amounts are always positive today. Refunds and imported bank
  transactions will be negative.
- *Fix:* handle the sign separately from the digits, with tests for negative values.
```

- [ ] **Step 11: Commit**

```bash
git add frontend/src/lib frontend/src/pages/ExpensesPage.tsx docs/lessons-learned.md
git commit -m "feat: dollar formatting, share percentages and shared date helpers

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Theme tokens, category palette, theme preference

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/index.html`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/test/setup.ts`
- Modify: `frontend/vite.config.ts` (let the palette test read `index.css`)
- Create: `frontend/src/lib/palette.ts`, `frontend/src/lib/palette.test.ts`
- Create: `frontend/src/lib/theme.ts`, `frontend/src/lib/theme.test.ts`
- Modify: `docs/lessons-learned.md` (Frontend section)

**Interfaces:**
- Consumes: `components["schemas"]["CategoryRead"]["color"]` from Task 1.
- Produces (Tailwind classes): `bg-app`, `bg-surface`, `text-fg`, `text-muted`, `border-line`, `ring-line`, `divide-line`, `text-accent`, `text-danger`, `bg-brand` (gradient utility).
- Produces (`src/lib/palette.ts`): `type CategoryColor`, `CATEGORY_COLORS: CategoryColor[]`, `colorLabel(color: CategoryColor): string`, `colorVar(color: string): string` (`"amber"` → `"var(--cat-amber)"`, unknown → `"var(--cat-slate)"`).
- Produces (`src/lib/theme.ts`): `type ThemePref = "light" | "dark" | "system"`, `getThemePref(): ThemePref`, `resolveTheme(pref: ThemePref): "light" | "dark"`, `applyTheme(pref: ThemePref): void`, `setThemePref(pref: ThemePref): void`, `watchSystemTheme(): () => void`.

- [ ] **Step 1: Reset storage and theme between tests**

Replace `frontend/src/test/setup.ts` with:

```ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./server";

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup(); // RTL only auto-cleans with vitest globals enabled
  server.resetHandlers();
  // Theme and the breakdown card persist to localStorage; keep tests independent.
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterAll(() => server.close());
```

- [ ] **Step 2: Write the theme tokens and palette CSS**

Replace `frontend/src/index.css` with:

```css
@import "tailwindcss";

/* Colors are variables so dark mode is one redefinition, not a second class
   on every element. data-theme on <html> is set before React loads by the
   inline script in index.html and afterwards by src/lib/theme.ts. */
:root {
  color-scheme: light;
  --app-bg: #f8fafc;
  --app-surface: #ffffff;
  --app-fg: #0f172a;
  --app-muted: #64748b;
  --app-line: #e2e8f0;
  --app-accent: #4f46e5;
  --app-danger: #dc2626;

  /* Category palette; names must match CategoryColor in the API. */
  --cat-amber: #f59e0b;
  --cat-emerald: #10b981;
  --cat-sky: #0ea5e9;
  --cat-violet: #8b5cf6;
  --cat-rose: #f43f5e;
  --cat-orange: #f97316;
  --cat-teal: #14b8a6;
  --cat-indigo: #6366f1;
  --cat-lime: #84cc16;
  --cat-slate: #64748b;
}

[data-theme="dark"] {
  color-scheme: dark;
  --app-bg: #0b1020;
  --app-surface: #151b2e;
  --app-fg: #f1f5f9;
  --app-muted: #94a3b8;
  --app-line: #26304a;
  --app-accent: #a5b4fc;
  --app-danger: #f87171;

  --cat-amber: #d97706;
  --cat-emerald: #059669;
  --cat-sky: #0284c7;
  --cat-violet: #7c3aed;
  --cat-rose: #e11d48;
  --cat-orange: #ea580c;
  --cat-teal: #0d9488;
  --cat-indigo: #4f46e5;
  --cat-lime: #65a30d;
  --cat-slate: #475569;
}

@theme inline {
  --color-app: var(--app-bg);
  --color-surface: var(--app-surface);
  --color-fg: var(--app-fg);
  --color-muted: var(--app-muted);
  --color-line: var(--app-line);
  --color-accent: var(--app-accent);
  --color-danger: var(--app-danger);
}

@utility bg-brand {
  background-image: linear-gradient(135deg, #2563eb, #7c3aed);
}

@layer base {
  body {
    background-color: var(--app-bg);
    color: var(--app-fg);
  }

  :focus-visible {
    outline: 2px solid var(--app-accent);
    outline-offset: 2px;
  }
}
```

- [ ] **Step 3: Write the failing palette test**

Create `frontend/src/lib/palette.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import css from "../index.css?raw";
import { CATEGORY_COLORS, colorLabel, colorVar } from "./palette";

describe("palette", () => {
  it("has exactly the ten colors the API accepts", () => {
    // The Record type in palette.ts also makes tsc fail if the generated API
    // union and this list drift apart.
    expect(CATEGORY_COLORS).toEqual([
      "amber", "emerald", "sky", "violet", "rose", "orange", "teal", "indigo", "lime", "slate",
    ]);
  });

  it("defines a light and a dark CSS variable for every color", () => {
    expect(css).toContain("--app-bg"); // guard: an empty read would pass the loop below
    for (const color of CATEGORY_COLORS) {
      expect(css.match(new RegExp(`--cat-${color}:`, "g")), color).toHaveLength(2);
    }
  });

  it("maps names to CSS variables, falling back to slate", () => {
    expect(colorVar("teal")).toBe("var(--cat-teal)");
    expect(colorVar("chartreuse")).toBe("var(--cat-slate)");
    expect(colorLabel("emerald")).toBe("Emerald");
  });
});
```

- [ ] **Step 4: Let tests read index.css**

Vitest replaces CSS imports with an empty string unless CSS processing is enabled, and that includes `?raw` imports (verified while planning: `import css from "../index.css?raw"` gave `''`). In `frontend/vite.config.ts`, change the `test` line to:

```ts
  // css.include: Vitest blanks CSS imports (even ?raw) unless processing is on;
  // the palette test reads index.css to check every color has both shades.
  test: { environment: "jsdom", setupFiles: "./src/test/setup.ts", css: { include: [/index\.css/] } },
```

In `docs/lessons-learned.md`, at the end of the `## Frontend` section (after the entry Task 3 added), add:

```markdown
**A test read the stylesheet and got an empty string** (found while planning, 2026-10-12)
- *Cause:* Vitest skips CSS processing by default and replaces every CSS import with an empty
  string, including `?raw` imports meant to read the file as text.
- *Fix:* `test.css.include` in the Vite config for `index.css` only.
- *Takeaway:* when a test reads a file, assert something about its content first, so an empty
  read fails loudly instead of passing vacuously.
```

- [ ] **Step 5: Run to verify failure**

Run: `npx vitest run src/lib/palette.test.ts`
Expected: FAIL — module `./palette` not found.

- [ ] **Step 6: Implement the palette**

Create `frontend/src/lib/palette.ts`:

```ts
import type { components } from "../api/schema";

export type CategoryColor = components["schemas"]["CategoryRead"]["color"];

// A Record keyed by the generated API union: tsc fails if the backend's color
// list and this one ever differ. Shades live in index.css as --cat-<name>.
const LABELS: Record<CategoryColor, string> = {
  amber: "Amber",
  emerald: "Emerald",
  sky: "Sky",
  violet: "Violet",
  rose: "Rose",
  orange: "Orange",
  teal: "Teal",
  indigo: "Indigo",
  lime: "Lime",
  slate: "Slate",
};

export const CATEGORY_COLORS = Object.keys(LABELS) as CategoryColor[];

export function colorLabel(color: CategoryColor): string {
  return LABELS[color];
}

export function colorVar(color: string): string {
  return color in LABELS ? `var(--cat-${color})` : "var(--cat-slate)";
}
```

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run src/lib/palette.test.ts`
Expected: PASS.

- [ ] **Step 8: Write the failing theme tests**

Create `frontend/src/lib/theme.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { applyTheme, getThemePref, resolveTheme, setThemePref, watchSystemTheme } from "./theme";

type Listener = () => void;

function stubSystemDark(initial: boolean) {
  const listeners: Listener[] = [];
  const mq = {
    matches: initial,
    media: "(prefers-color-scheme: dark)",
    addEventListener: (_: string, l: Listener) => listeners.push(l),
    removeEventListener: (_: string, l: Listener) => listeners.splice(listeners.indexOf(l), 1),
  };
  vi.stubGlobal("matchMedia", () => mq);
  return {
    set(dark: boolean) {
      mq.matches = dark;
      listeners.forEach((l) => l());
    },
    listenerCount: () => listeners.length,
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("theme", () => {
  it("defaults to system when nothing is stored", () => {
    expect(getThemePref()).toBe("system");
  });

  it("stores an explicit choice and applies it", () => {
    setThemePref("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(getThemePref()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    setThemePref("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("resolves system from the OS setting", () => {
    stubSystemDark(true);
    expect(resolveTheme("system")).toBe("dark");
    applyTheme("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("treats system as light when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);
    expect(resolveTheme("system")).toBe("light");
  });

  it("follows OS changes only while the preference is system", () => {
    const os = stubSystemDark(false);
    setThemePref("system");
    const stop = watchSystemTheme();

    os.set(true);
    expect(document.documentElement.dataset.theme).toBe("dark");

    setThemePref("light");
    os.set(false);
    os.set(true);
    expect(document.documentElement.dataset.theme).toBe("light");

    stop();
    expect(os.listenerCount()).toBe(0);
  });
});
```

- [ ] **Step 9: Run to verify failure**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: FAIL — module `./theme` not found.

- [ ] **Step 10: Implement the theme module**

Create `frontend/src/lib/theme.ts`:

```ts
export type ThemePref = "light" | "dark" | "system";

const STORAGE_KEY = "theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

export function getThemePref(): ThemePref {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // Storage can be unavailable (private mode); fall through to the default.
  }
  return "system";
}

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref === "system") return systemPrefersDark() ? "dark" : "light";
  return pref;
}

export function applyTheme(pref: ThemePref): void {
  document.documentElement.dataset.theme = resolveTheme(pref);
}

export function setThemePref(pref: ThemePref): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // Not persisted, but still applied for this visit.
  }
  applyTheme(pref);
}

// Re-applies the theme when the OS switches between light and dark while the
// preference is "system". Returns a function that stops watching.
export function watchSystemTheme(): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(DARK_QUERY);
  const onChange = () => {
    if (getThemePref() === "system") applyTheme("system");
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
```

- [ ] **Step 11: Run to verify pass**

Run: `npx vitest run src/lib/theme.test.ts`
Expected: PASS.

- [ ] **Step 12: No-flash script and viewport**

Replace `frontend/index.html` with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <title>Expense Tracker</title>
    <script>
      // Set the theme before first paint so dark mode doesn't flash white.
      // Mirrors resolveTheme() in src/lib/theme.ts. If a Content-Security-Policy
      // is ever added, this inline script needs a hash.
      (function () {
        var pref = null;
        try {
          pref = localStorage.getItem("theme");
        } catch (e) {}
        var dark =
          pref === "dark" ||
          (pref !== "light" && window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
        document.documentElement.dataset.theme = dark ? "dark" : "light";
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 13: Watch the OS theme at startup**

Replace `frontend/src/main.tsx` with:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { watchSystemTheme } from './lib/theme'

watchSystemTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 14: Run the frontend checks**

Run: `npx vitest run && npx tsc -b && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 15: Commit**

```bash
git add frontend/vite.config.ts docs/lessons-learned.md frontend/src/index.css frontend/index.html frontend/src/main.tsx frontend/src/test/setup.ts frontend/src/lib/palette.ts frontend/src/lib/palette.test.ts frontend/src/lib/theme.ts frontend/src/lib/theme.test.ts
git commit -m "feat: theme tokens, category palette and light/dark/system preference

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Component set and ADR 18

**Files:**
- Create: `frontend/src/components/icons.tsx`, `styles.ts`, `Button.tsx`, `Card.tsx`, `Field.tsx`, `Screen.tsx`, `CategoryChip.tsx`, `MoneyText.tsx`, `Donut.tsx`, `AuthCard.tsx`
- Test: `frontend/src/components/Donut.test.tsx`, `Screen.test.tsx`, `CategoryChip.test.tsx`
- Create: `docs/decisions/0018-hand-built-ui-components.md`
- Modify: `docs/decisions/README.md`

**Interfaces:**
- Consumes: `colorVar` (Task 4), `formatUsd` (Task 3).
- Produces:
  - `icons.tsx`: `ListIcon`, `PieIcon`, `GridIcon`, `GearIcon`, `PlusIcon`, `ChevronLeftIcon`, `ChevronRightIcon`, `TrashIcon`, each `({ className?: string }) => JSX`, `aria-hidden`.
  - `styles.ts`: `inputClass: string`.
  - `Button({ variant?: "primary" | "secondary" | "danger", type = "button", className, ...buttonProps })`.
  - `Card({ className?, children })`.
  - `Field({ label, htmlFor, error?, children })`.
  - `Screen({ title, backTo, backState?, children })`.
  - `CategoryChip({ category: { name: string; icon: string; color: string }, size?: "sm" | "md" | "lg" })`.
  - `MoneyText({ amount: string, className? })`.
  - `Donut({ segments: DonutSegment[], size?: number, thickness?: number })`, `type DonutSegment = { key: string | number; color: string; cents: number }`.
  - `AuthCard({ title, children })` — gradient page with centered white card, used by login/register.

- [ ] **Step 1: Write the failing component tests**

Create `frontend/src/components/Donut.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Donut } from "./Donut";

function segmentsIn(container: HTMLElement) {
  return [...container.querySelectorAll("circle[data-segment]")];
}

describe("Donut", () => {
  it("is hidden from assistive technology", () => {
    const { container } = render(<Donut segments={[{ key: 1, color: "red", cents: 100 }]} />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("draws one arc per positive segment, sized by share of the total", () => {
    const { container } = render(
      <Donut
        size={120}
        thickness={20}
        segments={[
          { key: 1, color: "red", cents: 300 },
          { key: 2, color: "blue", cents: 100 },
          { key: 3, color: "green", cents: 0 },
        ]}
      />,
    );
    const circumference = 2 * Math.PI * 50;
    const [first, second] = segmentsIn(container);
    expect(segmentsIn(container)).toHaveLength(2);
    expect(Number(first.getAttribute("stroke-dasharray")!.split(" ")[0])).toBeCloseTo(circumference * 0.75);
    expect(Number(second.getAttribute("stroke-dasharray")!.split(" ")[0])).toBeCloseTo(circumference * 0.25);
    expect(Number(second.getAttribute("stroke-dashoffset"))).toBeCloseTo(-circumference * 0.75);
  });

  it("draws only the track when there is nothing to show", () => {
    const { container } = render(<Donut segments={[]} />);
    expect(segmentsIn(container)).toHaveLength(0);
    expect(container.querySelectorAll("circle")).toHaveLength(1);
  });
});
```

Create `frontend/src/components/Screen.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Screen } from "./Screen";

function Home() {
  return <p>home {JSON.stringify(useLocation().state)}</p>;
}

describe("Screen", () => {
  it("shows the title and goes back to its backTo route, carrying backState", async () => {
    const router = createMemoryRouter(
      [
        { path: "/", element: <Home /> },
        {
          path: "/pushed",
          element: (
            <Screen title="New expense" backTo="/" backState={{ keep: 1 }}>
              <p>body</p>
            </Screen>
          ),
        },
      ],
      { initialEntries: ["/pushed"] },
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("heading", { name: "New expense" })).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole("link", { name: /back/i }));

    expect(await screen.findByText('home {"keep":1}')).toBeInTheDocument();
  });
});
```

Create `frontend/src/components/CategoryChip.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CategoryChip } from "./CategoryChip";

describe("CategoryChip", () => {
  it("shows the emoji, is decorative, and records its color", () => {
    const { container } = render(<CategoryChip category={{ name: "Food", icon: "🍔", color: "amber" }} />);
    const chip = container.firstElementChild!;
    expect(chip).toHaveTextContent("🍔");
    expect(chip).toHaveAttribute("aria-hidden", "true");
    expect(chip).toHaveAttribute("data-color", "amber");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/components`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the icons and styles**

Create `frontend/src/components/icons.tsx`:

```tsx
type IconProps = { className?: string };

const svgProps = {
  width: 24,
  height: 24,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function ListIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  );
}

export function PieIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
      <path d="M22 12A10 10 0 0 0 12 2v10z" />
    </svg>
  );
}

export function GridIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export function GearIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function ChevronLeftIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...svgProps} className={className}>
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </svg>
  );
}
```

Create `frontend/src/components/styles.ts`:

```ts
// text-base (16px) on purpose: iOS Safari zooms the page when a focused input
// is smaller than 16px.
export const inputClass =
  "min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-fg placeholder:text-muted";
```

- [ ] **Step 4: Implement the basic components**

Create `frontend/src/components/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-sm",
  secondary: "border border-line bg-surface text-fg",
  // Fixed red, not the theme's danger text color: white text needs the darker shade in both themes.
  danger: "bg-red-600 text-white",
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({ variant = "primary", type = "button", className = "", ...props }: Props) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...props}
    />
  );
}
```

Create `frontend/src/components/Card.tsx`:

```tsx
import type { ReactNode } from "react";

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl bg-surface shadow-sm ring-1 ring-line ${className}`}>{children}</div>;
}
```

Create `frontend/src/components/Field.tsx`:

```tsx
import type { ReactNode } from "react";

type Props = { label: string; htmlFor: string; error?: string; children: ReactNode };

export function Field({ label, htmlFor, error, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
```

Create `frontend/src/components/Screen.tsx`:

```tsx
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeftIcon } from "./icons";

type Props = { title: string; backTo: string; backState?: unknown; children: ReactNode };

// Shell for screens pushed on top of the tabs. A home-screen app has no browser
// back button, so every pushed screen carries its own, to a fixed route (the
// app may have been opened directly on this screen, with no history).
export function Screen({ title, backTo, backState, children }: Props) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto grid h-14 max-w-xl grid-cols-[5rem_1fr_5rem] items-center px-2">
          <Link to={backTo} state={backState} className="inline-flex min-h-11 items-center gap-0.5 px-1 font-medium text-accent">
            <ChevronLeftIcon className="size-5" />
            Back
          </Link>
          <h1 className="truncate text-center font-semibold">{title}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">{children}</main>
    </div>
  );
}
```

Create `frontend/src/components/CategoryChip.tsx`:

```tsx
import { colorVar } from "../lib/palette";

type Props = {
  category: { name: string; icon: string; color: string };
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: "size-8 rounded-lg text-base",
  md: "size-10 rounded-xl text-lg",
  lg: "size-14 rounded-2xl text-2xl",
};

// Decorative: the category name is always shown next to it, so color is never
// the only signal.
export function CategoryChip({ category, size = "md" }: Props) {
  return (
    <span
      aria-hidden="true"
      data-color={category.color}
      className={`inline-flex shrink-0 items-center justify-center ${SIZES[size]}`}
      style={{ backgroundColor: colorVar(category.color) }}
    >
      {category.icon}
    </span>
  );
}
```

Create `frontend/src/components/MoneyText.tsx`:

```tsx
import { formatUsd } from "../lib/money";

export function MoneyText({ amount, className = "" }: { amount: string; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatUsd(amount)}</span>;
}
```

Create `frontend/src/components/Donut.tsx`:

```tsx
export type DonutSegment = { key: string | number; color: string; cents: number };

type Props = { segments: DonutSegment[]; size?: number; thickness?: number };

// Hand-written SVG: one circle per segment, drawn as a dash whose length is the
// segment's share of the circumference. Decorative (aria-hidden): the same
// numbers are always shown as text beside it. Shares come from integer cents.
export function Donut({ segments, size = 120, thickness = 18 }: Props) {
  const center = size / 2;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const positive = segments.filter((s) => s.cents > 0);
  const total = positive.reduce((sum, s) => sum + s.cents, 0);
  const arcs = positive.reduce<{ segment: DonutSegment; start: number; length: number }[]>((acc, segment) => {
    const prev = acc.at(-1);
    const start = prev ? prev.start + prev.length : 0;
    return [...acc, { segment, start, length: (segment.cents / total) * circumference }];
  }, []);

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={center} cy={center} r={radius} fill="none" strokeWidth={thickness} style={{ stroke: "var(--app-line)" }} />
      {arcs.map(({ segment, start, length }) => (
        <circle
          key={segment.key}
          data-segment=""
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={thickness}
          strokeDasharray={`${length} ${circumference - length}`}
          strokeDashoffset={-start}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ stroke: segment.color }}
        />
      ))}
    </svg>
  );
}
```

Create `frontend/src/components/AuthCard.tsx`:

```tsx
import type { ReactNode } from "react";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 text-fg shadow-xl">
        <p className="text-sm font-medium text-muted">Expense Tracker</p>
        <h1 className="mb-6 text-2xl font-extrabold">{title}</h1>
        {children}
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run src/components && npx tsc -b && npm run lint`
Expected: PASS.

- [ ] **Step 6: Write ADR 18**

Create `docs/decisions/0018-hand-built-ui-components.md`:

```markdown
# 18. Hand-built UI components on Tailwind

- **Date:** 2026-10-12
- **Status:** Accepted

## Context

The redesign needs buttons, cards, form fields, a tab bar, a shell for pushed screens,
category chips and a donut chart, in a light and a dark theme, on a phone and a laptop. The
app already uses Tailwind and has no component library. It is a learning project whose code
should be explainable line by line.

## Decision

- A small component set in `frontend/src/components/`, built with Tailwind classes, no new
  runtime dependencies.
- Colors are CSS variables in `index.css`, redefined under `[data-theme="dark"]` and exposed to
  Tailwind with `@theme`. Components use `bg-surface`, `text-muted` and so on, never a
  light/dark pair.
- The donut is about 40 lines of hand-written SVG. It is decorative; the legend and lists show
  the same numbers as text.
- Category colors are ten named palette entries (`amber` … `slate`), validated by the API as a
  `Literal`. Each name has a light and a dark shade. The frontend's palette is a `Record` keyed
  by the generated API type, so the two lists can't drift without a type error.

## Alternatives considered

- **shadcn/ui.** Polished, accessible dialogs and menus built on Radix, copied into the repo.
  The design avoids dialogs and menus (adding and details are full screens), so it would add
  several dependencies for components we don't use.
- **A full UI library (Mantine, Chakra).** Fastest route to widgets, but brings its own styling
  system that competes with Tailwind, and the gradient look would mean overriding its theme
  everywhere.
- **A chart library (Recharts, Chart.js).** Tens of kilobytes for one donut.
- **Any hex color per category.** More freedom, but a color can be unreadable in one of the
  themes and has nothing to map to a dark shade.

## Consequences

- Every component is small and ours to explain; the bundle stays lean.
- Anything advanced (a modal, a date picker) would have to be built or a library adopted later.
- Adding a palette color is a code change in two places (API `Literal`, `index.css`), caught
  by tsc and a test if one side is missed.
```

In `docs/decisions/README.md`, add a row after the row for decision 17:

```markdown
| 18 | [Hand-built UI components on Tailwind](0018-hand-built-ui-components.md) | 2026-10-12 |
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components docs/decisions/0018-hand-built-ui-components.md docs/decisions/README.md
git commit -m "feat: hand-built component set (buttons, cards, screen shell, chips, donut)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 6: App shell, tab bar, gradient header and Settings

**Files:**
- Create: `frontend/src/components/TabBar.tsx`, `frontend/src/components/GradientHeader.tsx`
- Modify: `frontend/src/auth/AppLayout.tsx`, `frontend/src/auth/AppLayout.test.tsx`
- Create: `frontend/src/pages/SettingsPage.tsx`, `frontend/src/pages/SettingsPage.test.tsx`
- Modify: `frontend/src/router.tsx`
- Modify: `frontend/src/pages/ExpensesPage.tsx`, `CategoriesPage.tsx`, `SummaryPage.tsx` (heading moves into `GradientHeader`; interim until PR 3 rewrites them)

**Interfaces:**
- Consumes: `Screen`, `Card`, `Button`, icons (Task 5); `getThemePref`, `setThemePref`, `ThemePref` (Task 4); `useMe`, `useLogout`.
- Produces: `TabBar({ placement: "bottom" | "top" })` — bottom renders `<nav aria-label="Tab bar">` (hidden at `md`), top renders `<nav aria-label="Top navigation">` (shown at `md`); both have links Expenses (`/`), Summary (`/summary`), Categories (`/categories`). `GradientHeader({ children?, overlap?: boolean })` — renders the top-navigation tabs and a `Settings` link (gear, to `/settings`); `overlap` adds bottom padding for a card that overlaps it (pair with `-mt-10` on the content). `AppLayout` renders `<Outlet />` plus the bottom tab bar; tab pages render their own `GradientHeader`. `SettingsPage` at `/settings`.

- [ ] **Step 1: Write the failing tests**

Replace `frontend/src/auth/AppLayout.test.tsx` with:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { GradientHeader } from "../components/GradientHeader";
import { server } from "../test/server";
import { AppLayout } from "./AppLayout";
import { RequireAuth } from "./RequireAuth";

function renderLayout() {
  const router = createMemoryRouter(
    [
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppLayout />,
            children: [
              {
                path: "/",
                element: (
                  <GradientHeader>
                    <p>home content</p>
                  </GradientHeader>
                ),
              },
              { path: "/categories", element: <p>categories content</p> },
            ],
          },
          { path: "/settings", element: <p>settings screen</p> },
        ],
      },
      { path: "/login", element: <p>login page</p> },
    ],
    { initialEntries: ["/"] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const me = () => http.get("/api/auth/me", () => HttpResponse.json({ id: 1, email: "chris@example.com" }));

describe("AppLayout", () => {
  it("renders the child route with a tab bar", async () => {
    server.use(me());
    renderLayout();

    expect(await screen.findByText("home content")).toBeInTheDocument();
    const tabs = screen.getByRole("navigation", { name: "Tab bar" });
    expect(within(tabs).getAllByRole("link").map((l) => l.textContent)).toEqual(["Expenses", "Summary", "Categories"]);
  });

  it("switches tabs from the tab bar", async () => {
    server.use(me());
    renderLayout();
    await screen.findByText("home content");

    await userEvent.setup().click(within(screen.getByRole("navigation", { name: "Tab bar" })).getByRole("link", { name: "Categories" }));

    expect(await screen.findByText("categories content")).toBeInTheDocument();
  });

  it("opens settings from the header's gear button", async () => {
    server.use(me());
    renderLayout();

    await userEvent.setup().click(await screen.findByRole("link", { name: "Settings" }));

    expect(await screen.findByText("settings screen")).toBeInTheDocument();
  });

  it("puts the same tabs in the header for wide screens", async () => {
    server.use(me());
    renderLayout();

    const top = await screen.findByRole("navigation", { name: "Top navigation" });
    expect(within(top).getAllByRole("link").map((l) => l.textContent)).toEqual(["Expenses", "Summary", "Categories"]);
  });
});
```

Create `frontend/src/pages/SettingsPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { SettingsPage } from "./SettingsPage";

function renderSettings() {
  const router = createMemoryRouter(
    [
      { path: "/settings", element: <SettingsPage /> },
      { path: "/login", element: <p>login page</p> },
    ],
    { initialEntries: ["/settings"] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient };
}

const me = () => http.get("/api/auth/me", () => HttpResponse.json({ id: 1, email: "chris@example.com" }));

describe("SettingsPage", () => {
  it("shows the signed-in email", async () => {
    server.use(me());
    renderSettings();

    expect(await screen.findByText("chris@example.com")).toBeInTheDocument();
  });

  it("defaults the theme to System and applies and remembers a choice", async () => {
    server.use(me());
    renderSettings();
    const user = userEvent.setup();

    expect(screen.getByRole("radio", { name: "System" })).toBeChecked();

    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(screen.getByRole("radio", { name: "Dark" })).toBeChecked();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");

    await user.click(screen.getByRole("radio", { name: "Light" }));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("logs out, clears cached data, and goes to /login", async () => {
    let loggedOut = false;
    server.use(
      me(),
      http.post("/api/auth/logout", () => {
        loggedOut = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    const { queryClient } = renderSettings();
    await screen.findByText("chris@example.com");

    await userEvent.setup().click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByText("login page")).toBeInTheDocument();
    expect(loggedOut).toBe(true);
    expect(queryClient.getQueryData(["me"])).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/auth/AppLayout.test.tsx src/pages/SettingsPage.test.tsx`
Expected: FAIL — `GradientHeader` and `SettingsPage` modules not found.

- [ ] **Step 3: Implement TabBar and GradientHeader**

Create `frontend/src/components/TabBar.tsx`:

```tsx
import { NavLink } from "react-router-dom";
import { GridIcon, ListIcon, PieIcon } from "./icons";

const TABS = [
  { to: "/", label: "Expenses", Icon: ListIcon, end: true },
  { to: "/summary", label: "Summary", Icon: PieIcon, end: false },
  { to: "/categories", label: "Categories", Icon: GridIcon, end: false },
];

// Bottom bar on phones; on wide screens the same tabs sit in the gradient header.
export function TabBar({ placement }: { placement: "bottom" | "top" }) {
  if (placement === "top") {
    return (
      <nav aria-label="Top navigation" className="hidden gap-1 md:flex">
        {TABS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${
                isActive ? "bg-white/25 text-white" : "text-white/90 hover:bg-white/15"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Tab bar"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="grid grid-cols-3">
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                isActive ? "text-accent" : "text-muted"
              }`
            }
          >
            <Icon className="size-6" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
```

Create `frontend/src/components/GradientHeader.tsx`:

```tsx
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { GearIcon } from "./icons";
import { TabBar } from "./TabBar";

type Props = { children?: ReactNode; overlap?: boolean };

// The gradient band at the top of each tab. The status-bar inset keeps content
// clear of the notch when the app runs full screen. `overlap` leaves room for a
// card that overlaps the band (give the content below it -mt-10).
export function GradientHeader({ children, overlap = false }: Props) {
  return (
    <header className="bg-brand pt-[env(safe-area-inset-top)] text-white">
      <div className={`mx-auto max-w-5xl px-4 pt-2 ${overlap ? "pb-14" : "pb-6"}`}>
        <div className="flex min-h-11 items-center gap-2">
          <TabBar placement="top" />
          <Link
            to="/settings"
            aria-label="Settings"
            className="ml-auto inline-flex size-11 items-center justify-center rounded-full hover:bg-white/15"
          >
            <GearIcon className="size-6" />
          </Link>
        </div>
        {children}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Implement AppLayout**

Replace `frontend/src/auth/AppLayout.tsx` with:

```tsx
import { Outlet } from "react-router-dom";
import { TabBar } from "../components/TabBar";

// Tab screens render their own GradientHeader; this adds the bottom tab bar and
// the padding that keeps content above it (and above the home indicator).
export function AppLayout() {
  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-10">
      <Outlet />
      <TabBar placement="bottom" />
    </div>
  );
}
```

- [ ] **Step 5: Implement SettingsPage**

Create `frontend/src/pages/SettingsPage.tsx`:

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLogout, useMe } from "../api/auth";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { getThemePref, setThemePref, type ThemePref } from "../lib/theme";

const THEME_OPTIONS: { value: ThemePref; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function SettingsPage() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const [theme, setTheme] = useState<ThemePref>(getThemePref);

  function chooseTheme(pref: ThemePref) {
    setTheme(pref);
    setThemePref(pref);
  }

  async function onLogout() {
    await logout.mutateAsync();
    navigate("/login", { replace: true });
  }

  return (
    <Screen title="Settings" backTo="/">
      <div className="flex flex-col gap-4">
        <Card className="p-4">
          <p className="text-sm text-muted">Signed in as</p>
          <p className="font-semibold break-all">{me.data?.email}</p>
        </Card>

        <Card className="p-4">
          <fieldset>
            <legend className="mb-3 font-semibold">Theme</legend>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-app p-1">
              {THEME_OPTIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg text-sm font-medium has-focus-visible:outline-2 has-focus-visible:outline-accent ${
                    theme === value ? "bg-surface text-fg shadow-sm" : "text-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="theme"
                    value={value}
                    checked={theme === value}
                    onChange={() => chooseTheme(value)}
                    className="sr-only"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </Card>

        <Button variant="secondary" onClick={onLogout} disabled={logout.isPending} className="w-full">
          Log out
        </Button>
      </div>
    </Screen>
  );
}
```

- [ ] **Step 6: Add the route**

Replace `frontend/src/router.tsx` with:

```tsx
import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "./auth/AppLayout";
import { RequireAuth } from "./auth/RequireAuth";
import { CategoriesPage } from "./pages/CategoriesPage";
import { ExpensesPage } from "./pages/ExpensesPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SummaryPage } from "./pages/SummaryPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        // Tabs: share the bottom tab bar.
        element: <AppLayout />,
        children: [
          { path: "/", element: <ExpensesPage /> },
          { path: "/categories", element: <CategoriesPage /> },
          { path: "/summary", element: <SummaryPage /> },
        ],
      },
      // Pushed screens: full screen with their own back button.
      { path: "/settings", element: <SettingsPage /> },
    ],
  },
]);
```

- [ ] **Step 7: Interim headers on the three tab pages**

Until PR 3 rewrites them, each tab page renders the gradient header so Settings (and Log out) stay reachable.

In `frontend/src/pages/ExpensesPage.tsx`: add `import { GradientHeader } from "../components/GradientHeader";`, then change the start and end of the returned JSX from

```tsx
    <section className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Expenses</h2>
```
```tsx
    </section>
```

to

```tsx
    <>
      <GradientHeader>
        <h1 className="mt-2 text-3xl font-extrabold">Expenses</h1>
      </GradientHeader>
      <section className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
```
```tsx
      </section>
    </>
```

Make the same change in `CategoriesPage.tsx` (heading text `Categories`, removing `<h2 className="text-xl font-semibold">Categories</h2>`).

In `SummaryPage.tsx`, the first child of the section is a `div` holding the `h2` and the month input. Replace only the `h2` line (`<h2 className="text-xl font-semibold">Monthly summary</h2>`) with nothing, wrap the section the same way, and use heading text `Summary`:

```tsx
    <>
      <GradientHeader>
        <h1 className="mt-2 text-3xl font-extrabold">Summary</h1>
      </GradientHeader>
      <section className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
```

- [ ] **Step 8: Run the frontend checks**

Run: `npx vitest run && npx tsc -b && npm run lint && npm run build`
Expected: all PASS (existing page tests don't depend on the removed `h2`s).

- [ ] **Step 9: Commit**

```bash
git add frontend/src
git commit -m "feat: app shell with tab bar, gradient header and settings screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 7: Restyle login and register

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/RegisterPage.tsx`

**Interfaces:**
- Consumes: `AuthCard`, `Field`, `Button`, `inputClass` (Task 5).
- Behavior unchanged: same labels (`Email`, `Password`), buttons (`Log in`, `Create account`), alerts and navigation, so the existing tests are the regression check.

- [ ] **Step 1: Restyle LoginPage**

In `frontend/src/pages/LoginPage.tsx`, add imports:

```tsx
import { AuthCard } from "../components/AuthCard";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { inputClass } from "../components/styles";
```

and replace the returned JSX with:

```tsx
  return (
    <AuthCard title="Log in">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" autoComplete="email" className={inputClass} {...register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <input id="password" type="password" autoComplete="current-password" className={inputClass} {...register("password")} />
        </Field>
        {login.isError && (
          <p role="alert" className="text-sm text-danger">
            {login.error.message}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
          Log in
        </Button>
      </form>
    </AuthCard>
  );
```

- [ ] **Step 2: Restyle RegisterPage**

In `frontend/src/pages/RegisterPage.tsx`, add the same four imports and replace the returned JSX with:

```tsx
  return (
    <AuthCard title="Create account">
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" autoComplete="email" className={inputClass} {...register("email")} />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <input id="password" type="password" autoComplete="new-password" className={inputClass} {...register("password")} />
        </Field>
        {registerUser.isError && (
          <p role="alert" className="text-sm text-danger">
            {registerUser.error.message}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
          Create account
        </Button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already have an account?{" "}
        <Link to="/login" className="font-semibold text-accent">
          Log in
        </Link>
      </p>
    </AuthCard>
  );
```

- [ ] **Step 3: Run the frontend checks**

Run: `npx vitest run src/pages/LoginPage.test.tsx src/pages/RegisterPage.test.tsx && npx tsc -b && npm run lint`
Expected: PASS without changing the tests.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx
git commit -m "feat: restyle login and register on the gradient

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**PR checkpoint:** open PR 2 (`feat/ui-foundation` → `dev`), title `feat: UI foundation: theme, components, app shell, settings`. Note in the body that the tab pages only have interim headers until PR 3, plus the manual checklist. Wait for CI and owner approval; squash-merge; update `dev`; create `feat/ui-screens`.

---

## PR 3 — `feat/ui-screens`

### Task 8: Expenses tab (breakdown card, grouped list) and summary invalidation

**Files:**
- Modify: `frontend/src/api/summary.ts`, `frontend/src/api/expenses.ts`, `frontend/src/api/categories.ts`
- Create: `frontend/src/pages/BreakdownCard.tsx`, `frontend/src/pages/ExpenseList.tsx`
- Rewrite: `frontend/src/pages/ExpensesPage.tsx`, `frontend/src/pages/ExpensesPage.test.tsx`

**Interfaces:**
- Consumes: `GradientHeader`, `Card`, `Donut`, `CategoryChip`, `MoneyText`, icons; `toCents`, `formatUsd`, `sumAmounts`; `currentMonthValue`, `monthName`, `dayLabel`; `colorVar`.
- Produces: `summaryQueryKey = ["summary"] as const` (summary queries keyed `[...summaryQueryKey, year, month]`). Creating/deleting an expense invalidates expenses and summary; creating/deleting a category invalidates categories and summary. `/` links rows to `/expenses/:id` and `+` to `/expenses/new` (screens built in Task 9).

- [ ] **Step 1: Write the failing tests**

Replace `frontend/src/pages/ExpensesPage.test.tsx` with:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider, useParams } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { localToday } from "../lib/dates";
import { server } from "../test/server";
import { ExpensesPage } from "./ExpensesPage";

type Category = { id: number; name: string; color: string; icon: string };
type Expense = { id: number; amount: string; spent_on: string; note: string | null; category: Category };
type SummaryRow = { category_id: number; name: string; color: string; icon: string; total: string };

const food = { id: 1, name: "Food", color: "amber", icon: "🍔" };
const rent = { id: 2, name: "Rent", color: "sky", icon: "🏠" };

const row = (c: Category, total: string): SummaryRow => ({ category_id: c.id, name: c.name, color: c.color, icon: c.icon, total });

function fakeApi(expenses: Expense[], summary: SummaryRow[]) {
  server.use(
    http.get("/api/expenses", () => HttpResponse.json(expenses)),
    http.get("/api/summary", () => HttpResponse.json(summary)),
  );
}

function Detail() {
  return <p>detail of {useParams().id}</p>;
}

function renderPage() {
  const routes = [
    { path: "/", element: <ExpensesPage /> },
    { path: "/expenses/new", element: <p>new expense screen</p> },
    { path: "/expenses/:id", element: <Detail /> },
    { path: "/summary", element: <p>summary tab</p> },
  ];
  const router = createMemoryRouter(routes, { initialEntries: ["/"] });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const ui = (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  return render(ui);
}

describe("ExpensesPage", () => {
  it("shows this month's total in the header", async () => {
    fakeApi([], [row(rent, "900.00"), row(food, "12.50")]);
    renderPage();

    expect(await screen.findByText("$912.50")).toBeInTheDocument();
  });

  it("groups expenses under date headings, newest first", async () => {
    fakeApi(
      [
        { id: 11, amount: "12.50", spent_on: localToday(), note: "Lunch", category: food },
        { id: 10, amount: "900.00", spent_on: "2025-03-05", note: null, category: rent },
      ],
      [],
    );
    renderPage();

    const today = await screen.findByRole("region", { name: "Today" });
    expect(within(today).getByRole("link", { name: /lunch/i })).toHaveTextContent(/Food.*Lunch.*\$12\.50/);
    const older = screen.getByRole("region", { name: "Mar 5, 2025" });
    expect(within(older).getByRole("link", { name: /rent/i })).toHaveTextContent("$900.00");
  });

  it("opens an expense's detail screen when its row is tapped", async () => {
    fakeApi([{ id: 11, amount: "12.50", spent_on: localToday(), note: "Lunch", category: food }], []);
    renderPage();

    await userEvent.setup().click(await screen.findByRole("link", { name: /lunch/i }));

    expect(await screen.findByText("detail of 11")).toBeInTheDocument();
  });

  it("opens the new expense screen from the + button", async () => {
    fakeApi([], []);
    renderPage();

    await userEvent.setup().click(await screen.findByRole("link", { name: "Add expense" }));

    expect(await screen.findByText("new expense screen")).toBeInTheDocument();
  });

  it("says when there are no expenses", async () => {
    fakeApi([], []);
    renderPage();

    expect(await screen.findByText(/no expenses yet/i)).toBeInTheDocument();
  });

  describe("breakdown card", () => {
    it("lists the top categories with amounts, largest first", async () => {
      fakeApi([], [row(rent, "900.00"), row(food, "12.50"), row({ id: 3, name: "Travel", color: "teal", icon: "✈️" }, "0")]);
      renderPage();

      const legend = await screen.findByRole("list", { name: "Top categories" });
      expect(within(legend).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["Rent$900.00", "Food$12.50"]);
    });

    it("links to Summary when there are more than four categories", async () => {
      const cats = [1, 2, 3, 4, 5, 6].map((id) => ({ id, name: `Cat${id}`, color: "slate", icon: "🏷️" }));
      fakeApi([], cats.map((c, i) => row(c, `${60 - i * 10}.00`)));
      renderPage();

      const more = await screen.findByRole("link", { name: "+ 2 more" });
      await userEvent.setup().click(more);
      expect(await screen.findByText("summary tab")).toBeInTheDocument();
    });

    it("collapses to one line and remembers that across visits", async () => {
      fakeApi([], [row(rent, "900.00"), row(food, "12.50")]);
      const { unmount } = renderPage();
      const user = userEvent.setup();

      await user.click(await screen.findByRole("button", { name: "Hide breakdown" }));

      expect(screen.queryByRole("list", { name: "Top categories" })).not.toBeInTheDocument();
      expect(screen.getByText(/Top: Rent/)).toHaveTextContent("Top: Rent $900.00");
      expect(localStorage.getItem("breakdown-collapsed")).toBe("true");

      unmount();
      renderPage();
      expect(await screen.findByRole("button", { name: "Show breakdown" })).toHaveAttribute("aria-expanded", "false");

      await user.click(screen.getByRole("button", { name: "Show breakdown" }));
      expect(await screen.findByRole("list", { name: "Top categories" })).toBeInTheDocument();
    });

    it("says when nothing has been spent this month", async () => {
      fakeApi([], [row(food, "0")]);
      renderPage();

      expect(await screen.findByText("No spending yet this month")).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/pages/ExpensesPage.test.tsx`
Expected: FAIL (no total, no regions, no breakdown card).

- [ ] **Step 3: Export the summary key and invalidate it**

Replace `frontend/src/api/summary.ts` with:

```ts
import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "./client";
import type { components } from "./schema";

export type CategorySummary = components["schemas"]["CategorySummary"];

export const summaryQueryKey = ["summary"] as const;

export function useSummary(year: number, month: number) {
  return useQuery({
    queryKey: [...summaryQueryKey, year, month] as const,
    queryFn: () => unwrap(api.GET("/api/summary", { params: { query: { year, month } } })),
  });
}
```

Replace `frontend/src/api/expenses.ts` with:

```ts
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, unwrapVoid } from "./client";
import type { components } from "./schema";
import { summaryQueryKey } from "./summary";

export type Expense = components["schemas"]["ExpenseRead"];
export type ExpenseCreate = components["schemas"]["ExpenseCreate"];

export const expensesQueryKey = ["expenses"] as const;

// Monthly totals are computed from expenses, so they go stale together.
function invalidateExpenseData(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: expensesQueryKey }),
    queryClient.invalidateQueries({ queryKey: summaryQueryKey }),
  ]);
}

export function useExpenses() {
  return useQuery({
    queryKey: expensesQueryKey,
    queryFn: () => unwrap(api.GET("/api/expenses")),
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ExpenseCreate) => unwrap(api.POST("/api/expenses", { body })),
    onSuccess: () => invalidateExpenseData(queryClient),
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrapVoid(api.DELETE("/api/expenses/{expense_id}", { params: { path: { expense_id: id } } })),
    onSuccess: () => invalidateExpenseData(queryClient),
  });
}
```

Replace `frontend/src/api/categories.ts` with:

```ts
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, unwrap, unwrapVoid } from "./client";
import type { components } from "./schema";
import { summaryQueryKey } from "./summary";

export type Category = components["schemas"]["CategoryRead"];
export type CategoryCreate = components["schemas"]["CategoryCreate"];

export const categoriesQueryKey = ["categories"] as const;

// The summary lists every category (with a 0 total if unused), so it changes too.
function invalidateCategoryData(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: categoriesQueryKey }),
    queryClient.invalidateQueries({ queryKey: summaryQueryKey }),
  ]);
}

export function useCategories() {
  return useQuery({
    queryKey: categoriesQueryKey,
    queryFn: () => unwrap(api.GET("/api/categories")),
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CategoryCreate) => unwrap(api.POST("/api/categories", { body })),
    onSuccess: () => invalidateCategoryData(queryClient),
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      unwrapVoid(
        api.DELETE("/api/categories/{category_id}", { params: { path: { category_id: id } } }),
      ),
    onSuccess: () => invalidateCategoryData(queryClient),
  });
}
```

- [ ] **Step 4: Implement BreakdownCard**

Create `frontend/src/pages/BreakdownCard.tsx`:

```tsx
import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import type { CategorySummary } from "../api/summary";
import { Card } from "../components/Card";
import { Donut } from "../components/Donut";
import { MoneyText } from "../components/MoneyText";
import { toCents } from "../lib/money";
import { colorVar } from "../lib/palette";

const STORAGE_KEY = "breakdown-collapsed";
const LEGEND_SIZE = 4;

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // Storage unavailable: the choice just won't survive a reload.
  }
}

type Props = { rows?: CategorySummary[]; error?: string };

export function BreakdownCard({ rows, error }: Props) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    saveCollapsed(next);
  }

  // The API sorts rows by total, largest first.
  const spent = (rows ?? []).filter((r) => toCents(r.total) > 0);
  const segments = spent.map((r) => ({ key: r.category_id, color: colorVar(r.color), cents: toCents(r.total) }));
  const top = spent[0];

  const toggleButton = (
    <button type="button" onClick={toggle} aria-expanded={!collapsed} className="min-h-11 px-2 text-sm font-semibold text-accent">
      {collapsed ? "Show" : "Hide"}
      <span className="sr-only"> breakdown</span>
    </button>
  );

  let status: ReactNode = null;
  if (error) status = <p role="alert" className="text-sm text-danger">{error}</p>;
  else if (!rows) status = <p className="text-sm text-muted">Loading…</p>;
  else if (spent.length === 0) status = <p className="text-sm text-muted">No spending yet this month</p>;

  if (collapsed) {
    return (
      <Card className="flex items-center gap-3 px-4 py-1.5">
        {segments.length > 0 && <Donut segments={segments} size={28} thickness={6} />}
        <span className="font-bold">Breakdown</span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted">
          {top && (
            <>
              Top: {top.name} <MoneyText amount={top.total} />
            </>
          )}
        </span>
        {toggleButton}
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Breakdown</h2>
        {toggleButton}
      </div>
      {status ?? (
        <div className="mt-2 flex items-center gap-4">
          <Donut segments={segments} size={96} thickness={16} />
          <ul aria-label="Top categories" className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
            {spent.slice(0, LEGEND_SIZE).map((r) => (
              <li key={r.category_id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorVar(r.color) }} />
                  <span className="truncate">{r.name}</span>
                </span>
                <MoneyText amount={r.total} className="font-semibold" />
              </li>
            ))}
            {spent.length > LEGEND_SIZE && (
              <li>
                <Link to="/summary" className="font-medium text-accent">
                  + {spent.length - LEGEND_SIZE} more
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}
    </Card>
  );
}
```

Note: the "+ N more" `li` is the legend's fifth item; the "top categories" test uses at most four categories with spending, so it sees only category rows.

- [ ] **Step 5: Implement ExpenseList**

Create `frontend/src/pages/ExpenseList.tsx`:

```tsx
import { Link } from "react-router-dom";
import type { Expense } from "../api/expenses";
import { Card } from "../components/Card";
import { CategoryChip } from "../components/CategoryChip";
import { MoneyText } from "../components/MoneyText";
import { dayLabel } from "../lib/dates";

type DayGroup = { day: string; items: Expense[] };

// The API returns expenses newest first, so rows for the same day are adjacent.
function groupByDay(expenses: Expense[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const expense of expenses) {
    const last = groups.at(-1);
    if (last && last.day === expense.spent_on) last.items.push(expense);
    else groups.push({ day: expense.spent_on, items: [expense] });
  }
  return groups;
}

export function ExpenseList({ expenses }: { expenses: Expense[] }) {
  if (expenses.length === 0) {
    return <Card className="p-6 text-center text-muted">No expenses yet. Tap + to add one.</Card>;
  }

  return (
    <div className="flex flex-col gap-5">
      {groupByDay(expenses).map(({ day, items }) => (
        <section key={day} aria-label={dayLabel(day)}>
          <h2 className="mb-2 px-1 text-sm font-bold">{dayLabel(day)}</h2>
          <Card>
            <ul className="divide-y divide-line">
              {items.map((e) => (
                <li key={e.id}>
                  <Link to={`/expenses/${e.id}`} className="flex min-h-14 items-center gap-3 px-3 py-2">
                    <CategoryChip category={e.category} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{e.category.name}</span>
                      {e.note && <span className="block truncate text-sm text-muted">{e.note}</span>}
                    </span>
                    <MoneyText amount={e.amount} className="font-bold" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Rewrite ExpensesPage**

Replace `frontend/src/pages/ExpensesPage.tsx` with:

```tsx
import { Link } from "react-router-dom";
import { useExpenses } from "../api/expenses";
import { useSummary } from "../api/summary";
import { Card } from "../components/Card";
import { GradientHeader } from "../components/GradientHeader";
import { PlusIcon } from "../components/icons";
import { currentMonthValue, monthName } from "../lib/dates";
import { formatUsd, sumAmounts } from "../lib/money";
import { BreakdownCard } from "./BreakdownCard";
import { ExpenseList } from "./ExpenseList";

export function ExpensesPage() {
  const monthValue = currentMonthValue();
  const [year, month] = monthValue.split("-").map(Number);
  const expenses = useExpenses();
  const summary = useSummary(year, month);
  const total = summary.data ? formatUsd(sumAmounts(summary.data.map((r) => r.total))) : "—";

  return (
    <>
      <GradientHeader overlap>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-sm font-medium text-white/90">{monthName(monthValue)} spending</h1>
            <p className="text-4xl font-extrabold tracking-tight tabular-nums">{total}</p>
          </div>
          <Link
            to="/expenses/new"
            aria-label="Add expense"
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-indigo-600 shadow-md"
          >
            <PlusIcon className="size-6" />
          </Link>
        </div>
      </GradientHeader>
      <main className="mx-auto -mt-10 grid max-w-5xl gap-6 px-4 md:grid-cols-[20rem_1fr] md:items-start">
        <BreakdownCard rows={summary.data} error={summary.error?.message} />
        <div className="md:mt-14">
          {expenses.isPending && <Card className="p-4 text-muted">Loading…</Card>}
          {expenses.isError && (
            <p role="alert" className="text-sm text-danger">
              {expenses.error.message}
            </p>
          )}
          {expenses.data && <ExpenseList expenses={expenses.data} />}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run && npx tsc -b && npm run lint`
Expected: PASS. (The old add-expense form is gone from this page; Task 9 adds its screen. Between Tasks 8 and 9 the `+` button points at a route that doesn't exist yet in `router.tsx`; that's fine within the branch.)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/api frontend/src/pages/ExpensesPage.tsx frontend/src/pages/ExpensesPage.test.tsx frontend/src/pages/BreakdownCard.tsx frontend/src/pages/ExpenseList.tsx
git commit -m "feat: expenses tab with monthly total, breakdown card and grouped list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 9: New expense and expense detail screens

**Files:**
- Create: `frontend/src/pages/NewExpensePage.tsx`, `frontend/src/pages/NewExpensePage.test.tsx`
- Create: `frontend/src/pages/ExpenseDetailPage.tsx`, `frontend/src/pages/ExpenseDetailPage.test.tsx`
- Modify: `frontend/src/router.tsx`

**Interfaces:**
- Consumes: `Screen`, `Card`, `Field`, `Button`, `inputClass`, `CategoryChip`, `MoneyText`; `useCategories`, `useCreateExpense`, `useExpenses`, `useDeleteExpense`; `localToday`, `addDays`, `longDate`.
- Produces: `export type ExpenseDraft = Partial<{ category_id: string; amount: string; spent_on: string; note: string }>`. `/expenses/new` accepts router state `{ draft?: ExpenseDraft; categoryId?: number }` (prefills the form; `categoryId` wins) and its "+ New category" button navigates to `/categories/new` with state `{ draft }` (Task 10 consumes this). `/expenses/:id` detail.

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/pages/NewExpensePage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, type InitialEntry, RouterProvider, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { localToday } from "../lib/dates";
import { server } from "../test/server";
import { NewExpensePage } from "./NewExpensePage";

const food = { id: 1, name: "Food", color: "amber", icon: "🍔" };
const rent = { id: 2, name: "Rent", color: "sky", icon: "🏠" };

function fakeApi(categories: (typeof food)[]) {
  const posted: unknown[] = [];
  server.use(
    http.get("/api/categories", () => HttpResponse.json(categories)),
    http.post("/api/expenses", async ({ request }) => {
      const body = (await request.json()) as { category_id: number; amount: string; spent_on: string; note: string | null };
      posted.push(body);
      const category = categories.find((c) => c.id === body.category_id)!;
      return HttpResponse.json({ id: 50, ...body, category }, { status: 201 });
    }),
  );
  return { posted };
}

function StateProbe({ label }: { label: string }) {
  return (
    <p>
      {label} {JSON.stringify(useLocation().state)}
    </p>
  );
}

function renderPage(entry: InitialEntry = "/expenses/new") {
  const router = createMemoryRouter(
    [
      { path: "/", element: <p>expenses list</p> },
      { path: "/expenses/new", element: <NewExpensePage /> },
      { path: "/categories/new", element: <StateProbe label="new category screen" /> },
    ],
    { initialEntries: [entry] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient };
}

describe("NewExpensePage", () => {
  it("adds an expense with today's date and the first category by default, then returns to the list", async () => {
    const { posted } = fakeApi([food, rent]);
    const { queryClient } = renderPage();
    queryClient.setQueryData(["summary", 2026, 10], []);
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Amount"), "12.50");
    await user.type(screen.getByLabelText("Note"), "Lunch");
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    expect(await screen.findByText("expenses list")).toBeInTheDocument();
    expect(posted).toEqual([{ category_id: 1, amount: "12.50", spent_on: localToday(), note: "Lunch" }]);
    // The breakdown card and Summary tab must refetch their totals.
    expect(queryClient.getQueryState(["summary", 2026, 10])?.isInvalidated).toBe(true);
  });

  it("rejects a non-positive amount without calling the API", async () => {
    const { posted } = fakeApi([food]);
    renderPage();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Amount"), "0");
    await user.click(screen.getByRole("button", { name: "Add expense" }));

    expect(await screen.findByText(/greater than 0/i)).toBeInTheDocument();
    expect(posted).toEqual([]);
  });

  it("carries the draft to the new category screen", async () => {
    fakeApi([food, rent]);
    renderPage();
    const user = userEvent.setup();

    await user.type(await screen.findByLabelText("Amount"), "7.25");
    await user.click(screen.getByRole("button", { name: "+ New category" }));

    const probe = await screen.findByText(/new category screen/);
    expect(probe.textContent).toContain('"amount":"7.25"');
  });

  it("restores a draft and pre-selects a just-created category", async () => {
    fakeApi([food, rent]);
    renderPage({
      pathname: "/expenses/new",
      state: { draft: { amount: "7.25", note: "Tea", spent_on: localToday(), category_id: "1" }, categoryId: 2 },
    });

    expect(await screen.findByLabelText("Amount")).toHaveValue("7.25");
    expect(screen.getByLabelText("Note")).toHaveValue("Tea");
    expect(screen.getByLabelText("Category")).toHaveValue("2");
  });

  it("asks for a category first when there are none", async () => {
    fakeApi([]);
    renderPage();

    expect(await screen.findByText(/create a category first/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ New category" })).toHaveAttribute("href", "/categories/new");
    expect(screen.queryByRole("button", { name: "Add expense" })).not.toBeInTheDocument();
  });
});
```

Create `frontend/src/pages/ExpenseDetailPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { ExpenseDetailPage } from "./ExpenseDetailPage";

const food = { id: 1, name: "Food", color: "amber", icon: "🍔" };

function fakeApi() {
  const rows = [{ id: 10, amount: "12.50", spent_on: "2026-10-10", note: "Lunch", category: food }];
  const deleted: number[] = [];
  server.use(
    http.get("/api/expenses", () => HttpResponse.json(rows)),
    http.delete("/api/expenses/:id", ({ params }) => {
      deleted.push(Number(params.id));
      rows.splice(rows.findIndex((r) => r.id === Number(params.id)), 1);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { deleted };
}

function renderPage(path: string) {
  const router = createMemoryRouter(
    [
      { path: "/", element: <p>expenses list</p> },
      { path: "/expenses/:id", element: <ExpenseDetailPage /> },
    ],
    { initialEntries: [path] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { queryClient };
}

describe("ExpenseDetailPage", () => {
  it("shows the expense", async () => {
    fakeApi();
    renderPage("/expenses/10");

    expect(await screen.findByText("$12.50")).toBeInTheDocument();
    expect(screen.getByText("Food")).toBeInTheDocument();
    expect(screen.getByText("Saturday, October 10, 2026")).toBeInTheDocument();
    expect(screen.getByText("Lunch")).toBeInTheDocument();
  });

  it("asks for confirmation; cancelling keeps the expense", async () => {
    const { deleted } = fakeApi();
    renderPage("/expenses/10");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete expense" }));
    expect(screen.getByText(/delete this expense\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete expense" })).toBeInTheDocument();
    expect(deleted).toEqual([]);
  });

  it("deletes after confirmation, refreshes the summary and returns to the list", async () => {
    const { deleted } = fakeApi();
    const { queryClient } = renderPage("/expenses/10");
    queryClient.setQueryData(["summary", 2026, 10], []);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete expense" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("expenses list")).toBeInTheDocument();
    expect(deleted).toEqual([10]);
    expect(queryClient.getQueryState(["summary", 2026, 10])?.isInvalidated).toBe(true);
  });

  it("says when the expense doesn't exist", async () => {
    fakeApi();
    renderPage("/expenses/999");

    expect(await screen.findByText("Expense not found")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/pages/NewExpensePage.test.tsx src/pages/ExpenseDetailPage.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement NewExpensePage**

Create `frontend/src/pages/NewExpensePage.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { type Category, useCategories } from "../api/categories";
import { useCreateExpense } from "../api/expenses";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Field } from "../components/Field";
import { Screen } from "../components/Screen";
import { inputClass } from "../components/styles";
import { addDays, localToday } from "../lib/dates";

// Amounts stay strings end to end (NUMERIC(12,2) on the backend); we only
// validate the shape here and never do float math on them.
const amountMessage = "Enter an amount greater than 0 with up to 2 decimals";
const schema = z.object({
  category_id: z.string().min(1, "Pick a category"),
  amount: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, amountMessage)
    .refine((v) => Number(v) > 0, amountMessage),
  spent_on: z
    .string()
    .min(1, "Date is required")
    // Backend allows one day of slack for timezone skew; mirror it.
    .refine((v) => v <= addDays(localToday(), 1), "Date cannot be in the future"),
  note: z.string().trim().max(255, "Note must be at most 255 characters"),
});
type FormValues = z.infer<typeof schema>;

// Form values carried to the new-category screen and back, so nothing typed is lost.
export type ExpenseDraft = Partial<FormValues>;
type LocationState = { draft?: ExpenseDraft; categoryId?: number } | null;

export function NewExpensePage() {
  const categories = useCategories();

  return (
    <Screen title="New expense" backTo="/">
      {categories.isPending && <p className="text-muted">Loading…</p>}
      {categories.isError && (
        <p role="alert" className="text-sm text-danger">
          {categories.error.message}
        </p>
      )}
      {categories.data?.length === 0 && (
        <Card className="p-4">
          <p>Create a category first.</p>
          <Link to="/categories/new" state={{ draft: {} }} className="mt-2 inline-flex min-h-11 items-center font-semibold text-accent">
            + New category
          </Link>
        </Card>
      )}
      {categories.data && categories.data.length > 0 && <ExpenseForm categories={categories.data} />}
    </Screen>
  );
}

// Mounted only once categories have loaded, so the default category is known
// when the form initializes.
function ExpenseForm({ categories }: { categories: Category[] }) {
  const navigate = useNavigate();
  const state = useLocation().state as LocationState;
  const create = useCreateExpense();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: "",
      spent_on: localToday(),
      note: "",
      ...state?.draft,
      // A category created mid-entry wins over the one picked before leaving.
      category_id: String(state?.categoryId ?? (state?.draft?.category_id || categories[0].id)),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        category_id: Number(values.category_id),
        amount: values.amount,
        spent_on: values.spent_on,
        note: values.note || null,
      });
      navigate("/", { replace: true });
    } catch {
      // Shown below via create.error
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Amount" htmlFor="amount" error={errors.amount?.message}>
        <input id="amount" inputMode="decimal" placeholder="0.00" className={`${inputClass} text-2xl font-bold`} {...register("amount")} />
      </Field>
      <Field label="Category" htmlFor="category_id" error={errors.category_id?.message}>
        <select id="category_id" className={inputClass} {...register("category_id")}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => navigate("/categories/new", { state: { draft: getValues() } })}
          className="min-h-11 self-start text-sm font-semibold text-accent"
        >
          + New category
        </button>
      </Field>
      <Field label="Date" htmlFor="spent_on" error={errors.spent_on?.message}>
        <input id="spent_on" type="date" className={inputClass} {...register("spent_on")} />
      </Field>
      <Field label="Note" htmlFor="note" error={errors.note?.message}>
        <input id="note" placeholder="Optional" className={inputClass} {...register("note")} />
      </Field>
      {create.isError && (
        <p role="alert" className="text-sm text-danger">
          {create.error.message}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
        Add expense
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Implement ExpenseDetailPage**

Create `frontend/src/pages/ExpenseDetailPage.tsx`:

```tsx
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDeleteExpense, useExpenses } from "../api/expenses";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CategoryChip } from "../components/CategoryChip";
import { MoneyText } from "../components/MoneyText";
import { Screen } from "../components/Screen";
import { longDate } from "../lib/dates";

// Reads from the already-loaded expense list; the API has no single-expense GET.
export function ExpenseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const expenses = useExpenses();
  const remove = useDeleteExpense();
  const [confirming, setConfirming] = useState(false);
  const expense = expenses.data?.find((e) => e.id === Number(id));

  async function onDelete(expenseId: number) {
    try {
      await remove.mutateAsync(expenseId);
      navigate("/", { replace: true });
    } catch {
      // Shown below via remove.error
    }
  }

  return (
    <Screen title="Expense" backTo="/">
      {expenses.isPending && <p className="text-muted">Loading…</p>}
      {expenses.isError && (
        <p role="alert" className="text-sm text-danger">
          {expenses.error.message}
        </p>
      )}
      {expenses.data && !expense && <Card className="p-6 text-center text-muted">Expense not found</Card>}
      {expense && (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col items-center gap-2 p-6 text-center">
            <CategoryChip category={expense.category} size="lg" />
            <p className="font-semibold">{expense.category.name}</p>
            <MoneyText amount={expense.amount} className="text-4xl font-extrabold" />
          </Card>
          <Card className="p-4">
            <dl className="grid grid-cols-[5rem_1fr] gap-y-3 text-sm">
              <dt className="text-muted">Date</dt>
              <dd>{longDate(expense.spent_on)}</dd>
              <dt className="text-muted">Note</dt>
              <dd className="break-words">{expense.note || "—"}</dd>
            </dl>
          </Card>
          {remove.isError && (
            <p role="alert" className="text-sm text-danger">
              {remove.error.message}
            </p>
          )}
          {confirming ? (
            <Card className="flex flex-col gap-3 p-4">
              <p className="font-medium">Delete this expense? This can't be undone.</p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => onDelete(expense.id)} disabled={remove.isPending}>
                  Delete
                </Button>
              </div>
            </Card>
          ) : (
            <Button variant="danger" onClick={() => setConfirming(true)} className="w-full">
              Delete expense
            </Button>
          )}
        </div>
      )}
    </Screen>
  );
}
```

- [ ] **Step 5: Add the routes**

In `frontend/src/router.tsx`, import both pages and add them to the pushed screens, so that block reads:

```tsx
      // Pushed screens: full screen with their own back button.
      { path: "/expenses/new", element: <NewExpensePage /> },
      { path: "/expenses/:id", element: <ExpenseDetailPage /> },
      { path: "/settings", element: <SettingsPage /> },
```

with imports:

```tsx
import { ExpenseDetailPage } from "./pages/ExpenseDetailPage";
import { NewExpensePage } from "./pages/NewExpensePage";
```

- [ ] **Step 6: Run to verify pass**

Run: `npx vitest run && npx tsc -b && npm run lint`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/NewExpensePage.tsx frontend/src/pages/NewExpensePage.test.tsx frontend/src/pages/ExpenseDetailPage.tsx frontend/src/pages/ExpenseDetailPage.test.tsx frontend/src/router.tsx
git commit -m "feat: new expense and expense detail screens

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 10: Categories tab and new category screen

**Files:**
- Create: `frontend/src/pages/CategoryForm.tsx`
- Rewrite: `frontend/src/pages/CategoriesPage.tsx`, `frontend/src/pages/CategoriesPage.test.tsx`
- Create: `frontend/src/pages/NewCategoryPage.tsx`, `frontend/src/pages/NewCategoryPage.test.tsx`
- Modify: `frontend/src/router.tsx`

**Interfaces:**
- Consumes: `ExpenseDraft` type (Task 9); `CATEGORY_COLORS`, `colorLabel`, `colorVar`, `CategoryColor` (Task 4); components (Task 5); `useCreateCategory`, `useDeleteCategory`, `useCategories`.
- Produces: `CategoryForm({ onCreated?: (category: Category) => void })` — fields labelled `Name`, `Emoji`, a `Color` radio group (radio names are the color labels, e.g. `Teal`), submit `Add category`; resets after success. `/categories/new`: with state `{ draft }` returns to `/expenses/new` with state `{ draft, categoryId }`; without it returns to `/categories`.

- [ ] **Step 1: Write the failing tests**

Replace `frontend/src/pages/CategoriesPage.test.tsx` with:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { CategoriesPage } from "./CategoriesPage";

type Category = { id: number; name: string; color: string; icon: string };

// A tiny in-memory backend so list/create/delete interact like the real API.
function fakeCategories(initial: Category[]) {
  const rows = [...initial];
  let nextId = Math.max(0, ...rows.map((r) => r.id)) + 1;
  const posted: unknown[] = [];
  server.use(
    http.get("/api/categories", () => HttpResponse.json(rows)),
    http.post("/api/categories", async ({ request }) => {
      const body = (await request.json()) as { name: string; color: string; icon: string };
      posted.push(body);
      if (rows.some((r) => r.name === body.name)) {
        return HttpResponse.json({ detail: "Category name taken" }, { status: 409 });
      }
      const row = { id: nextId++, ...body };
      rows.push(row);
      return HttpResponse.json(row, { status: 201 });
    }),
    http.delete("/api/categories/:id", ({ params }) => {
      const id = Number(params.id);
      if (id === 99) return HttpResponse.json({ detail: "Category has expenses" }, { status: 409 });
      rows.splice(rows.findIndex((r) => r.id === id), 1);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return { posted };
}

function renderPage() {
  const router = createMemoryRouter([{ path: "/categories", element: <CategoriesPage /> }], {
    initialEntries: ["/categories"],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const food = { id: 1, name: "Food", color: "amber", icon: "🍔" };
const rent = { id: 2, name: "Rent", color: "sky", icon: "🏠" };

describe("CategoriesPage", () => {
  it("lists the user's categories", async () => {
    fakeCategories([food, rent]);
    renderPage();

    const list = await screen.findByRole("list", { name: "Categories" });
    expect(within(list).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      expect.stringContaining("Food"),
      expect.stringContaining("Rent"),
    ]);
  });

  it("creates a category with a name, emoji and color", async () => {
    const { posted } = fakeCategories([food]);
    renderPage();
    const user = userEvent.setup();
    await screen.findByText("Food");

    await user.type(screen.getByLabelText("Name"), "Travel");
    await user.clear(screen.getByLabelText("Emoji"));
    await user.type(screen.getByLabelText("Emoji"), "✈️");
    await user.click(screen.getByRole("radio", { name: "Teal" }));
    await user.click(screen.getByRole("button", { name: "Add category" }));

    const list = screen.getByRole("list", { name: "Categories" });
    expect(await within(list).findByText("Travel")).toBeInTheDocument();
    expect(posted).toEqual([{ name: "Travel", icon: "✈️", color: "teal" }]);
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("Emoji")).toHaveValue("🏷️");
  });

  it("rejects an emoji field longer than 16 characters without calling the API", async () => {
    const { posted } = fakeCategories([food]);
    renderPage();
    const user = userEvent.setup();
    await screen.findByText("Food");

    await user.type(screen.getByLabelText("Name"), "Long");
    await user.clear(screen.getByLabelText("Emoji"));
    await user.type(screen.getByLabelText("Emoji"), "x".repeat(17));
    await user.click(screen.getByRole("button", { name: "Add category" }));

    expect(await screen.findByText(/at most 16/i)).toBeInTheDocument();
    expect(posted).toEqual([]);
  });

  it("shows the server message when the name is taken", async () => {
    fakeCategories([food]);
    renderPage();
    const user = userEvent.setup();
    await screen.findByText("Food");

    await user.type(screen.getByLabelText("Name"), "Food");
    await user.click(screen.getByRole("button", { name: "Add category" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Category name taken");
  });

  it("deletes an empty category", async () => {
    fakeCategories([food, rent]);
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete Rent" }));

    await screen.findByText("Food");
    expect(screen.queryByText("Rent")).not.toBeInTheDocument();
  });

  it("shows the server message when deleting a category with expenses", async () => {
    fakeCategories([{ ...food, id: 99 }]);
    renderPage();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete Food" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Category has expenses");
    expect(screen.getByText("Food")).toBeInTheDocument();
  });
});
```

Create `frontend/src/pages/NewCategoryPage.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, type InitialEntry, RouterProvider, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { server } from "../test/server";
import { NewCategoryPage } from "./NewCategoryPage";

function StateProbe({ label }: { label: string }) {
  return (
    <p>
      {label} {JSON.stringify(useLocation().state)}
    </p>
  );
}

function renderPage(entry: InitialEntry) {
  server.use(
    http.post("/api/categories", async ({ request }) => {
      const body = (await request.json()) as object;
      return HttpResponse.json({ id: 7, ...body }, { status: 201 });
    }),
  );
  const router = createMemoryRouter(
    [
      { path: "/categories/new", element: <NewCategoryPage /> },
      { path: "/expenses/new", element: <StateProbe label="expense form" /> },
      { path: "/categories", element: <StateProbe label="categories tab" /> },
    ],
    { initialEntries: [entry] },
  );
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

async function createTravel() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Name"), "Travel");
  await user.click(screen.getByRole("button", { name: "Add category" }));
}

describe("NewCategoryPage", () => {
  it("returns to the expense form with the draft and the new category selected", async () => {
    renderPage({ pathname: "/categories/new", state: { draft: { amount: "7.25" } } });

    await createTravel();

    const probe = await screen.findByText(/expense form/);
    expect(JSON.parse(probe.textContent!.replace("expense form ", ""))).toEqual({
      draft: { amount: "7.25" },
      categoryId: 7,
    });
  });

  it("goes back to the expense form, keeping the draft", async () => {
    renderPage({ pathname: "/categories/new", state: { draft: { amount: "7.25" } } });

    await userEvent.setup().click(screen.getByRole("link", { name: /back/i }));

    expect((await screen.findByText(/expense form/)).textContent).toContain('"amount":"7.25"');
  });

  it("returns to the Categories tab when opened without a draft", async () => {
    renderPage("/categories/new");

    await createTravel();

    expect(await screen.findByText(/categories tab/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/pages/CategoriesPage.test.tsx src/pages/NewCategoryPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement CategoryForm**

Create `frontend/src/pages/CategoryForm.tsx`:

```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { type Category, useCreateCategory } from "../api/categories";
import { Button } from "../components/Button";
import { CategoryChip } from "../components/CategoryChip";
import { Field } from "../components/Field";
import { inputClass } from "../components/styles";
import { CATEGORY_COLORS, type CategoryColor, colorLabel, colorVar } from "../lib/palette";

// Mirrors the backend CategoryCreate schema.
const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50, "Name must be at most 50 characters"),
  // Counted in code points like the backend (Python len), not UTF-16 units:
  // "👨‍👩‍👧" is 5 code points but 8 units.
  icon: z
    .string()
    .trim()
    .min(1, "Pick an emoji")
    .refine((v) => [...v].length <= 16, "Emoji must be at most 16 characters"),
  color: z.enum(CATEGORY_COLORS as [CategoryColor, ...CategoryColor[]]),
});
type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = { name: "", icon: "🏷️", color: "amber" };

export function CategoryForm({ onCreated }: { onCreated?: (category: Category) => void }) {
  const create = useCreateCategory();
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: DEFAULTS });
  const [icon, color] = useWatch({ control, name: ["icon", "color"] });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const created = await create.mutateAsync(values);
      reset(DEFAULTS);
      onCreated?.(created);
    } catch {
      // Shown below via create.error
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <CategoryChip category={{ name: "", icon: icon || DEFAULTS.icon, color }} size="lg" />
        <div className="flex-1">
          <Field label="Name" htmlFor="category-name" error={errors.name?.message}>
            <input id="category-name" className={inputClass} {...register("name")} />
          </Field>
        </div>
      </div>
      <Field label="Emoji" htmlFor="category-icon" error={errors.icon?.message}>
        <input id="category-icon" className={inputClass} {...register("icon")} />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Color</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <label key={c} className="relative">
              <input type="radio" value={c} aria-label={colorLabel(c)} className="peer sr-only" {...register("color")} />
              <span
                aria-hidden="true"
                className="block size-11 cursor-pointer rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-fg peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
                style={{ backgroundColor: colorVar(c) }}
              />
            </label>
          ))}
        </div>
      </fieldset>
      {create.isError && (
        <p role="alert" className="text-sm text-danger">
          {create.error.message}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        Add category
      </Button>
    </form>
  );
}
```

- [ ] **Step 4: Rewrite CategoriesPage**

Replace `frontend/src/pages/CategoriesPage.tsx` with:

```tsx
import { useCategories, useDeleteCategory } from "../api/categories";
import { Card } from "../components/Card";
import { CategoryChip } from "../components/CategoryChip";
import { GradientHeader } from "../components/GradientHeader";
import { TrashIcon } from "../components/icons";
import { CategoryForm } from "./CategoryForm";

export function CategoriesPage() {
  const categories = useCategories();
  const remove = useDeleteCategory();

  return (
    <>
      <GradientHeader overlap>
        <h1 className="mt-2 text-3xl font-extrabold">Categories</h1>
      </GradientHeader>
      <main className="mx-auto -mt-10 flex max-w-2xl flex-col gap-4 px-4">
        <Card className="p-4">
          <h2 className="mb-3 font-bold">New category</h2>
          <CategoryForm />
        </Card>

        {remove.isError && (
          <p role="alert" className="text-sm text-danger">
            {remove.error.message}
          </p>
        )}
        {categories.isPending && <p className="text-muted">Loading…</p>}
        {categories.isError && (
          <p role="alert" className="text-sm text-danger">
            {categories.error.message}
          </p>
        )}
        {categories.data && (
          <Card>
            <ul aria-label="Categories" className="divide-y divide-line">
              {categories.data.map((c) => (
                <li key={c.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
                  <CategoryChip category={c} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                  <button
                    type="button"
                    onClick={() => remove.mutate(c.id)}
                    disabled={remove.isPending}
                    aria-label={`Delete ${c.name}`}
                    className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:text-danger disabled:opacity-50"
                  >
                    <TrashIcon className="size-5" />
                  </button>
                </li>
              ))}
              {categories.data.length === 0 && <li className="p-4 text-sm text-muted">No categories yet.</li>}
            </ul>
          </Card>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 5: Implement NewCategoryPage**

Create `frontend/src/pages/NewCategoryPage.tsx`:

```tsx
import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { CategoryForm } from "./CategoryForm";
import type { ExpenseDraft } from "./NewExpensePage";

type LocationState = { draft?: ExpenseDraft } | null;

// Opened from "+ New category" on the expense form (with the form's draft in
// router state) or directly. With a draft, it hands the draft back along with
// the new category's id so the form comes back filled in and pre-selected.
export function NewCategoryPage() {
  const navigate = useNavigate();
  const draft = (useLocation().state as LocationState)?.draft;
  const fromExpense = draft !== undefined;

  return (
    <Screen
      title="New category"
      backTo={fromExpense ? "/expenses/new" : "/categories"}
      backState={fromExpense ? { draft } : undefined}
    >
      <Card className="p-4">
        <CategoryForm
          onCreated={(category) =>
            fromExpense
              ? navigate("/expenses/new", { replace: true, state: { draft, categoryId: category.id } })
              : navigate("/categories", { replace: true })
          }
        />
      </Card>
    </Screen>
  );
}
```

- [ ] **Step 6: Add the route**

In `frontend/src/router.tsx`, add `import { NewCategoryPage } from "./pages/NewCategoryPage";` and the route, so the pushed screens read:

```tsx
      // Pushed screens: full screen with their own back button.
      { path: "/expenses/new", element: <NewExpensePage /> },
      { path: "/expenses/:id", element: <ExpenseDetailPage /> },
      { path: "/categories/new", element: <NewCategoryPage /> },
      { path: "/settings", element: <SettingsPage /> },
```

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run && npx tsc -b && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/CategoryForm.tsx frontend/src/pages/CategoriesPage.tsx frontend/src/pages/CategoriesPage.test.tsx frontend/src/pages/NewCategoryPage.tsx frontend/src/pages/NewCategoryPage.test.tsx frontend/src/router.tsx
git commit -m "feat: categories with emoji and color, and a new-category screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 11: Summary tab

**Files:**
- Rewrite: `frontend/src/pages/SummaryPage.tsx`, `frontend/src/pages/SummaryPage.test.tsx`

**Interfaces:**
- Consumes: `useSummary`; `GradientHeader`, `Card`, `Donut`, `CategoryChip`, `MoneyText`, `ChevronLeftIcon`, `ChevronRightIcon`; `currentMonthValue`, `shiftMonth`, `monthLabel`; `toCents`, `formatCents`, `sharePercent`; `colorVar`.

- [ ] **Step 1: Write the failing tests**

Replace `frontend/src/pages/SummaryPage.test.tsx` with:

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { currentMonthValue, monthLabel, shiftMonth } from "../lib/dates";
import { server } from "../test/server";
import { SummaryPage } from "./SummaryPage";

type Row = { category_id: number; name: string; color: string; icon: string; total: string };

const spending: Row[] = [
  { category_id: 1, name: "Rent", color: "sky", icon: "🏠", total: "900.00" },
  { category_id: 2, name: "Food", color: "amber", icon: "🍔", total: "12.50" },
  { category_id: 3, name: "Travel", color: "teal", icon: "✈️", total: "0" },
];

function fakeSummary(rows: Row[]) {
  const requested: string[] = [];
  server.use(
    http.get("/api/summary", ({ request }) => {
      const url = new URL(request.url);
      requested.push(`${url.searchParams.get("year")}-${url.searchParams.get("month")}`);
      return HttpResponse.json(rows);
    }),
  );
  return requested;
}

function renderPage() {
  const router = createMemoryRouter([{ path: "/summary", element: <SummaryPage /> }], {
    initialEntries: ["/summary"],
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const asParam = (value: string) => {
  const [y, m] = value.split("-").map(Number);
  return `${y}-${m}`;
};

describe("SummaryPage", () => {
  it("opens on the current month with its total and categories ranked", async () => {
    const requested = fakeSummary(spending);
    renderPage();

    expect(screen.getByRole("heading", { name: monthLabel(currentMonthValue()) })).toBeInTheDocument();
    expect(await screen.findByText("$912.50")).toBeInTheDocument();
    const list = screen.getByRole("list", { name: "Categories this month" });
    const rows = within(list).getAllByRole("listitem").map((li) => li.textContent);
    // Chips are aria-hidden but their emoji still count toward textContent.
    expect(rows).toEqual(["🏠Rent$900.0099%", "🍔Food$12.501%", "✈️Travel$0.00"]);
    expect(requested).toEqual([asParam(currentMonthValue())]);
  });

  it("steps back a month and can't go past the current month", async () => {
    const requested = fakeSummary(spending);
    renderPage();
    const user = userEvent.setup();
    await screen.findByText("$912.50");

    expect(screen.getByRole("button", { name: "Next month" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Previous month" }));

    const previous = shiftMonth(currentMonthValue(), -1);
    expect(await screen.findByRole("heading", { name: monthLabel(previous) })).toBeInTheDocument();
    await expect.poll(() => requested.at(-1)).toBe(asParam(previous));
    expect(screen.getByRole("button", { name: "Next month" })).toBeEnabled();
  });

  it("says when nothing was spent that month", async () => {
    fakeSummary([{ category_id: 3, name: "Travel", color: "teal", icon: "✈️", total: "0" }]);
    renderPage();

    expect(await screen.findByText(`No spending in ${monthLabel(currentMonthValue())}`)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/pages/SummaryPage.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Replace `frontend/src/pages/SummaryPage.tsx` with:

```tsx
import { useState } from "react";
import { useSummary } from "../api/summary";
import { Card } from "../components/Card";
import { CategoryChip } from "../components/CategoryChip";
import { Donut } from "../components/Donut";
import { GradientHeader } from "../components/GradientHeader";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import { MoneyText } from "../components/MoneyText";
import { currentMonthValue, monthLabel, shiftMonth } from "../lib/dates";
import { formatCents, sharePercent, toCents } from "../lib/money";
import { colorVar } from "../lib/palette";

const arrowClass = "inline-flex size-11 items-center justify-center rounded-full bg-white/20 disabled:opacity-40";

export function SummaryPage() {
  const thisMonth = currentMonthValue();
  const [monthValue, setMonthValue] = useState(thisMonth);
  const [year, month] = monthValue.split("-").map(Number);
  const summary = useSummary(year, month);

  // The API sorts by total, largest first, with unused categories (0) last.
  const rows = summary.data ?? [];
  const totalCents = rows.reduce((sum, r) => sum + toCents(r.total), 0);
  const segments = rows
    .filter((r) => toCents(r.total) > 0)
    .map((r) => ({ key: r.category_id, color: colorVar(r.color), cents: toCents(r.total) }));

  return (
    <>
      <GradientHeader>
        <div className="mt-2 flex items-center justify-between gap-2">
          <button type="button" aria-label="Previous month" onClick={() => setMonthValue(shiftMonth(monthValue, -1))} className={arrowClass}>
            <ChevronLeftIcon className="size-6" />
          </button>
          <div className="text-center">
            <h1 className="text-sm font-medium text-white/90">{monthLabel(monthValue)}</h1>
            <p className="text-3xl font-extrabold tracking-tight tabular-nums">{summary.data ? formatCents(totalCents) : "—"}</p>
          </div>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonthValue(shiftMonth(monthValue, 1))}
            disabled={monthValue === thisMonth}
            className={arrowClass}
          >
            <ChevronRightIcon className="size-6" />
          </button>
        </div>
      </GradientHeader>

      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-5">
        {summary.isPending && <p className="text-muted">Loading…</p>}
        {summary.isError && (
          <p role="alert" className="text-sm text-danger">
            {summary.error.message}
          </p>
        )}
        {summary.data && totalCents === 0 && (
          <Card className="p-6 text-center text-muted">No spending in {monthLabel(monthValue)}</Card>
        )}
        {summary.data && totalCents > 0 && (
          <Card className="p-4">
            <div className="flex justify-center py-2">
              <Donut segments={segments} size={160} thickness={24} />
            </div>
            <ul aria-label="Categories this month" className="mt-2 flex flex-col">
              {rows.map((r) => {
                const cents = toCents(r.total);
                const percent = sharePercent(cents, totalCents);
                return (
                  <li key={r.category_id} className="py-2.5">
                    <div className="flex items-center gap-3">
                      <CategoryChip category={r} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                      <MoneyText amount={r.total} className="font-bold" />
                      {cents > 0 ? (
                        <span className="w-10 text-right text-sm text-muted tabular-nums">{percent}%</span>
                      ) : (
                        <span className="w-10" aria-hidden="true" />
                      )}
                    </div>
                    {cents > 0 && (
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-app">
                        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: colorVar(r.color) }} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </main>
    </>
  );
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run && npx tsc -b && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/SummaryPage.tsx frontend/src/pages/SummaryPage.test.tsx
git commit -m "feat: summary tab with month arrows, donut and ranked categories

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**PR checkpoint:** open PR 3 (`feat/ui-screens` → `dev`), title `feat: redesigned screens`, with the manual checklist. Wait for CI and owner approval; squash-merge; update `dev`; create `feat/home-screen-app`.

---

## PR 4 — `feat/home-screen-app`

### Task 12: Manifest, icons, Apple tags and nginx headers

**Files:**
- Create: `frontend/public/icon.svg`, `frontend/scripts/gen-icons.mjs`
- Create (generated): `frontend/public/apple-touch-icon.png`, `frontend/public/icon-192.png`, `frontend/public/icon-512.png`
- Create: `frontend/public/manifest.webmanifest`, `frontend/src/pwa.test.ts`
- Delete: `frontend/public/favicon.svg`
- Modify: `frontend/index.html`, `frontend/nginx.conf`, `frontend/package.json` (+ lockfile)
- Modify: `docs/decisions/0015-mobile-access-as-home-screen-web-app.md`, `docs/decisions/README.md`, `docs/lessons-learned.md`, `deploy/README.md`

**Interfaces:**
- Produces: `npm run gen:icons` regenerates the three PNGs from `public/icon.svg`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pwa.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import html from "../index.html?raw";
import manifestText from "../public/manifest.webmanifest?raw";

const pngs = Object.keys(import.meta.glob("../public/*.png"));

describe("home-screen app", () => {
  it("links the manifest and sets the iOS home-screen tags", () => {
    for (const tag of [
      '<link rel="manifest" href="/manifest.webmanifest"',
      '<link rel="apple-touch-icon" href="/apple-touch-icon.png"',
      '<meta name="apple-mobile-web-app-capable" content="yes"',
      '<meta name="mobile-web-app-capable" content="yes"',
      '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"',
      '<meta name="apple-mobile-web-app-title" content="Expenses"',
      '<meta name="theme-color"',
      "viewport-fit=cover",
      "<title>Expense Tracker</title>",
    ]) {
      expect(html).toContain(tag);
    }
  });

  it("launches full screen under the name Expenses", () => {
    expect(JSON.parse(manifestText)).toMatchObject({
      name: "Expense Tracker",
      short_name: "Expenses",
      display: "standalone",
      start_url: "/",
      scope: "/",
    });
  });

  it("points at icon files that exist, including a maskable one", () => {
    const manifest = JSON.parse(manifestText) as { icons: { src: string; purpose?: string }[] };
    for (const icon of manifest.icons) expect(pngs).toContain(`../public${icon.src}`);
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
    expect(pngs).toContain("../public/apple-touch-icon.png");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run (from `frontend/`): `npx vitest run src/pwa.test.ts`
Expected: FAIL — `public/manifest.webmanifest` not found.

- [ ] **Step 3: Create the icon source**

Create `frontend/public/icon.svg` (full-bleed square: iOS and Android round the corners themselves; the donut stays inside the central safe zone for maskable icons). The four arcs are 38%, 28%, 22% and 12% of a radius-120 circle (circumference 753.98) with 6-unit gaps:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#2563eb"/>
      <stop offset="1" stop-color="#7c3aed"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g fill="none" stroke-width="56" transform="rotate(-90 256 256)">
    <circle cx="256" cy="256" r="120" stroke="#fbbf24" stroke-dasharray="280.5 473.48" stroke-dashoffset="0"/>
    <circle cx="256" cy="256" r="120" stroke="#34d399" stroke-dasharray="205.1 548.88" stroke-dashoffset="-286.5"/>
    <circle cx="256" cy="256" r="120" stroke="#38bdf8" stroke-dasharray="159.9 594.08" stroke-dashoffset="-497.6"/>
    <circle cx="256" cy="256" r="120" stroke="#ffffff" stroke-dasharray="84.5 669.48" stroke-dashoffset="-663.5"/>
  </g>
</svg>
```

- [ ] **Step 4: Add the generator and produce the PNGs**

Run: `npm install --save-dev --save-exact @resvg/resvg-js@2.6.2`

Create `frontend/scripts/gen-icons.mjs`:

```js
// Renders public/icon.svg to the PNG sizes the manifest and iOS use.
// Run with `npm run gen:icons` after editing the SVG; commit the PNGs.
import { readFileSync, writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";

const svg = readFileSync("public/icon.svg", "utf8");
const sizes = { "apple-touch-icon.png": 180, "icon-192.png": 192, "icon-512.png": 512 };

for (const [file, size] of Object.entries(sizes)) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(`public/${file}`, png);
  console.log(`public/${file} ${size}x${size}`);
}
```

In `frontend/package.json` `scripts`, add after `"gen:api"`:

```json
    "gen:icons": "node scripts/gen-icons.mjs"
```

Run: `npm run gen:icons`
Expected: three lines printed. Verify: `file public/*.png` shows `180 x 180`, `192 x 192`, `512 x 512` PNGs. Open `public/icon-512.png` (Read tool or Preview) and confirm the gradient square with the four-color donut.

- [ ] **Step 5: Create the manifest**

Create `frontend/public/manifest.webmanifest`:

```json
{
  "name": "Expense Tracker",
  "short_name": "Expenses",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#f8fafc",
  "theme_color": "#2563eb",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 6: Update index.html and remove the default favicon**

Run: `git rm public/favicon.svg`

In `frontend/index.html`, replace the line `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` with:

```html
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <meta name="theme-color" content="#2563eb" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Expenses" />
```

(The viewport line already has `viewport-fit=cover` from Task 4.)

- [ ] **Step 7: Run to verify pass**

Run: `npx vitest run && npx tsc -b && npm run lint && npm run build`
Expected: all PASS; `dist/` contains `manifest.webmanifest`, `icon.svg` and the three PNGs.

- [ ] **Step 8: nginx headers**

In `frontend/nginx.conf`, insert before the `# SPA fallback` comment:

```nginx
    # The app shell must revalidate on every launch so a home-screen install
    # picks up new deploys. SPA routes reach this too, via try_files below.
    location = /index.html {
        add_header Cache-Control "no-cache";
    }

    # nginx's default MIME table has no .webmanifest entry.
    location = /manifest.webmanifest {
        types { }
        default_type application/manifest+json;
        add_header Cache-Control "no-cache";
    }

```

- [ ] **Step 9: Verify the headers in the real image**

From the repo root (`--add-host` lets nginx resolve the `api` upstream without the backend running):

```bash
docker build -t expense-tracker-web:pwa-check frontend
docker run --rm -d --name pwa-check --add-host api:127.0.0.1 -p 18080:80 expense-tracker-web:pwa-check
sleep 1
curl -sI http://localhost:18080/ | grep -iE '^(cache-control|content-type)'
curl -sI http://localhost:18080/expenses/new | grep -iE '^cache-control'
curl -sI http://localhost:18080/manifest.webmanifest | grep -iE '^(cache-control|content-type)'
curl -sI http://localhost:18080/apple-touch-icon.png | grep -iE '^content-type'
docker rm -f pwa-check
```

Expected:
- `/`: `Content-Type: text/html` and `Cache-Control: no-cache`
- `/expenses/new`: `Cache-Control: no-cache`
- manifest: `Content-Type: application/manifest+json` and `Cache-Control: no-cache`
- icon: `Content-Type: image/png`

- [ ] **Step 10: Update ADR 15**

In `docs/decisions/0015-mobile-access-as-home-screen-web-app.md`, change the status line to:

```markdown
- **Status:** Accepted (implemented in the UI redesign, 2026-10)
```

and append:

```markdown
## Implementation notes

- A web app manifest (`short_name` "Expenses", `display: standalone`), a 180px Apple touch
  icon, and Apple meta tags for full-screen launch with a translucent status bar.
- **No service worker.** iOS launches a home-screen app full screen without one. Its main use
  is offline caching, which this app can't use (it needs its server), and a cached app shell
  can keep serving an old version after a deploy.
- Instead, nginx sends `Cache-Control: no-cache` for `index.html` and the manifest, so the app
  checks for a new version on every launch. Hashed files under `/assets/` stay cached for a
  year; their names change with every build.
- A home-screen app keeps its own cookies, separate from Safari, so it needs its own login once.
```

In `docs/decisions/README.md`, the row for decision 15 stays as is (title unchanged).

- [ ] **Step 11: Lessons entry**

In `docs/lessons-learned.md`, at the end of the `## Deployment` section (before `## Backups`), add:

```markdown
**nginx didn't know what a `.webmanifest` was** (found while planning, 2026-10-12)
- *Cause:* the `nginx:1.27-alpine` image's MIME table has no entry for `.webmanifest`, so the
  manifest would have been served as `application/octet-stream`.
- *Fix:* an exact-match location for `/manifest.webmanifest` that sets
  `application/manifest+json`. Checked with `curl -I` against the built image.
- *Takeaway:* when adding a new kind of static file, check the `Content-Type` the server
  actually sends.
```

- [ ] **Step 12: Runbook**

In `deploy/README.md`, in `## Deploying a new version`, after the code block that runs `docker compose up -d`, add:

```markdown
If the release adds a database migration, take a backup first:
`docker compose run --rm backup backup-now`.

The home-screen app picks up the new version the next time it is opened (close it from the app
switcher and reopen).
```

and add a new section after `## Deploying a new version` (before `## Rolling back`):

```markdown
## Installing on iPhone

1. Connect Tailscale on the phone.
2. In Safari, open the app's Tailscale address (`https://<vm-name>.<tailnet>.ts.net`).
3. Tap Share, then **Add to Home Screen**. The name defaults to "Expenses".
4. Open it from the home screen and log in. Home-screen apps keep their own cookies, separate
   from Safari, so this one login is needed even if Safari is already signed in.
```

- [ ] **Step 13: Commit**

```bash
git add frontend/public frontend/scripts frontend/src/pwa.test.ts frontend/index.html frontend/nginx.conf frontend/package.json frontend/package-lock.json docs/decisions docs/lessons-learned.md deploy/README.md
git commit -m "feat: installable home-screen app (manifest, icons, cache headers)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 13: Final verification and devlog

**Files:**
- Modify: `docs/devlog.md` (append)

- [ ] **Step 1: Full verification**

From `backend/`: `uv run ruff check . && uv run ruff format --check . && uv run alembic check && uv run pytest -q`
From `frontend/`: `npm run lint && npx vitest run && npm run build`
Expected: all PASS. Record the test counts for the devlog.

- [ ] **Step 2: Devlog entry**

Append to `docs/devlog.md` a dated section `## <date> — The redesign` covering, in the same plain first-person style as earlier entries:
- what shipped in PRs 1–4 (one line each, linking the spec and ADR 18);
- anything the reviews caught (copy from the progress ledger's Minor/Important findings);
- the two lessons added (negative cents, `.webmanifest` MIME type);
- test counts from Step 1;
- **Next:** deploy (backup first, then pull and up), install on the iPhone, then the longer-sessions project, the password-length fix, and piece 2.

- [ ] **Step 3: Commit**

```bash
git add docs/devlog.md
git commit -m "docs: devlog for the redesign

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

**PR checkpoint:** open PR 4 (`feat/home-screen-app` → `dev`), title `feat: installable home-screen app`, with the manual checklist plus "install from Safari after deploy". After merge, landing `dev` into `main` and the VM rollout (backup, pull, up, install) happen with the owner, following the spec's Rollout section.
