# UI redesign and home-screen app

Date: 2026-10-12
Status: approved design, pending implementation plan

## Context

The app is live on the owner's VM and used from both a laptop and an iPhone (over Tailscale).
The current UI is plain Tailwind: a single-row header (title, three nav links, email, Log out)
that overflows at phone width, a form above a bordered list, red text "Delete" links that are
easy to mis-tap, raw amounts (`12.5`), and a bare summary table. `index.html` has no manifest,
icons, `theme-color` or `viewport-fit`, so "Add to Home Screen" gives a generic bookmark.

Design choices below were made with mockups in the brainstorming visual companion.

## Goal

A distinctive, phone-first UI that also looks deliberate on a laptop, installable on the iPhone
home screen as a full-screen app.

## Non-goals

- Longer sessions on trusted devices (60-minute JWT). Separate project, next after this one.
- Editing expenses or categories (no update endpoints exist; detail screen leaves room for Edit).
- Multi-month trend charts (fits better with budgets, roadmap piece 4).
- Swipe gestures, bottom sheets, modals.
- Service worker or offline mode.
- The `UserCreate.password` max_length bug (separate small PR).

## Visual direction

"Bold and colorful": a blue-to-violet gradient header (`#2563eb` → `#7c3aed`), white rounded
cards, saturated per-category colors and emoji chips, heavy type for totals. Light, dark, or
follow the system.

## Screens and navigation

| Route | Screen |
|---|---|
| `/` | Expenses tab. Gradient header with this month's total and a `+` button. Breakdown card overlapping the header (see below). Expenses grouped under date headings ("Today", "Oct 10", most recent first); each row shows category chip (emoji on category color), category name, note, and amount. Tapping a row opens its detail screen. |
| `/expenses/new` | New expense screen. ‹ Back, then amount, category picker (includes a "+ New category" entry), date (defaults to today, same future-date rule as today), note, Add button. On success returns to `/`. |
| `/expenses/:id` | Expense detail. All fields and a Delete button that asks for confirmation inline (no modal) before deleting. Reads from the loaded expense list; an unknown id shows "Expense not found". |
| `/summary` | Summary tab. Header with ‹ month › arrows and the month total, a large donut, then every category ranked by total with amount, percent of month and a share bar. Opens on the current month; › is disabled at the current month (no future months). Categories with a 0 total are listed last without a share bar. |
| `/categories` | Categories tab. List of categories (chip + name) with delete; add form with name, emoji, and color swatch picker. Deleting a category that has expenses shows the existing 409 message, styled. |
| `/categories/new` | New category screen (same form), reached from "+ New category" on the new-expense screen; on success returns to `/expenses/new` with the new category pre-selected. |
| `/settings` | Settings: signed-in email, Light / Dark / System theme control, Log out. Opened by a gear button in the header. |
| `/login`, `/register` | Gradient background, centered white card. Register stays reachable by URL only (registration is closed in production). |

### Breakdown card (Expenses tab)

- Expanded: title "Breakdown", a "Hide" toggle, a donut of this month's spending by category, and a
  legend listing the top 4 categories with amounts ("+ N more" if there are more).
- Collapsed: one line with a tiny donut, "Breakdown", the top category and its amount, and a
  "Show" toggle.
- The state is stored per device in `localStorage` (key `breakdown-collapsed`) and restored on
  load. Default: expanded.
- Data comes from the existing `GET /api/summary` for the current month.
- With no spending this month, the card shows "No spending yet this month" instead of a donut.

### Navigation

- Phone (< 768px): bottom tab bar with Expenses, Summary, Categories.
- Wide (≥ 768px): the same tabs move into the gradient header as a top bar; content widens to a
  comfortable column, and on the Expenses tab the breakdown card sits beside the list.
- Pushed screens (`/expenses/new`, `/expenses/:id`, `/categories/new`, `/settings`) hide the tab
  bar and show a ‹ Back button (needed because standalone home-screen apps have no browser back).

### Data freshness

Creating or deleting an expense invalidates both the expenses query and the summary queries
(today only the expenses list refreshes, which would leave the breakdown card stale). Creating or
deleting a category invalidates categories and summary.

