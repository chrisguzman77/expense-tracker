# 13. Grow into a personal finance app, data safety first

- **Date:** 2026-10-11
- **Status:** Accepted; order of pieces 4 and 5 amended by [record 19](0019-subscriptions-before-budgets-plaid-trial.md); piece 2 refined by [record 21](0021-accounts-signed-transactions-and-category-kinds.md)

## Context

The MVP logs expenses by hand. The goal is a self-hosted personal finance app in the spirit of
Rocket Money: connected bank and card accounts, budgets, and detection of subscriptions I've
forgotten. Real financial data raises the bar for safety and security.

## Decision

Build in five pieces, each with its own design, plan and pull requests:

1. **Data safety:** protected storage and verified offsite backups (records 11 and 12).
2. **Accounts and transactions:** reshape hand-entered expenses into transactions that belong
   to accounts, with CSV import from bank exports.
3. **Bank sync** through an aggregator (candidates: Plaid, Teller, SimpleFIN), with encrypted
   token storage and scheduled sync.
4. **Budgets:** monthly limits per category with spending against them.
5. **Subscription detection:** recurring charges from the same merchant on a regular schedule.

Constraints: free tiers wherever possible; the app stays private behind Tailscale.

## Consequences

- No real financial data is stored until piece 1 is deployed.
- Pieces 4 and 5 can be built on CSV-imported data, so bank sync doesn't block them.
- The aggregator choice is deferred to piece 3's design.
