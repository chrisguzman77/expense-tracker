# Editing, and the Plaid coverage check (piece 3a)

Date: 2026-10-14
Status: approved design

## Context

[Record 21](../../decisions/0021-accounts-signed-transactions-and-category-kinds.md) split piece 2
into 2a (accounts, signed transactions, category kinds; live since 2026-10-14) and 2b (CSV
import, transaction editing, bank descriptions, duplicate detection).

Before starting 2b, CSV import was dropped as a planned piece. With Plaid connected, it would
be used once or twice. [Record 19](../../decisions/0019-subscriptions-before-budgets-plaid-trial.md)
already kept it only as the fallback if Plaid's free Trial falls through. Editing, bank
descriptions and duplicate detection are needed whatever the data source, so they move into
piece 3 (bank sync), now split in three, each with its own spec, plan and PRs:

- **3a (this spec):** the coverage check record 19 asks for, plus editing transactions,
  categories and accounts.
- **3b:** connecting Plaid. Link, token exchange, encrypted token storage, and Plaid accounts
  becoming the app's accounts. Its first step tests the open questions below in the sandbox.
- **3c:** syncing transactions. Scheduled `/transactions/sync`, bank descriptions, pending to
  posted, duplicates against hand-entered rows, suggested categories, locked bank-owned fields.

## Decisions