## Visual system

### Theme tokens

- Colors are CSS custom properties in `src/index.css` (e.g. `--bg`, `--surface`, `--text`,
  `--muted`, `--border`, `--accent`), exposed to Tailwind v4 via `@theme`, so components use
  classes like `bg-surface` and `text-muted`.
- Dark mode redefines the same properties under `[data-theme="dark"]` on `<html>`. Components
  never hard-code a light/dark pair. The gradient header is identical in both themes.
- Theme preference is stored per device in `localStorage` (key `theme`, values `light`, `dark`,
  `system`; default `system`). `system` follows `prefers-color-scheme` and reacts to changes.
- A small inline script in `index.html` resolves and sets `data-theme` before React loads, so
  there is no light flash at night. nginx sends no Content-Security-Policy today; if one is added
  later, this script needs a hash.

### Category palette

- Ten named colors: `amber`, `emerald`, `sky`, `violet`, `rose`, `orange`, `teal`, `indigo`,
  `lime`, `slate`. Each has a light-theme and a dark-theme shade.
- `src/lib/palette.ts` maps a name to its shades. The backend accepts exactly these names.

### Type and money

- System font stack (San Francisco on Apple devices). No web fonts.
- Amounts use tabular figures.
- New helper `formatUsd(amount: string): string`, e.g. `"1284.5"` → `"$1,284.50"`, built on the
  existing integer-cents functions in `src/lib/money.ts`. No floating-point money math anywhere,
  including donut segments and percentages (computed from cents).

### iPhone and accessibility rules

- Tap targets at least 44px tall.
- Form inputs use a 16px font size (smaller makes iOS Safari zoom on focus).
- Safe-area padding via `env(safe-area-inset-*)`: header clears the notch/status bar, tab bar
  clears the home indicator. `viewport-fit=cover` lets the gradient run under the status bar.
- Category color is never the only signal; the name is always shown.
- Visible focus rings for keyboard use.
- The donut is `aria-hidden`; the legend and ranked list carry the same numbers as text.
- Text colors meet WCAG AA contrast in both themes.

## Components

Hand-built on Tailwind in `src/components/`, no new runtime dependencies:

