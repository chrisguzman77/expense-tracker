# Accounts and transactions (piece 2a)

Date: 2026-10-14
Status: approved design

## Context

[Record 13](../../decisions/0013-personal-finance-roadmap.md) defines piece 2 as reshaping
hand-entered expenses into transactions that belong to accounts, with CSV import.
[Record 19](../../decisions/0019-subscriptions-before-budgets-plaid-trial.md) adds that the data
model must not assume Plaid: CSV import is the fallback if Plaid's free plan changes.

Piece 2 is split in two, each with its own spec, plan and PRs:

- **2a (this spec):** accounts, signed transactions, category kinds.
- **2b (later):** CSV import, transaction editing, bank descriptions and duplicate detection.

The production database holds no categories or expenses yet, but the migration still moves
existing rows correctly (local dev data has some, and it is the habit to keep before real data
arrives).

## Decisions

- **Money in is allowed.** A transaction has one signed `amount`: negative is money out,
  positive is money in, as on a bank statement. Zero is rejected. Spending totals are net of
  refunds. Plaid reports the opposite sign; piece 3 flips it once on the way in.
- **Category kinds keep transfers and income out of spending.** Each category has a `kind`:
  `spending`, `income` or `transfer`. Only spending categories count in the summary (and later
  budgets). Rejected: linking the two sides of a transfer (fuzzy matching across accounts,
  needs its own UI, says nothing about income); deferring to 2b (the summary, category model
  and budgets all depend on it).
- **An account is a name and a type, with no balance.** Types: `checking`, `savings`,
  `credit_card`, `cash`. Every transaction belongs to exactly one account. Balances wait for
  piece 3, where Plaid supplies them. Rejected: optional accounts (every query, the UI and
  import would handle "no account"); editing a transaction's account (transaction editing
  belongs to 2b).
- **Rename `expenses` to `transactions`** everywhere (table, API, UI). "Expense" is wrong once
  money comes in, and every later piece speaks of transactions.
- **Accounts get a fourth tab.** Tabs: Transactions, Summary, Categories, Accounts. Rejected:
  accounts inside Settings (no per-account view; piece 3 would promote it anyway); an account
  filter on the list instead (a filter control is new UI that doesn't exist yet).

## Data model

- **`accounts` (new):** `id`, `user_id` (FK users, ON DELETE CASCADE, indexed), `name`
  String(50), `type` String(20), `created_at` (server default now).
  UniqueConstraint(user_id, name). `type` is validated by the API's Literal only, like category
  colors, so adding a type is a code change.
- **`transactions` (renamed from `expenses`):**
  - `spent_on` becomes `occurred_on`.
  - `amount` stays NUMERIC(12,2), now signed.
  - New `account_id`: NOT NULL, FK accounts ON DELETE RESTRICT, so deleting an account with
    transactions is refused, like categories.
  - Index `ix_expenses_user_spent_on` becomes `ix_transactions_user_occurred_on`; new index on
    `(account_id, occurred_on)` for the account screen.
  - `note` unchanged. No CSV or Plaid columns yet (2b adds the bank description and duplicate
    detection fields).
- **`categories.kind` (new):** String(20), server default `spending`, so existing categories
  become spending. Validated by the API's Literal only.

## Migrations

One per PR, each deployable on its own:

1. **Create `accounts`.** Additive.
2. **Reshape:**
   - rename table `expenses` to `transactions`, column `spent_on` to `occurred_on`, and the index;
   - rename the primary key constraint, both foreign key constraints and the id sequence
     (Postgres keeps the old names when a table is renamed);
   - add `account_id` nullable; for each user who has transactions, insert an account named
     "Cash" of type `cash` unless they already have an account with that name (PR 1 ships
     accounts first, so one may exist; `ON CONFLICT DO NOTHING` on the unique constraint);
     point their transactions at their account named "Cash"; make `account_id` NOT NULL and
     add the FK and the new index;
   - negate every `amount`;
   - downgrade reverses the schema steps (negate amounts, drop the index, FK and
     `account_id`, rename everything back) but leaves rows in `accounts` alone: accounts are
     user data once created, and only migration 1's downgrade drops that table. A later
     re-upgrade reuses the existing "Cash" account through the same conflict rule.
3. **Add `categories.kind`.**

## API

Same layering as today: thin routers, services raising domain exceptions, every query scoped to
the current user, "not yours" returning 404.

**Accounts** (new `routers/accounts.py`, `services/accounts.py`):

- `GET /api/accounts` → the user's accounts, ordered by name.
- `POST /api/accounts` `{name, type}` → 201 `AccountRead`; duplicate name → 409 (IntegrityError
  caught and rolled back in the service, as for categories); unknown type or bad name → 422.
- `DELETE /api/accounts/{id}` → 204; missing or not yours → 404 "Account not found"; has
  transactions → 409 "Account has transactions".
- `AccountRead`: `{id, name, type}`. `AccountCreate`: `name` 1-50 characters, `type` Literal.

**Transactions** (`routers/expenses.py` and `services/expenses.py` renamed to
`transactions.py`; categories and summary stay in those files):

- `GET /api/transactions?start&end&account_id` → newest date first, then newest id.
  `account_id` is an optional filter; a missing account or someone else's returns 404
  "Account not found" (not an empty list, which would hide a wrong id).
- `POST /api/transactions` `{account_id, category_id, amount, occurred_on, note}` → 201.
  `amount` signed, nonzero, max 12 digits, 2 decimals. `occurred_on` no more than one day in
  the future (unchanged rule). Account missing or not yours → 404 "Account not found";
  category → 404 "Category not found" (fixes the old "Expense not fund").
- `DELETE /api/transactions/{id}` → unchanged apart from the path.
- `TransactionRead`: `{id, amount, occurred_on, note, category: CategoryRead, account:
  AccountRead}`.
- `/api/expenses` is removed with no deprecation period: the only client ships in the same PR.

**Categories:** `CategoryCreate` and `CategoryRead` gain `kind` (Literal, default `spending`).
Delete conflict message becomes "Category has transactions".

**Summary** `GET /api/summary?year&month`:

- `total` is minus the sum of amounts, so spending reads positive: a −50.00 purchase and a
  +20.00 refund in one category give `"30.00"`. A category whose refunds outweigh its spending
  has a negative total, returned as-is.
- From migration 3 on: only `spending` categories are listed.
- Keeps the outer join with the date range in the ON clause, so empty spending categories
  show 0.

## Frontend

Existing patterns: Screen, Card, Field, native-select styling, in-page confirmation.

- **Renames:** the Expenses tab becomes Transactions (still `/`); `/expenses/new` →
  `/transactions/new`; `/expenses/:id` → `/transactions/:id`; `api/expenses.ts` →
  `api/transactions.ts`; page and component files renamed to match.
- **Accounts tab** (fourth):
  - `/accounts`: list with a type icon (🏦 checking, 🐷 savings, 💳 credit card, 💵 cash) and a
    type label; + opens the create screen; empty state "No accounts yet."
  - `/accounts/new`: name field and a type picker of four buttons, styled like the category
    color picker.
  - `/accounts/:id`: name and type, the account's transactions (same rows as the main list,
    from PR 2), and Delete with inline confirmation; a 409 shows "This account still has
    transactions; delete them first."
