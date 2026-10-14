# 21. Accounts, signed transactions and category kinds

- **Date:** 2026-10-14
- **Status:** Accepted (refines piece 2 of [record 13](0013-personal-finance-roadmap.md))

## Context

Record 13's piece 2 turns hand-entered expenses into transactions that belong to accounts,
with CSV import. [Record 19](0019-subscriptions-before-budgets-plaid-trial.md) adds that the
data model must not assume Plaid, because CSV import is the fallback if Plaid's free plan
changes. Real bank data, from either source, brings things the app can't represent today:
refunds, paychecks, and card payments that show up on two accounts at once.

The production database had no categories or expenses yet when this was decided, so the
reshape is cheap now and expensive later.

## Decision

- **Split piece 2.** 2a: accounts, signed transactions, category kinds. 2b: CSV import,
  transaction editing, bank descriptions and duplicate detection. Each gets its own spec,
  plan and pull requests.
- **One signed amount.** Negative is money out, positive is money in, as on a bank statement;
  zero is rejected. Spending totals are minus the sum, so refunds reduce them. Plaid reports
  the opposite sign; piece 3 flips it once on the way in.
- **Category kinds keep transfers and income out of spending.** Every category is spending,
  income or transfer. Only spending categories count in the summary (and later in budgets).
  A card payment filed under a transfer category is ignored on both accounts.
- **An account is a name and a type** (checking, savings, credit card, cash), with no
  balance. Every transaction belongs to exactly one account. Balances wait for piece 3, where
  Plaid supplies them.
- **Rename `expenses` to `transactions`** in the table, API and UI. The migration also renames
  the sequence, constraints and index that Postgres leaves behind, moves existing rows into an
  account named "Cash" (reusing one if the user already has it) and negates their amounts. It
  is tested against a real database in CI.
- **Accounts get a fourth tab**, where piece 3's "connect a bank" will live.

## Alternatives considered

- **Money out only in 2a.** Smaller, but 2b would change the sign convention and the summary
  maths again, on data that already includes imports.
- **Linking the two sides of a transfer.** Exact, and could be auto-matched later, but matching
  across imported accounts is fuzzy (dates differ, descriptions don't match), it needs its own
  UI, and it says nothing about income. It can still be added on top of kinds.
- **Optional accounts.** Old expenses could stay unassigned, but every query, the UI and import
  would carry a "no account" case forever.
- **Accounts inside Settings, or a filter on the transaction list.** Less visible, no
  per-account view, and a filter control is UI that doesn't exist yet.
- **Keeping the name `expenses`.** Wrong as soon as money comes in.

## Consequences

- Every later piece (import, Plaid, subscription detection, budgets) builds on the sign
  convention and the kinds.
- Transfers are only excluded if they are filed under a transfer category; an unfiled card
  payment would count as spending.
- The reshape's downgrade is lossy once money-in rows exist (they would come back as negative
  expenses, which the old API rejects); it exists for development.
- No balances until piece 3.
