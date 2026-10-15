# Plaid coverage check (piece 3a)

Date: 2026-10-14 (docs research) and 2026-10-15 (checks against my own Plaid account)

[Record 19](../decisions/0019-subscriptions-before-budgets-plaid-trial.md) planned bank sync on
Plaid's free Trial and asked for a coverage check before building on it. This note is that check.
The decision that follows from it is [record 22](../decisions/0022-plaid-for-bank-sync.md).

My institutions: Wells Fargo (checking), Chase, Capital One and Discover (credit cards).

## Result

All four banks are supported, with Transactions, and the Trial needs no extra steps for them.

| Bank | Plaid institution ID | Bank login (OAuth) | Transactions | Transactions Refresh |
|---|---|---|---|---|
| Wells Fargo | `ins_127991` | yes | yes | yes |
| Chase | `ins_56` | yes | yes | yes |
| Capital One | `ins_128026` | yes | yes | **no** |
| Discover | `ins_33` | yes | yes | yes |

All four also list `recurring_transactions` (Plaid's own recurring-charge detection). These
lists say what each bank supports, not what the Trial plan includes.

## What I checked

1. **Sign-up and Trial.**
   - The dashboard sign-up has a "personal use" option, so no company is needed.
   - The Trial was granted immediately.
   - The application's website field is required for some banks (American Express, Capital One,
     PNC, Truist); I gave the public GitHub repository.
2. **Sandbox institution search** (`/institutions/search`, country US, no product filter),
   run from my own terminal with the sandbox keys kept out of the repository and the chat.
   That search produced the table above.
3. **Dashboard, Institutions page.**
   - The OAuth institutions tab says: "Automatic bank access. No action is needed to access banks
     through Plaid's free trial."
   - Each bank's health page is empty until production access, which only affects the charts.
   - Capital One shows "This institution is currently migrating". I couldn't open its status
     details, so what is migrating and when is unknown.
4. **Capital One's own website.**
   - The transaction download shows no limit on how far back it goes (not yet confirmed with
     an actual download of old dates).
   - My Discover card has not moved to a Capital One login yet.

## From Plaid's documentation

Read on 2026-10-14. Support articles were only available through search summaries, marked
"(summary)".

- **Trial terms** ([billing docs](https://plaid.com/docs/account/billing/)):
  - free for new US and Canadian teams created on or after 2026-04-15;
  - 10 production Items (one per bank login), and removing one doesn't free its slot;
  - no stated time limit;
  - includes Transactions (with Refresh) and Balance;
  - a team with a pending or approved production application can't use the Trial (summary).
- **OAuth** ([OAuth guide](https://plaid.com/docs/link/oauth/)):
  - Trial users can defer the security questionnaire and company registration until they
    upgrade.
  - Chase lets the user choose consent length (6 months, 1 year or always).
  - Capital One needs consent renewed yearly, refuses past-due cards, and reports no pending
    transactions.
- **Redirect URI** ([Link API](https://plaid.com/docs/api/link/)):
  - must be HTTPS in production, have no query parameters, and be on the dashboard allowlist;
  - whether it must be reachable from the internet isn't documented.
- **History:**
  - `days_requested` is 1 to 730 (default 90), set when the connection is created, and can't be
    changed afterwards ([Transactions API](https://plaid.com/docs/api/products/transactions/));
  - getting more means reconnecting, which costs another Trial slot;
  - Capital One provides only 90 days (summary);
  - Chase (about 24 months) and Wells Fargo checking (about 18 months) come from one third-party
    source only.
- **Sync** ([rate limits](https://plaid.com/docs/errors/rate-limit-exceeded/)):
  - `/transactions/sync` is a cursor API, limited to 50 calls a minute per Item;
  - Plaid's push notifications (webhooks) need a publicly reachable URL.

## Consequences for 3b and 3c

- **Request 730 days** of history on the first and only connection to each bank.
- **Sync on a schedule** (and a "sync now" button). Webhooks can't reach an app that is only on
  my tailnet.
- **Capital One updates on Plaid's schedule only**, because it has no Refresh, and it shows no
  pending transactions.
- **Capital One's 90 days** are too short to see yearly subscriptions. Its own download appears
  to go further back, so a one-time CSV backfill for that account is a realistic option later.
  Not planned yet.
- **Discover will move to Capital One logins.** A Discover connection made before the move will
  probably need re-linking, using another slot. Decide in 3b whether to wait, after checking
  the dashboard's Migrations tab.

## Still open (tested in 3b, in the sandbox, before any real connection)

- Whether the tailnet-only HTTPS address is accepted as a redirect URI and works for bank logins.
- What the bank login does inside the iOS home-screen app. It may open Safari, which keeps
  separate storage; the fallback is connecting from Safari.
- How much history Chase and Wells Fargo actually return.
