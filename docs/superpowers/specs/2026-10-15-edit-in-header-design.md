# Edit in the header, Delete in the edit screen

Date: 2026-10-15
Status: approved design

## Context

Piece 3a added editing ([spec](2026-10-14-editing-and-plaid-coverage-design.md)). Its final
review noticed that the account screen's Edit and Delete buttons sit below the account's whole
transaction list. With a few hand-entered rows that is fine. Once piece 3b connects bank accounts
with up to two years of history, they would be hundreds of rows down.

Deleting is also inconsistent across the app:
- **Transaction detail:** Edit and Delete buttons below the details.
- **Account screen:** the same buttons, below the list.
- **Categories tab:** a trash icon on each row that deletes in one tap, with no confirmation.

## Decisions

- **Edit goes in the screen header; Delete moves to the bottom of the edit screen.** This is
  the usual iPhone pattern, and it keeps both reachable whatever the list length. Rejected:
  buttons directly under the account card, which still scroll away with the list.
- **The same pattern for transactions, accounts and categories.** One way to delete things,
  and categories lose their unconfirmed one-tap delete. Rejected: accounts only, or accounts and
  transactions only, which leave two or three different patterns.
- **A chevron (›) on category and account rows**, which are plain navigation lists. Transaction
  rows keep their amount on the right, with no chevron. Rejected: chevrons on every row (they
  crowd amounts on a phone), and no cue at all.

## Design

### Header action

- `Screen`, the shell of every pushed screen, gets an optional `action?: { to: string; label: string }`.
- When it is set, a link renders in the header's right-hand slot, which is empty today and
  mirrors Back.
- The link has the same style as Back: accent color, `min-h-11`, right-aligned.
- Without `action`, the slot stays empty as before.

### Detail screens

- **Transaction detail** (`/transactions/:id`) passes `action={{ to: "/transactions/<id>/edit", label: "Edit" }}`.
  - Its "Edit transaction" and "Delete transaction" buttons, the confirmation and the delete
    error are removed.
- **Account screen** (`/accounts/:id`) passes `action={{ to: "/accounts/<id>/edit", label: "Edit" }}`.
  - Its "Edit account" and "Delete account" buttons, the confirmation and the delete error are
    removed.
  - The screen is the name card and the transaction list.
- **No action on not-found or loading.** The action only appears once the record is found; a
  not-found or loading screen has no Edit link.

### Delete in edit screens

A shared component `ConfirmDelete` (in `frontend/src/components/`) replaces the inline
confirmation that today exists in two places and would otherwise be copied a third time.

**Props:**
- `label`: the button text, e.g. "Delete account".
- `question`: e.g. "Delete this account? This can't be undone."
- `onConfirm: () => void`: the page's delete handler.
- `pending: boolean`: disables the confirm button while deleting.
- `error?: string`: shown above the button in an alert.
- `onCancel?: () => void`: called when Cancel is pressed, so the page can clear its mutation
  error.

**Behaviour:**
- It first shows a red full-width button labelled `label`.
- Pressing it shows a card with `question`, Cancel and Delete.
- Cancel returns to the button.
- Delete calls `onConfirm`.

**Placement:** each edit screen renders `ConfirmDelete` below its form (below the form's card,
where there is one), only once the record is found.

| Edit screen | Button label | Question | After deleting | Blocked (409) message |
|---|---|---|---|---|
| Edit transaction | Delete transaction | Delete this transaction? This can't be undone. | `/` | — (no 409 case; other errors show the server message) |
| Edit account | Delete account | Delete this account? This can't be undone. | `/accounts` | This account still has transactions; move or delete them first. |
| Edit category | Delete category | Delete this category? This can't be undone. | `/categories` | This category still has transactions; move or delete them first. |

- **Other errors** show the server's message, as today.
- **"Move or delete them first"**: editing can now move a transaction to another account or
  category, so "move" is a real option. The account message replaces "This account still has
  transactions; delete them first."; categories previously showed the raw "Category has
  transactions".
- **Navigation after delete** uses `replace: true`, as today.
- **Delete never appears on create screens.**
- **No "not found" flash after deleting.** A successful delete reloads the list before the
  screen navigates away, so for a moment the record is missing. This flash was noted in 2a. The
  edit screen shows nothing in that moment instead of "… not found".

### Lists

**Categories tab:**
- Each row is one full-width link: chip, name, the kind badge (Income or Transfer), and a
  chevron on the right.
- The link keeps the accessible name `Edit <name>`.
- The trash button is removed, along with `useDeleteCategory` on that page and its error alert.
- `TrashIcon` has no other users, so it is removed from `components/icons.tsx`.
- The inline "New category" form at the top is unchanged.

**Accounts tab:** each row gets the same chevron after the name and type.

**Chevron style:** the existing `ChevronRightIcon`, `size-5`, `text-muted`, `shrink-0`, with
`aria-hidden="true"`.

**Unchanged:** transaction rows (Transactions tab and account screen).

## Tests (first)

- **`Screen`:**
  - renders the action link with its label and target when `action` is given;
  - renders no link besides Back otherwise.
- **`ConfirmDelete`:**
  - shows only the button at first;
  - pressing it shows the question;
  - Cancel hides the question and calls `onCancel`;
  - Delete calls `onConfirm`;
  - `error` is shown in an alert;
  - the confirm button is disabled while `pending`.
- **Transaction detail and account screen:**
  - the header's Edit link points at the edit route;
  - there is no Delete button;
  - the not-found screen has no Edit link.
- **Edit transaction:**
  - Delete asks first;
  - Cancel keeps the transaction;
  - confirming sends DELETE, refreshes the summary and returns to `/`.
- **Edit account:**
  - Delete asks first;
  - confirming sends DELETE and returns to `/accounts`;
  - a 409 shows "This account still has transactions; move or delete them first.";
  - Cancel clears the message.
- **Edit category:**
  - Delete asks first;
  - confirming sends DELETE and returns to `/categories`;
  - a 409 shows "This category still has transactions; move or delete them first.";
  - Cancel clears the message.
- **Categories tab:**
  - no "Delete <name>" buttons;
  - tapping a row still opens its edit screen.
- **Accounts tab:** rows still link to `/accounts/<id>`.
- **Delete tests:** the delete tests on the transaction detail, account screen and Categories
  tab move to the edit screens above.
- **Create-screen tests:** stay unchanged.

## Delivery

One branch, `feat/edit-in-header`, one PR into `dev`. It contains this spec, the plan, the tasks,
screenshots of the changed screens at 390px in light and dark, and a devlog entry.

Frontend only: no API change and no migration. Rollout: `docker compose pull && docker compose
up -d`, then reopen the home-screen app.
