# Edit in the Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Edit into the screen header and Delete into the edit screens for transactions, accounts and categories, and add a chevron to category and account rows.

**Architecture:** Two small shared pieces come first:
- an optional `action` link in `Screen`'s header;
- a `ConfirmDelete` component holding the inline confirmation that today lives in two detail pages.

Then each record type moves its delete from the detail or list screen into its edit screen. Frontend only; no API change.

**Tech Stack:** React 19 + TypeScript ~5.9, TanStack Query 5, React Router 7, Tailwind v4, Vitest + React Testing Library + MSW 2.

Spec: `docs/superpowers/specs/2026-10-15-edit-in-header-design.md`.

## Global Constraints

- **UI copy, exact:**
  - header link label: `Edit`;
  - delete buttons: `Delete transaction`, `Delete account`, `Delete category`;
  - confirm buttons: `Cancel` and `Delete`;
  - questions: `Delete this transaction? This can't be undone.`,
    `Delete this account? This can't be undone.`,
    `Delete this category? This can't be undone.`;
  - 409 messages: `This account still has transactions; move or delete them first.`,
    `This category still has transactions; move or delete them first.`;
  - category row link label: `Edit <name>`.
- **After deleting** (all with `replace: true`):
  - transaction → `/`;
  - account → `/accounts`;
  - category → `/categories`.
- **The header Edit link appears only once the record is found.** Loading and not-found screens
  have none.
- **Delete appears only on edit screens**, never on create screens.
- **No "not found" flash after a successful delete:** while the delete is pending or has
  succeeded, an edit screen whose record has vanished renders nothing instead of `… not found`.
- **Chevron:** `ChevronRightIcon` with `className="size-5 shrink-0 text-muted"`, on category and
  account rows only. The icon is already `aria-hidden`.
- **Create-screen tests must pass unchanged**:
  - `NewTransactionPage.test.tsx`
  - `NewCategoryPage.test.tsx`
  - `NewCategoryFlow.test.tsx`
  - `NewAccountPage.test.tsx`
  - the create tests in `CategoriesPage.test.tsx`
- **Component files export only components and types** (ESLint `react-refresh/only-export-components`). No `eslint-disable`.
- **Frontend conventions:** use the existing components (Screen, Card, Button) and keep touch
  targets at least `min-h-11`.
