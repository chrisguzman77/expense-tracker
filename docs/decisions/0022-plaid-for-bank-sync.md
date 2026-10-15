# 22. Plaid for bank sync; CSV import dropped as a planned piece

- **Date:** 2026-10-15
- **Status:** Accepted (refines [record 19](0019-subscriptions-before-budgets-plaid-trial.md);
  amends the piece 2 split in [record 21](0021-accounts-signed-transactions-and-category-kinds.md))

## Context

[Record 21](0021-accounts-signed-transactions-and-category-kinds.md) split piece 2 into 2a
(accounts, signed transactions, category kinds; live) and 2b (CSV import, transaction editing,
bank descriptions, duplicate detection). [Record 19](0019-subscriptions-before-budgets-plaid-trial.md)
planned bank sync on Plaid's free Trial, kept CSV import as the fallback, and asked for a
coverage check before building on Plaid. It left the final provider choice to piece 3.

Before starting 2b I asked whether CSV import was needed at all. With a bank connection, I
would import a file once or twice and never again.

The coverage check ([research note](../research/plaid-coverage.md)) found:

- All four of my banks (Wells Fargo, Chase, Capital One, Discover) are on Plaid with
  Transactions.
- The Trial needs no extra steps for their bank logins.
- Sign-up has a personal-use option, and the Trial was granted immediately.

## Decision

- **Plaid is the bank-sync provider**, on the Trial plan.
- **CSV import is dropped as a planned piece.** It stays the fallback if the Trial ends or a
  bank stops working. One possible exception is a one-time backfill of Capital One history
  older than Plaid's 90 days; that would get its own decision if I want it.
- **The rest of 2b moves into piece 3**, which is split into three parts, each with its own
  spec, plan and pull requests:
  - **3a:** the coverage check, plus editing transactions, categories and accounts. Editing is
    needed whatever the data source.
  - **3b:** connecting. Plaid Link, the token exchange, encrypted token storage, and Plaid's
    accounts becoming the app's accounts.
  - **3c:** syncing. Transactions, bank descriptions, pending to posted, duplicates of
    hand-entered rows, suggested categories, and locking the fields the bank owns.
- **Ask for 730 days of history** when each bank is connected. It can't be extended later
  without reconnecting, which costs one of the Trial's 10 lifetime connections.
- **Sync on a schedule**, plus a "sync now" button. Plaid's webhooks need a public URL, and this
  app is only reachable on my tailnet.

The Plaid client library and how access tokens are encrypted get their own record in 3b.

## Alternatives considered

- **CSV import first, as planned.** Works with no third party, but builds an importer I would
  use once.
- **SimpleFIN Bridge or Teller.** Record 19's reasons still hold:
  - SimpleFIN costs money and keeps only 90 days of history;
  - Teller's Discover coverage and eligibility for individuals were unconfirmed.
  - Plaid now checks out for every bank I use.

## Consequences

- Piece 2 ends at 2a; editing shipped as part of 3a.
- Capital One:
  - 90 days of history, so yearly subscriptions on that card won't show until a year of
    syncing (or a backfill);
  - no on-demand refresh;
  - no pending transactions.
- Discover is moving to Capital One logins. A Discover connection made before the move will
  probably need re-linking, using another slot. 3b decides whether to wait.
- Open until 3b tests them in the sandbox:
  - whether the tailnet-only HTTPS address works as Plaid's redirect URI;
  - what the bank login does inside the iOS home-screen app.
