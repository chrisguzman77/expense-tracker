# 19. Subscriptions before budgets; Plaid's free plan as the planned aggregator

- **Date:** 2026-10-13
- **Status:** Accepted (amends the order in [record 13](0013-personal-finance-roadmap.md))

## Context

Record 13 set five pieces: data safety, accounts and transactions, bank sync, budgets, then
subscription detection. The feature I care about most is finding subscriptions I've forgotten,
and the way Rocket Money does it is: connect accounts once, pull the transaction history, and
show recurring charges right away, with nothing to do by hand.

Researching aggregators for my own institutions (Wells Fargo debit; Discover, Chase and Capital
One credit cards), as of October 2026:

- **Plaid's Trial plan:** free, up to 10 connections (one per bank login), for new US accounts
  created on or after 2026-04-15. No time limit appears in Plaid's docs; the limit is the
  connection count. Transactions are included; up to two years of history can be requested at
  connect time. Wells Fargo and Chase are explicitly supported; Discover and Capital One are
  unconfirmed. The connection limit is lifetime: removing a connection doesn't free its slot.
- **SimpleFIN Bridge:** about $15 a year, built for self-hosters, simplest to integrate, but
  only 90 days of history and one refresh a day.
- **Teller:** free development tier, but Discover coverage and eligibility for individuals are
  unconfirmed.
- **Quicken-style direct connections:** dropped by Chase and Discover.
- **The CFPB personal data rights rule (Section 1033):** enjoined and being rewritten, so it
  gives no usable API access today.
- Capital One is moving Discover accounts to Capital One logins over the coming year, so a
  Discover connection on any provider will need re-linking once.

## Decision

- Swap pieces 4 and 5. The order is now: accounts and transactions, bank sync, **subscription
  detection**, then **budgets**. (A smaller project, longer sessions on trusted devices, comes
  first because the phone app logs out every hour.)
- Plan bank sync on **Plaid's Trial plan**, with CSV import as the free fallback. Piece 3 starts
  with a coverage check: link all four institutions in Plaid's sandbox before building on it.
  The final provider choice and token handling get their own record in piece 3.
- Develop against Plaid's sandbox only and connect real accounts once, deliberately, to protect
  the 10-connection limit. Request about two years of history so yearly subscriptions appear
  twice.
- Write our own subscription detection over stored transactions (Plaid's recurring-transactions
  feature isn't confirmed on the free plan). Expect near-complete results for monthly
  subscriptions and weaker results for yearly ones and for bundled billers like Apple, Google
  and PayPal, so the design shows confidence levels and lets me confirm or dismiss. Measure
  precision and recall against my own labelled history.

## Alternatives considered

- **Keep the original order.** Budgets first delays the feature that motivated the project.
- **Subscription detection on CSV imports before any bank sync.** Works with no third party,
  but downloading statements by hand isn't the "connect once" experience I want; CSV stays as
  the fallback instead.
- **SimpleFIN Bridge as the main path.** Not free, and 90 days of history is too short for
  yearly subscriptions.

## Consequences

- Subscription results arrive one piece earlier.
- The app depends on Plaid's free-plan terms; if they change, SimpleFIN or CSV import are the
  fallbacks, which is why piece 2's data model must not assume Plaid.
- Real bank access tokens will live on the VM, so piece 3 must encrypt them at rest.