- **Never read or edit** any `.env` or `.env.example` file. Never hand-edit
  `frontend/src/api/schema.d.ts` (this plan doesn't touch it).
- **Git:** never `git add -A` or `git add .`; an untracked `.agentmaster/` directory at the repo
  root is not ours. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Commands** (from `frontend/`):
- `npx vitest run --maxWorkers=2 <files>`, `npx vitest run --maxWorkers=2` (full suite);
- `npx tsc -b`;
- `npx eslint .`

The machine is heavily loaded; keep `--maxWorkers=2`. If an unrelated test hits the 5s timeout,
re-run that file alone and report it rather than changing it.

---

### Task 1: Header action and `ConfirmDelete`

**Files:**
- Modify: `frontend/src/components/Screen.tsx`
- Test: `frontend/src/components/Screen.test.tsx` (add two tests)
- Create: `frontend/src/components/ConfirmDelete.tsx`
- Test: `frontend/src/components/ConfirmDelete.test.tsx` (create)

**Interfaces:**
- Produces:
  - `Screen` props gain `action?: { to: string; label: string }`;
  - `ConfirmDelete(props: { label: string; question: string; onConfirm: () => void; pending: boolean; error?: string; onCancel?: () => void })`.

- [ ] **Step 1: Write the failing tests**

Add inside the `describe("Screen", …)` block of `frontend/src/components/Screen.test.tsx`:

```tsx
  it("shows a header action link when given one", () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <Screen title="Account" backTo="/accounts" action={{ to: "/accounts/1/edit", label: "Edit" }}>
            <p>body</p>
          </Screen>
        ),
      },
    ]);
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/accounts/1/edit");
  });

  it("has no link besides Back without an action", () => {
    const router = createMemoryRouter([
      {
        path: "/",
        element: (
          <Screen title="Account" backTo="/accounts">
            <p>body</p>
          </Screen>
        ),
      },
    ]);
    render(<RouterProvider router={router} />);

    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
```

Create `frontend/src/components/ConfirmDelete.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDelete } from "./ConfirmDelete";

function renderIt({ pending = false, error }: { pending?: boolean; error?: string } = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmDelete
      label="Delete thing"
      question="Delete this thing? This can't be undone."
      onConfirm={onConfirm}
      onCancel={onCancel}
      pending={pending}
      error={error}
    />,
  );
  return { onConfirm, onCancel };
}

describe("ConfirmDelete", () => {
  it("shows only the button until it is pressed", () => {
    renderIt();

    expect(screen.getByRole("button", { name: "Delete thing" })).toBeInTheDocument();
    expect(screen.queryByText("Delete this thing? This can't be undone.")).not.toBeInTheDocument();
  });

  it("asks first, then Delete calls onConfirm", async () => {
    const { onConfirm } = renderIt();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete thing" }));
    expect(screen.getByText("Delete this thing? This can't be undone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Cancel hides the question and calls onCancel", async () => {
    const { onConfirm, onCancel } = renderIt();
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "Delete thing" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete thing" })).toBeInTheDocument();
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("shows the error", () => {
    renderIt({ error: "Nope" });

    expect(screen.getByRole("alert")).toHaveTextContent("Nope");
  });

  it("disables Delete while pending", async () => {
    renderIt({ pending: true });

    await userEvent.setup().click(screen.getByRole("button", { name: "Delete thing" }));

    expect(screen.getByRole("button", { name: "Delete" })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --maxWorkers=2 src/components/Screen.test.tsx src/components/ConfirmDelete.test.tsx`
Expected: FAIL. `ConfirmDelete` can't be resolved, and the Screen action test finds no "Edit" link.

- [ ] **Step 3: Add the header action to `Screen`**

In `frontend/src/components/Screen.tsx`:

1. Change the props type to:

```tsx
type Props = {
  title: string;
  backTo: string;
  backState?: unknown;
  // A link in the header's right-hand slot, e.g. Edit on a detail screen.
  action?: { to: string; label: string };
  children: ReactNode;
};
```

2. Destructure it: `export function Screen({ title, backTo, backState, action, children }: Props) {`
3. Directly after `<h1 className="truncate text-center font-semibold">{title}</h1>`, add:

```tsx
            {action && (
              <Link to={action.to} className="inline-flex min-h-11 items-center justify-end px-1 font-medium text-accent">
                {action.label}
              </Link>
            )}
```

- [ ] **Step 4: Create `frontend/src/components/ConfirmDelete.tsx`**

```tsx
import { useState } from "react";
import { Button } from "./Button";
import { Card } from "./Card";

type Props = {
  label: string;
  question: string;
  onConfirm: () => void;
  pending: boolean;
  error?: string;
  // Lets the page clear its delete error when the user backs out.
  onCancel?: () => void;
};

// A destructive action behind an inline confirmation: a red button first, then the question
// with Cancel and Delete.
export function ConfirmDelete({ label, question, onConfirm, pending, error, onCancel }: Props) {
  const [confirming, setConfirming] = useState(false);

  function cancel() {
    setConfirming(false);
    onCancel?.();
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {confirming ? (
        <Card className="flex flex-col gap-3 p-4">
          <p className="font-medium">{question}</p>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="secondary" onClick={cancel}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onConfirm} disabled={pending}>
              Delete
            </Button>
          </div>
        </Card>
      ) : (
        <Button variant="danger" onClick={() => setConfirming(true)} className="w-full">
          {label}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Run the checks**

Run: `npx vitest run --maxWorkers=2 src/components/Screen.test.tsx src/components/ConfirmDelete.test.tsx` → all pass.
Run: `npx tsc -b && npx eslint .` → clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Screen.tsx frontend/src/components/Screen.test.tsx frontend/src/components/ConfirmDelete.tsx frontend/src/components/ConfirmDelete.test.tsx
git commit -m "feat: header action on screens and a shared delete confirmation

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Transactions

**Files:**
- Modify: `frontend/src/pages/TransactionDetailPage.tsx` (replace the whole file)
- Modify: `frontend/src/pages/EditTransactionPage.tsx`
- Test: `frontend/src/pages/TransactionDetailPage.test.tsx`
- Test: `frontend/src/pages/EditTransactionPage.test.tsx`

**Interfaces:**
- Consumes: `Screen`'s `action` prop and `ConfirmDelete` (Task 1); `useDeleteTransaction()` from `frontend/src/api/transactions.ts` (existing; invalidates transactions and the summary).

- [ ] **Step 1: Write the failing tests**

In `frontend/src/pages/TransactionDetailPage.test.tsx`:

1. Replace `fakeApi` (the detail screen no longer deletes):

```tsx
function fakeApi() {
  const rows = [{ id: 10, amount: "-12.50", occurred_on: "2026-10-10", note: "Lunch", category: food, account: { id: 1, name: "Wallet", type: "cash" } }];
  server.use(http.get("/api/transactions", () => HttpResponse.json(rows)));
}
```

2. Delete the tests "asks for confirmation; cancelling keeps the transaction" and "deletes after confirmation, refreshes the summary and returns to the list". They move to the edit screen below.
3. Replace the test "opens the edit screen" with:

```tsx
  it("opens the edit screen from the header", async () => {
    fakeApi();
    renderPage("/transactions/10");

    await userEvent.setup().click(await screen.findByRole("link", { name: "Edit" }));

    expect(await screen.findByText("edit screen")).toBeInTheDocument();
  });

  it("has no Delete button", async () => {
    fakeApi();
    renderPage("/transactions/10");

    await screen.findByText("$12.50");
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });
```

4. In the test "says when the transaction doesn't exist", add after its assertion:

```tsx
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
```

In `frontend/src/pages/EditTransactionPage.test.tsx`:

1. In `fakeApi`, make the transaction list mutable and add a DELETE handler. Replace its first lines and the GET transactions handler, keep the other handlers as they are, and return `deleted` too:

```tsx
function fakeApi({ failWith }: { failWith?: string } = {}) {
  const rows = [lunch, refund];
  const put: unknown[] = [];
  const deleted: number[] = [];
  server.use(
    http.get("/api/transactions", () => HttpResponse.json(rows)),
    http.delete("/api/transactions/:id", ({ params }) => {
      deleted.push(Number(params.id));
      rows.splice(rows.findIndex((r) => r.id === Number(params.id)), 1);
      return new HttpResponse(null, { status: 204 });
    }),
    // ...the existing /api/accounts, /api/categories and PUT handlers, unchanged...
  );
  return { put, deleted };
}
```

2. Add `{ path: "/", element: <p>transactions list</p> },` to `renderPage`'s routes.
3. Add inside the `describe` block:

```tsx
  it("asks before deleting; Cancel keeps the transaction", async () => {
    const { deleted } = fakeApi();
    renderPage("/transactions/10/edit");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete transaction" }));
    expect(screen.getByText("Delete this transaction? This can't be undone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete transaction" })).toBeInTheDocument();
    expect(deleted).toEqual([]);
  });

  it("deletes after confirmation, refreshes the summary and returns to the list", async () => {
    const { deleted } = fakeApi();
    const { queryClient } = renderPage("/transactions/10/edit");
    queryClient.setQueryData(["summary", 2026, 10], []);
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete transaction" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("transactions list")).toBeInTheDocument();
    expect(deleted).toEqual([10]);
    expect(queryClient.getQueryState(["summary", 2026, 10])?.isInvalidated).toBe(true);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --maxWorkers=2 src/pages/TransactionDetailPage.test.tsx src/pages/EditTransactionPage.test.tsx`
Expected: FAIL. There is no "Edit" link (the detail page still has buttons), and there is no "Delete transaction" button on the edit screen.

- [ ] **Step 3: Rewrite `frontend/src/pages/TransactionDetailPage.tsx`**

```tsx
import { useParams } from "react-router-dom";
import { useTransactions } from "../api/transactions";
import { Card } from "../components/Card";
import { CategoryChip } from "../components/CategoryChip";
import { Screen } from "../components/Screen";
import { TransactionAmount } from "../components/TransactionAmount";
import { longDate } from "../lib/dates";

// Reads from the already-loaded transaction list; the API has no single-transaction GET.
export function TransactionDetailPage() {
  const { id } = useParams();
  const transactions = useTransactions();
  const transaction = transactions.data?.find((t) => t.id === Number(id));

  return (
    <Screen
      title="Transaction"
      backTo="/"
      action={transaction ? { to: `/transactions/${transaction.id}/edit`, label: "Edit" } : undefined}
    >
      {transactions.isPending && <p className="text-muted">Loading…</p>}
      {transactions.isError && (
        <p role="alert" className="text-sm text-danger">
          {transactions.error.message}
        </p>
      )}
      {transactions.data && !transaction && <Card className="p-6 text-center text-muted">Transaction not found</Card>}
      {transaction && (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col items-center gap-2 p-6 text-center">
            <CategoryChip category={transaction.category} size="lg" />
            <p className="font-semibold">{transaction.category.name}</p>
            <TransactionAmount amount={transaction.amount} className="text-4xl font-extrabold" />
          </Card>
          <Card className="p-4">
            <dl className="grid grid-cols-[5rem_1fr] gap-y-3 text-sm">
              <dt className="text-muted">Date</dt>
              <dd>{longDate(transaction.occurred_on)}</dd>
              <dt className="text-muted">Account</dt>
              <dd>{transaction.account.name}</dd>
              <dt className="text-muted">Note</dt>
              <dd className="break-words">{transaction.note || "—"}</dd>
            </dl>
          </Card>
        </div>
      )}
    </Screen>
  );
}
```

- [ ] **Step 4: Add Delete to `frontend/src/pages/EditTransactionPage.tsx`**

1. Imports: change the transactions import to
   `import { type Transaction, useDeleteTransaction, useTransactions } from "../api/transactions";`
   and add `import { ConfirmDelete } from "../components/ConfirmDelete";`.
2. After `const transaction = …`, add:

```tsx
  const remove = useDeleteTransaction();
  // A successful delete reloads the list before we navigate away; don't flash "not found".
  const deleting = remove.isPending || remove.isSuccess;

  async function onDelete(transactionId: number) {
    try {
      await remove.mutateAsync(transactionId);
      navigate("/", { replace: true });
    } catch {
      // Shown below via remove.error
    }
  }
```

3. Replace the not-found branch and the final `else` branch:

```tsx
  } else if (!transaction) {
    content = deleting ? null : <Card className="p-6 text-center text-muted">Transaction not found</Card>;
  } else {
    content = (
      <div className="flex flex-col gap-6">
        <TransactionForm
          accounts={accounts.data}
          categories={categories.data}
          defaultValues={toFormValues(transaction)}
          transactionId={transaction.id}
          onSaved={() => navigate(`/transactions/${transaction.id}`, { replace: true })}
        />
        <ConfirmDelete
          label="Delete transaction"
          question="Delete this transaction? This can't be undone."
          onConfirm={() => onDelete(transaction.id)}
          pending={remove.isPending}
          error={remove.error?.message}
          onCancel={() => remove.reset()}
        />
      </div>
    );
  }
```

- [ ] **Step 5: Run the checks**

Run: `npx vitest run --maxWorkers=2 src/pages/TransactionDetailPage.test.tsx src/pages/EditTransactionPage.test.tsx src/pages/NewTransactionPage.test.tsx` → all pass.
Run: `npx tsc -b && npx eslint .` → clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/TransactionDetailPage.tsx frontend/src/pages/TransactionDetailPage.test.tsx frontend/src/pages/EditTransactionPage.tsx frontend/src/pages/EditTransactionPage.test.tsx
git commit -m "feat: transactions edit from the header and delete from the edit screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: Accounts

**Files:**
- Modify: `frontend/src/pages/AccountDetailPage.tsx` (replace the whole file)
- Modify: `frontend/src/pages/EditAccountPage.tsx` (replace the whole file)
- Modify: `frontend/src/pages/AccountsPage.tsx` (chevron)
- Test: `frontend/src/pages/AccountDetailPage.test.tsx`
- Test: `frontend/src/pages/EditAccountPage.test.tsx`

**Interfaces:**
- Consumes: `Screen`'s `action` and `ConfirmDelete` (Task 1); `useDeleteAccount()` (existing; invalidates accounts); `ApiError` from `frontend/src/api/client.ts` (has `status`).

- [ ] **Step 1: Write the failing tests**

In `frontend/src/pages/AccountDetailPage.test.tsx`:

1. Remove deleting from `fakeApi`:
   - it becomes `function fakeApi({ transactions = [] as object[] } = {})`;
   - drop `deleted` and the `http.delete` handler;
   - return `{ requested }`.
2. Delete these tests (they move to the edit screen):
   - "asks for confirmation; cancelling keeps the account";
   - "deletes after confirmation and returns to the Accounts tab";
   - "explains why an account with transactions can't be deleted, and Cancel clears it".
3. Replace the test "opens the edit screen" with:

```tsx
  it("opens the edit screen from the header", async () => {
    fakeApi();
    renderPage("/accounts/1");

    await userEvent.setup().click(await screen.findByRole("link", { name: "Edit" }));

    expect(await screen.findByText("edit screen")).toBeInTheDocument();
  });

  it("has no Delete button", async () => {
    fakeApi();
    renderPage("/accounts/1");

    await screen.findByText("Wells Fargo");
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
  });
```

4. In "says when the account doesn't exist", add:

```tsx
    expect(screen.queryByRole("link", { name: "Edit" })).not.toBeInTheDocument();
```

In `frontend/src/pages/EditAccountPage.test.tsx`:

1. Change `fakeApi` to `function fakeApi({ inUse = false } = {})`, add `const deleted: number[] = [];`, add this handler to `server.use(...)`, and return `{ put, deleted }`:

```tsx
    http.delete("/api/accounts/:id", ({ params }) => {
      deleted.push(Number(params.id));
      if (inUse) return HttpResponse.json({ detail: "Account has transactions" }, { status: 409 });
      return new HttpResponse(null, { status: 204 });
    }),
```

2. Add `{ path: "/accounts", element: <p>accounts tab</p> },` to `renderPage`'s routes.
3. Add inside the `describe` block:

```tsx
  it("asks before deleting; Cancel keeps the account", async () => {
    const { deleted } = fakeApi();
    renderPage("/accounts/1/edit");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete account" }));
    expect(screen.getByText("Delete this account? This can't be undone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete account" })).toBeInTheDocument();
    expect(deleted).toEqual([]);
  });

  it("deletes after confirmation and returns to the Accounts tab", async () => {
    const { deleted } = fakeApi();
    renderPage("/accounts/1/edit");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete account" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("accounts tab")).toBeInTheDocument();
    expect(deleted).toEqual([1]);
  });

  it("explains why an account with transactions can't be deleted, and Cancel clears it", async () => {
    fakeApi({ inUse: true });
    renderPage("/accounts/1/edit");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete account" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This account still has transactions; move or delete them first.",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --maxWorkers=2 src/pages/AccountDetailPage.test.tsx src/pages/EditAccountPage.test.tsx`
Expected: FAIL. There is no "Edit" link and no "Delete account" button on the edit screen.

- [ ] **Step 3: Rewrite `frontend/src/pages/AccountDetailPage.tsx`**

```tsx
import { useParams } from "react-router-dom";
import { useAccounts } from "../api/accounts";
import { useTransactions } from "../api/transactions";
import { AccountIcon } from "../components/AccountIcon";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { accountTypeLabel } from "../lib/accountTypes";
import { TransactionList } from "./TransactionList";

// Reads from the already-loaded account list; the API has no single-account GET.
export function AccountDetailPage() {
  const { id } = useParams();
  const accounts = useAccounts();
  const transactions = useTransactions(Number(id));
  const account = accounts.data?.find((a) => a.id === Number(id));

  return (
    <Screen
      title="Account"
      backTo="/accounts"
      action={account ? { to: `/accounts/${account.id}/edit`, label: "Edit" } : undefined}
    >
      {accounts.isPending && <p className="text-muted">Loading…</p>}
      {accounts.isError && (
        <p role="alert" className="text-sm text-danger">
          {accounts.error.message}
        </p>
      )}
      {accounts.data && !account && <Card className="p-6 text-center text-muted">Account not found</Card>}
      {account && (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col items-center gap-2 p-6 text-center">
            <AccountIcon type={account.type} size="lg" />
            <p className="text-xl font-bold">{account.name}</p>
            <p className="text-sm text-muted">{accountTypeLabel(account.type)}</p>
          </Card>
          <section aria-label="Transactions" className="flex flex-col gap-2">
            <h2 className="px-1 font-bold">Transactions</h2>
            {transactions.isPending && <p className="text-muted">Loading…</p>}
            {transactions.isError && (
              <p role="alert" className="text-sm text-danger">
                {transactions.error.message}
              </p>
            )}
            {transactions.data && (
              <TransactionList transactions={transactions.data} emptyMessage="No transactions in this account yet." />
            )}
          </section>
        </div>
      )}
    </Screen>
  );
}
```

- [ ] **Step 4: Rewrite `frontend/src/pages/EditAccountPage.tsx`**

```tsx
import { useNavigate, useParams } from "react-router-dom";
import { useAccounts, useDeleteAccount } from "../api/accounts";
import { ApiError } from "../api/client";
import { Card } from "../components/Card";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { Screen } from "../components/Screen";
import { AccountForm } from "./AccountForm";

// Reads from the already-loaded account list; the API has no single-account GET.
export function EditAccountPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const accounts = useAccounts();
  const remove = useDeleteAccount();
  const account = accounts.data?.find((a) => a.id === Number(id));
  // A successful delete reloads the list before we navigate away; don't flash "not found".
  const deleting = remove.isPending || remove.isSuccess;

  const removeError =
    remove.error instanceof ApiError && remove.error.status === 409
      ? "This account still has transactions; move or delete them first."
      : remove.error?.message;

  async function onDelete(accountId: number) {
    try {
      await remove.mutateAsync(accountId);
      navigate("/accounts", { replace: true });
    } catch {
      // Shown below via removeError
    }
  }

  return (
    <Screen title="Edit account" backTo={account ? `/accounts/${account.id}` : "/accounts"}>
      {accounts.isPending && <p className="text-muted">Loading…</p>}
      {accounts.isError && (
        <p role="alert" className="text-sm text-danger">
          {accounts.error.message}
        </p>
      )}
      {accounts.data && !account && !deleting && <Card className="p-6 text-center text-muted">Account not found</Card>}
      {account && (
        <div className="flex flex-col gap-6">
          <Card className="p-4">
            <AccountForm account={account} onSaved={() => navigate(`/accounts/${account.id}`, { replace: true })} />
          </Card>
          <ConfirmDelete
            label="Delete account"
            question="Delete this account? This can't be undone."
            onConfirm={() => onDelete(account.id)}
            pending={remove.isPending}
            error={removeError}
            onCancel={() => remove.reset()}
          />
        </div>
      )}
    </Screen>
  );
}
```

- [ ] **Step 5: Add the chevron to account rows**

In `frontend/src/pages/AccountsPage.tsx`:
- change `import { PlusIcon } from "../components/icons";` to
  `import { ChevronRightIcon, PlusIcon } from "../components/icons";`;
- inside each row's `<Link>`, after the `<span className="min-w-0 flex-1">…</span>` that holds
  the name and type, add:

```tsx
                    <ChevronRightIcon className="size-5 shrink-0 text-muted" />
```

- [ ] **Step 6: Run the checks**

Run: `npx vitest run --maxWorkers=2 src/pages/AccountDetailPage.test.tsx src/pages/EditAccountPage.test.tsx src/pages/AccountsPage.test.tsx src/pages/NewAccountPage.test.tsx` → all pass, and `AccountsPage.test.tsx` and `NewAccountPage.test.tsx` are unedited.
Run: `npx tsc -b && npx eslint .` → clean.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/AccountDetailPage.tsx frontend/src/pages/AccountDetailPage.test.tsx frontend/src/pages/EditAccountPage.tsx frontend/src/pages/EditAccountPage.test.tsx frontend/src/pages/AccountsPage.tsx
git commit -m "feat: accounts edit from the header and delete from the edit screen

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: Categories

**Files:**
- Modify: `frontend/src/pages/EditCategoryPage.tsx` (replace the whole file)
- Modify: `frontend/src/pages/CategoriesPage.tsx`
- Modify: `frontend/src/components/icons.tsx` (remove `TrashIcon`)
- Test: `frontend/src/pages/EditCategoryPage.test.tsx`
- Test: `frontend/src/pages/CategoriesPage.test.tsx`

**Interfaces:**
- Consumes: `ConfirmDelete` (Task 1); `useDeleteCategory()` (existing; invalidates categories and the summary); `ApiError`.

- [ ] **Step 1: Write the failing tests**

In `frontend/src/pages/EditCategoryPage.test.tsx`:

1. Change `fakeApi` to `function fakeApi({ inUse = false } = {})`, add `const deleted: number[] = [];`, add this handler to `server.use(...)`, and return `{ put, deleted }`:

```tsx
    http.delete("/api/categories/:id", ({ params }) => {
      deleted.push(Number(params.id));
      if (inUse) return HttpResponse.json({ detail: "Category has transactions" }, { status: 409 });
      return new HttpResponse(null, { status: 204 });
    }),
```

2. Add inside the `describe` block (the `/categories` route, "categories tab", already exists):

```tsx
  it("asks before deleting; Cancel keeps the category", async () => {
    const { deleted } = fakeApi();
    renderPage("/categories/1/edit");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete category" }));
    expect(screen.getByText("Delete this category? This can't be undone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("button", { name: "Delete category" })).toBeInTheDocument();
    expect(deleted).toEqual([]);
  });

  it("deletes after confirmation and returns to Categories", async () => {
    const { deleted } = fakeApi();
    renderPage("/categories/1/edit");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete category" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("categories tab")).toBeInTheDocument();
    expect(deleted).toEqual([1]);
  });

  it("explains why a category with transactions can't be deleted, and Cancel clears it", async () => {
    fakeApi({ inUse: true });
    renderPage("/categories/1/edit");
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "Delete category" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This category still has transactions; move or delete them first.",
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
```

In `frontend/src/pages/CategoriesPage.test.tsx`:

1. Remove the `http.delete("/api/categories/:id", …)` handler from `fakeCategories`.
2. Delete the tests "deletes an empty category" and "shows the server message when deleting a category with transactions".
3. Add inside the `describe` block:

```tsx
  it("has no delete buttons on the rows", async () => {
    fakeCategories([food, rent]);
    renderPage();

    await screen.findByText("Food");
    expect(screen.queryByRole("button", { name: /^Delete/ })).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --maxWorkers=2 src/pages/EditCategoryPage.test.tsx src/pages/CategoriesPage.test.tsx`
Expected: FAIL. There is no "Delete category" button, and the rows still have "Delete Food"/"Delete Rent" buttons.

- [ ] **Step 3: Rewrite `frontend/src/pages/EditCategoryPage.tsx`**

```tsx
import { useNavigate, useParams } from "react-router-dom";
import { useCategories, useDeleteCategory } from "../api/categories";
import { ApiError } from "../api/client";
import { Card } from "../components/Card";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { Screen } from "../components/Screen";
import { CategoryForm } from "./CategoryForm";

// Reads from the already-loaded category list; the API has no single-category GET.
export function EditCategoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const categories = useCategories();
  const remove = useDeleteCategory();
  const category = categories.data?.find((c) => c.id === Number(id));
  // A successful delete reloads the list before we navigate away; don't flash "not found".
  const deleting = remove.isPending || remove.isSuccess;

  const removeError =
    remove.error instanceof ApiError && remove.error.status === 409
      ? "This category still has transactions; move or delete them first."
      : remove.error?.message;

  async function onDelete(categoryId: number) {
    try {
      await remove.mutateAsync(categoryId);
      navigate("/categories", { replace: true });
    } catch {
      // Shown below via removeError
    }
  }

  return (
    <Screen title="Edit category" backTo="/categories">
      {categories.isPending && <p className="text-muted">Loading…</p>}
      {categories.isError && (
        <p role="alert" className="text-sm text-danger">
          {categories.error.message}
        </p>
      )}
      {categories.data && !category && !deleting && (
        <Card className="p-6 text-center text-muted">Category not found</Card>
      )}
      {category && (
        <div className="flex flex-col gap-6">
          <Card className="p-4">
            <CategoryForm category={category} onSaved={() => navigate("/categories", { replace: true })} />
          </Card>
          <ConfirmDelete
            label="Delete category"
            question="Delete this category? This can't be undone."
            onConfirm={() => onDelete(category.id)}
            pending={remove.isPending}
            error={removeError}
            onCancel={() => remove.reset()}
          />
        </div>
      )}
    </Screen>
  );
}
```

- [ ] **Step 4: Rows become links with a chevron; remove the trash button**

In `frontend/src/pages/CategoriesPage.tsx`:

1. Imports:
   - `import { useCategories } from "../api/categories";` (drop `useDeleteCategory`);
   - replace `import { TrashIcon } from "../components/icons";` with
     `import { ChevronRightIcon } from "../components/icons";`.
2. Remove `const remove = useDeleteCategory();` and the `{remove.isError && (…)}` alert block.
3. Replace each list item with:

```tsx
                <li key={c.id}>
                  <Link
                    to={`/categories/${c.id}/edit`}
                    aria-label={`Edit ${c.name}`}
                    className="flex min-h-14 items-center gap-3 px-3 py-2"
                  >
                    <CategoryChip category={c} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                    {c.kind !== "spending" && (
                      <span className="rounded-full bg-app px-2 py-0.5 text-xs font-medium text-muted">{kindLabel(c.kind)}</span>
                    )}
                    <ChevronRightIcon className="size-5 shrink-0 text-muted" />
                  </Link>
                </li>
```

4. In `frontend/src/components/icons.tsx`, delete the `TrashIcon` function. Then confirm
   `grep -rn TrashIcon frontend/src` prints nothing.

- [ ] **Step 5: Run the checks**

Run: `npx vitest run --maxWorkers=2 src/pages/EditCategoryPage.test.tsx src/pages/CategoriesPage.test.tsx src/pages/NewCategoryPage.test.tsx src/pages/NewCategoryFlow.test.tsx` → all pass.
Run the full suite: `npx vitest run --maxWorkers=2`, then `npx tsc -b && npx eslint .` → clean.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/EditCategoryPage.tsx frontend/src/pages/EditCategoryPage.test.tsx frontend/src/pages/CategoriesPage.tsx frontend/src/pages/CategoriesPage.test.tsx frontend/src/components/icons.tsx
git commit -m "feat: categories delete from the edit screen; rows get a chevron

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Screenshots and devlog (controller)

The controller does this, not a subagent, after Task 4's review:

- **Screenshots** at 390px, light and dark, with the CDP script against a local demo user:
  - the account screen (Edit in the header);
  - an edit screen with its Delete button and confirmation;
  - the Categories and Accounts tabs with chevrons.
  Delete the demo user afterwards.
- **Devlog entry** in `docs/devlog.md`.
- **Commit** as `docs: devlog for edit in the header`.

**PR checkpoint:**
1. Whole-branch review.
2. Push `feat/edit-in-header` and open a PR into `dev`.
3. Wait for CI and Chris's merge.