- **Editing covers everything the user created.** For transactions that is the category,
  note, amount (including money in or out), date and account. For categories it is the name,
  kind, color and emoji. For accounts it is the name and type. Today every transaction is
  entered by hand, so the user owns every field. 3c locks the bank-owned fields (amount, date,
  account) on synced rows. Rejected:
  - category and note only (a typo in an amount would mean delete and re-enter);
  - leaving the account fixed (same problem);
  - kind-only category editing (a misspelled name would still be stuck);
  - no account editing (Plaid's names, such as "TOTAL CHECKING ...1234", will need renaming).
- **PUT with the whole record, not PATCH.** The edit forms hold every field anyway. The type
  generator marks any field with a default as required (see lessons-learned), so "optional"
  PATCH fields would come out required in TypeScript. Making them optional means changing a
  generator flag, which would change existing types too. 3c rejects a changed bank-owned value
  with a 422 and accepts an unchanged one.
- **Separate edit screens that reuse the create forms**, not editing in place. Same validation
  and layout as create. Editing in place would turn each detail screen into a second form, and
  categories would first need a detail screen.
- **The coverage check is done by hand, with no app code.** A committed script would force the
  Plaid client choice (SDK or plain HTTP) and Plaid settings ahead of 3b's design.

## Coverage check

### Research so far (2026-10-14, from Plaid's docs)

Sources and quotes go into the research note (see Docs).

- **Trial:** free for new US and Canadian teams created on or after 2026-04-15.
  - 10 production Items (one per bank login); removing an Item doesn't free its slot.
  - Transactions (with Refresh) and Balance are included; Recurring Transactions only per a
    search summary.
  - No time limit is stated.
  - A pending or approved application for production access makes a team ineligible.
- **Bank logins (OAuth):** Trial plans get OAuth institutions, including Chase, Wells Fargo
  and Capital One, without the security questionnaire or company registration. Plaid says
  some institutions may need extra steps even on a Trial; which ones isn't listed.
  - Chase lets the user choose consent length: 6 months, 1 year or always.
  - Capital One consent must be renewed yearly. Capital One also refuses past-due cards,
    reports no pending transactions, and doesn't support Refresh on card-only Items.
- **Redirect URI:** must be HTTPS in production, have no query parameters, and be in the
  dashboard allowlist.
  - Whether it must be publicly reachable isn't documented. The bank redirects the user's own
    browser, so a tailnet-only `*.ts.net` address should work; this is untested.
  - The docs say nothing about iOS home-screen apps, where the bank login may open in Safari
    with separate storage.
- **History:** `days_requested` is 1 to 730, default 90, set when the connection is created,
  and can't be changed later. More history means reconnecting, which on the Trial uses another
  of the 10. Request 730.
  - Capital One provides only 90 days. The Discover move to Capital One logins may lose older
    history.
  - Chase (about 24 months) and Wells Fargo checking (about 18 months) come from one
    third-party source only.
- **Sync:** `/transactions/sync` is a cursor API that works without webhooks. The limit is 50
  calls a minute per Item. A tailnet-only app can't receive webhooks, so it polls.

### Steps (Chris)

1. **Create a free Plaid account** and start the Trial from the dashboard.
   - Check that the Trial plan with Transactions is shown and nothing about production access
     is pending.
   - Never use a "request production access" button.
   - Note any approval wait, and whether the sign-up asks for a company.
2. **Search the sandbox** from your own terminal.
   - Load the sandbox keys without echoing them, so they stay in that shell and never reach
     the repo, `.env` or the chat:
     ```
     read -s PLAID_CLIENT_ID; read -s PLAID_SECRET; export PLAID_CLIENT_ID PLAID_SECRET
     ```
   - Then search for the four banks:
     ```
     for q in "Wells Fargo" "Chase" "Capital One" "Discover"; do
       curl -s https://sandbox.plaid.com/institutions/search -H 'Content-Type: application/json' \
         -d "{\"client_id\":\"$PLAID_CLIENT_ID\",\"secret\":\"$PLAID_SECRET\",\"query\":\"$q\",\"products\":[\"transactions\"],\"country_codes\":[\"US\"]}" \
         | jq 'if .institutions then [.institutions[] | {institution_id, name, oauth, products}] else {error_code, error_message} end'
     done
     ```
   - Paste the output. It holds only names, IDs, product lists and the OAuth flag.
3. **Check the dashboard's OAuth institutions page** for Chase, Wells Fargo and Capital One,
   and note anything marked as needing extra steps.
4. **Check Capital One's website**: how far back the transaction download goes, and whether
   the Discover card has moved to a Capital One login yet.

### Outcomes

- **All four supported:** 3b proceeds on Plaid.
- **Capital One's download goes back much further than 90 days:** a small, one-off CSV
  backfill for that account may come back as its own decision. It isn't planned yet.
- **A bank isn't supported, or the Trial isn't available to an individual:** stop and decide
  together before 3b (SimpleFIN, CSV import, or something else). Record 22 records the choice.

## API

Same layering as today: thin routers, services raising domain exceptions, every query scoped
to the current user, "not yours" returning 404.

Each endpoint takes the same body as the matching create, reusing the existing `*Create`
schema rather than a copy, and returns 200 with the usual read shape.

- **`PUT /api/transactions/{id}`** takes `TransactionCreate`: `{account_id, category_id,
  amount, occurred_on, note}`.
  - Same rules as create: amount signed, nonzero, max 12 digits and 2 decimals; date no more
    than one day in the future.
  - Transaction missing or not yours: 404 "Transaction not found".
  - Account or category missing or not yours: 404 "Account not found" or "Category not found",
    as on create.
- **`PUT /api/categories/{id}`** takes `CategoryCreate`: `{name, color, icon, kind}`.
  - Missing or not yours: 404 "Category not found".
  - Another of your categories has the name: 409 "Category name taken".
  - Saving under its own unchanged name succeeds.
- **`PUT /api/accounts/{id}`** takes `AccountCreate`: `{name, type}`.
  - Missing or not yours: 404 "Account not found".
  - Name clash: 409 "Account name taken". The same name succeeds.

**Services:** `update_transaction`, `update_category` and `update_account`.
- Each loads the row through the existing ownership helper, checks any referenced account or
  category the same way create does, assigns the fields and commits.
- A name clash is caught as `IntegrityError` on commit, rolled back and raised as `NameTaken`,
  the same race-safe pattern as create.

**Not in scope:**
- no migration (no columns change);
- no single-item GET (edit screens use the lists they already load, as detail screens do);
- no edit history.

## Frontend

### Shared forms

The create screens' forms become components used by create and edit:

- **`TransactionForm`**, pulled out of `NewTransactionPage`. It takes starting values and a
  submit function.
  - On edit, the money in/out toggle is set from the stored sign, and the amount field shows
    the value without its sign.
  - The "+ New category" shortcut (the draft round trip through the category screen) stays on
    create only. Supporting it on edit would mean threading the transaction id through both
    screens.
- **`CategoryForm`** already exists. It gains starting values and save behaviour.
  - On edit it shows, under the kind picker: "Changing the kind also changes past months in
    the summary."
- **`AccountForm`**, pulled out of `NewAccountPage`.

### Edit screens

| Screen | Opened from | After saving |
|---|---|---|
| `/transactions/:id/edit` "Edit transaction" | Edit button on the transaction detail screen | back to the detail screen |
| `/accounts/:id/edit` "Edit account" | Edit button on the account detail screen | back to the account screen |
| `/categories/:id/edit` "Edit category" | tapping a category row (the row's delete button stays) | back to Categories |

- Each edit screen finds its record in the list it already loads, and shows a "not found"
  message for an unknown id, as the detail screens do.
- The submit button says "Save". A 409 or 422 shows the same way it does on create.

### Cache refresh after a save

- **Transaction:** transactions and the summary.
- **Category:** categories, transactions (rows show the category's name, color and emoji) and
  the summary.
- **Account:** accounts and transactions (rows show the account name).

## Tests (first)

### Backend

- **Transactions:**
  - an edit changes every field, including flipping money out to money in;
  - zero amount gives 422;
  - someone else's transaction gives 404;
  - moving it to someone else's account or category gives 404 with the right message;
  - flipping a sign changes that month's summary.
- **Categories:**
  - rename, recolor and change the emoji;
  - saving under the same name succeeds;
  - another category's name gives 409;
  - someone else's category gives 404;
  - changing the kind from spending to transfer removes the category from the summary,
    including for past months.
- **Accounts:**
  - rename and change the type;
  - the same name succeeds;
  - a duplicate gives 409;
  - someone else's account gives 404.

### Frontend

- **Edit transaction:**
  - the form starts prefilled, with the toggle on money in for a positive amount;
  - saving sends a PUT with the signed amount and returns to the detail screen;
  - there is no "+ New category" button;
  - an unknown id shows the not-found message;
  - the detail screen's Edit button opens it.
- **Edit category:**
  - prefilled;
  - the kind note is shown;
  - a 409 shows the name-taken message;
  - tapping a row on Categories opens it.
- **Edit account:**
  - prefilled;
  - a 409 shows the name-taken message;
  - the account screen's Edit button opens it.
- **Unchanged create tests:** the existing create-screen tests pass unchanged after the forms
  are pulled out. That is the check that the refactor didn't change behaviour.
- **Screenshots:** the three edit screens at 390px, light and dark, with the CDP script.

## Docs

- **`docs/research/plaid-coverage.md`:**
  - the research above, with links and quotes;
  - Chris's check results;
  - the open questions for 3b: the tailnet redirect URI, the bank login on the home-screen
    app, and the history depth per bank.
- **Record 22, "Plaid for bank sync; piece 2b folded into piece 3":**
  - CSV import dropped as a planned piece, kept only as a possible Capital One backfill;
  - piece 3 split into 3a, 3b and 3c;
  - request 730 days of history;
  - sync on a schedule, because webhooks can't reach a tailnet-only app;
  - what the check found.
  Token storage and the Plaid client library get their own record in 3b.
- **Status lines and roadmap:**
  - record 21's status gets "amended by 22";
  - record 19's gets "refined by 22";
  - the decisions README gets the new row;
  - README's roadmap line drops CSV import.
- **Devlog and lessons:** a devlog entry, and lessons-learned entries for surprises.

## Delivery

Pull requests into `dev`:

1. **`feat/edit-transactions`:** this spec, the plan, the transaction PUT, `TransactionForm`
   and the edit screen.
2. **`feat/edit-categories-and-accounts`:** both PUTs, both forms, both edit screens, and the
   devlog entry.
3. **`docs/plaid-coverage`:** the research note, record 22 and the status lines, written once
   the check results are in. It touches no code, so it can merge in any order.

Then `dev` lands into `main`. There's no migration, so the rollout is `docker compose pull &&
docker compose up -d` on the VM, then reopening the home-screen app.