- **Add transaction** (`/transactions/new`):
  - "Money out / Money in" toggle at the top, default money out; the amount field stays
    positive and the sign is applied on submit.
  - Account select: preselected when there is exactly one; with none, the page shows "Add an
    account first" linking to `/accounts/new` instead of the form.
  - Category select grouped by kind with native `optgroup` (Spending, Income, Transfer) once
    kinds exist.
  - The create-category-with-draft flow is unchanged.
- **Amounts:** money out looks as today ("$12.50", no minus sign); money in shows "+$20.00" in a
  green tone in rows, the detail page and the account screen. Rows show the account name under
  the category in muted text; the detail page shows the account.
- **Categories:** the create screen gets a Spending / Income / Transfer picker (default
  Spending); the list labels income and transfer categories.
- **Summary and breakdown card:** spending-only through `/api/summary`; the donut leaves out
  any category whose total is zero or below; the ranked list still shows the number.
- After implementation: 390px light and dark screenshots of the new screens with the CDP
  script.

## Tests (first)

Backend:

- `test_accounts.py`: create and list; duplicate name 409; unknown type 422; delete; delete with
  transactions 409; someone else's account 404 on delete and on the transactions filter.
- `test_expenses.py` → `test_transactions.py`: money in accepted; zero 422; account or category
  not yours → 404 with the right message; `account_id` filter.
- Summary: net of refunds; negative total returned as-is; income and transfer categories left
  out (PR 3); the outer-join regression test keeps passing.
- Categories: kind defaults to spending; unknown kind 422.
- Deleting a user who has an account, a category and a transaction removes all of them
  (transactions reference both with RESTRICT, which Postgres checks immediately; a throwaway
  probe during design passed, and this test keeps it true).
- **Migration test** (automated, runs in CI): runs Alembic programmatically against a dedicated
  `expenses_migration_test` database, so the normal test schema is untouched. Upgrade to the
  revision before the reshape, insert a user, a category and two expenses with raw SQL, upgrade
  to head, and check: a "Cash" account exists, both rows point at it, amounts are negated, the
  table, column, index, constraints and sequence carry their new names. Downgrade and check the
  original rows and names return. Upgrade again and check the existing "Cash" account is
  reused (one account, not a conflict error). A second case: a user who already created an
  account named "Cash" before the reshape gets their expenses moved into it. CI's database step also creates `expenses_migration_test`.

Frontend:

- Accounts screens: list, empty state, create, delete with confirmation, 409 message.
- Add-transaction form: the toggle sends a negative amount for money out and positive for money
  in; one account preselected; none shows the prompt; categories grouped by kind.
- Amount display: money in as "+$20.00"; donut leaves out totals of zero or below.
- Category kind picker.
- Existing tests renamed and updated.

## Docs

- ADR 21 "Accounts, signed transactions and category kinds" (sign convention, kinds over
  transfer linking, the rename, required accounts without balances, the 2a/2b split). Record
  13's status gets "amended by 21"; README gets row 21.
- Devlog entry; lessons-learned entries for surprises.

## Delivery

Three PRs into `dev`, each with its own migration:

1. `feat/accounts`: this spec, the plan, ADR 21, accounts table and API, Accounts tab, create
   screen, account screen with delete.
2. `feat/transactions`: reshape migration and its test, renames, signs, toggle and account
   select, account names on rows, the account screen's transactions, donut leaving out
   non-positive slices.
3. `feat/category-kinds`: `kind` column, picker, spending-only summary, grouped category
   select, devlog and lessons.

Then `dev` lands into `main` (carrying #34). Rollout: backup-now (migrations), pull, up.