- `Button` (primary gradient, secondary, danger variants)
- `Card`
- `Screen` (pushed-screen shell: title and ‹ Back)
- `TabBar` (bottom on phone, top bar on wide screens)
- `CategoryChip` (emoji on the category's palette color)
- `Donut` (hand-written SVG; takes segments of `{ color, cents }`)
- `MoneyText` (formats with `formatUsd`, tabular figures)

The app shell (`AppLayout`) renders the gradient header, gear button and `TabBar`.

## Backend: category color and icon

- Model `Category` (`backend/app/models/expense.py`) gains:
  - `color: Mapped[str] = mapped_column(String(20), server_default="slate")`
  - `icon: Mapped[str] = mapped_column(String(16), server_default="🏷️")`
- One Alembic migration adds both columns with those server defaults, so existing rows (including
  production categories) are filled by the database.
- Schemas (`backend/app/schemas/expense.py`):
  - `CategoryColor = Literal["amber", "emerald", "sky", "violet", "rose", "orange", "teal", "indigo", "lime", "slate"]`
  - `CategoryCreate` gains `color: CategoryColor = "slate"` and
    `icon: str = Field("🏷️", min_length=1, max_length=16)`. Defaults keep older clients and
    existing tests working; the new UI always sends both.
  - `CategoryRead` and `CategorySummary` gain `color` and `icon`. The summary query already joins
    categories, so colors arrive without a second request.
- An unknown color or an empty/over-long icon is rejected with 422 by Pydantic validation.
- The icon is not checked to be an emoji (that needs a Unicode library; not worth it for one
  user). The 16-character cap allows multi-codepoint emoji such as 👨‍👩‍👧.
- Color is validated in the API schema only, with no database CHECK constraint, so adding a
  palette color later is a code change rather than a migration.
- Editing color or icon after creation is out of scope.
- Ownership rules are unchanged.

## Home-screen app

- `public/manifest.webmanifest`: `name` "Expense Tracker", `short_name` "Expenses",
  `display` "standalone", `start_url` "/", `scope` "/", `theme_color` and `background_color`
  from the palette, icons 192px and 512px plus a 512px `maskable` icon.
- `public/apple-touch-icon.png` (180×180), the icon iOS uses.
- `public/icon.svg` is the source: a small multicolor donut on the gradient. PNGs are generated
  from it once and committed; the plan specifies the command so they can be regenerated.
- `index.html`: `<link rel="manifest">`, `<link rel="apple-touch-icon">`,
  `apple-mobile-web-app-capable` and `mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style` `black-translucent`,
  `apple-mobile-web-app-title` "Expenses", `theme-color`, and `viewport-fit=cover`. The browser
  tab title stays "Expense Tracker".
- No service worker. iOS standalone launch does not require one, offline mode is useless for an
  app that needs its server, and service-worker caching can serve a stale app after a deploy.
- nginx (`frontend/nginx.conf`):
  - `.webmanifest` served as `application/manifest+json` (add a `types` rule only if the image's
    default MIME table lacks it; verify).
  - `Cache-Control: no-cache` on `index.html` and the manifest, so a home-screen app revalidates
    on launch and picks up deploys. Hashed `/assets/` keep their one-year immutable cache.
- Known behavior: a home-screen app has its own cookie storage, separate from Safari, so the owner
  logs in once inside it. The 60-minute session still applies until the sessions project.
- Install: in Safari open the Tailscale URL, Share, "Add to Home Screen". Documented in the
  runbook.

## Testing

- Backend (pytest): create with color and icon and read them back; create without them gets the
  defaults; unknown color returns 422; empty or over-long icon returns 422; summary rows include
  color and icon. Existing ownership tests unchanged.
- Frontend (Vitest + RTL + MSW), querying by role and label rather than classes:
  - add an expense on `/expenses/new` and land back on the list
  - delete from the detail screen with confirmation; "Expense not found" for an unknown id
  - create a category with color and emoji; "+ New category" returns to the expense form with it
    pre-selected
  - summary month arrows change the requested month
  - theme control sets `data-theme` and persists to `localStorage`
  - breakdown card collapse state persists across remounts
  - unit tests: `formatUsd` (thousands separators, cents, negative values); donut percentages
    from cents
  - palette drift: every color allowed by the generated API types has an entry in `palette.ts`
- No automated screenshot tests. Each UI PR includes a manual checklist: 390px width in devtools,
  dark mode, laptop width. The owner checks the real iPhone after deploy.

## Delivery

Feature branches into `dev`, squash-merged:

1. `feat/category-appearance`: backend color and icon, migration, tests, regenerated
   `schema.d.ts`, updated frontend fixtures. Also carries this spec and the pending devlog notes
   (production rollout first run from `~` instead of `~/expense-tracker`, where compose's `:?`
   checks refused safely; the false-alarm missing-account report that was a phone typo).
2. `feat/ui-foundation`: theme tokens and no-flash script, components, `formatUsd`, `palette.ts`,
   app shell (header, tab bar, gear), Settings screen, restyled login and register.
3. `feat/ui-screens`: Expenses tab with breakdown card, new-expense and detail screens, Summary,
   Categories, new-category screen, query invalidation changes.
4. `feat/home-screen-app`: manifest, icons, Apple tags, nginx headers and MIME type, runbook
   install steps.

## Documentation

- ADR 18: own component set on Tailwind, hand-written SVG donut, validated named palette (versus
  shadcn/ui, a full UI library, or a chart library).
- ADR 15 (currently Proposed): updated to Accepted, recording the no-service-worker decision and
  the cache-header reasoning.
- Lessons-learned entries for surprises (likely: iOS input zoom under 16px; separate cookie
  storage for home-screen apps).
- Devlog entry each session.

## Rollout

1. Land `dev` into `main` with a merge commit; images publish.
2. On the VM, run a manual `backup-now` before pulling (this deploy includes a migration).
3. `docker compose pull && docker compose up -d`; the `migrate` service adds the columns and
   existing categories become `slate` / 🏷️.
4. Owner installs from Safari and checks the app on the iPhone.
