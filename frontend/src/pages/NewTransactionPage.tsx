import type { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { type Account, useAccounts } from "../api/accounts";
import { type Category, useCategories } from "../api/categories";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { groupCategories } from "../lib/categoryKinds";
import { localToday } from "../lib/dates";
import { type TransactionDraft, TransactionForm } from "./TransactionForm";

type LocationState = { draft?: TransactionDraft; categoryId?: number } | null;

export function NewTransactionPage() {
  const accounts = useAccounts();
  const categories = useCategories();
  const error = accounts.error ?? categories.error;

  let content: ReactNode;
  if (error) {
    content = (
      <p role="alert" className="text-sm text-danger">
        {error.message}
      </p>
    );
  } else if (!accounts.data || !categories.data) {
    content = <p className="text-muted">Loading…</p>;
  } else if (accounts.data.length === 0) {
    content = (
      <Card className="p-4">
        <p>Add an account first.</p>
        <Link to="/accounts/new" className="mt-2 inline-flex min-h-11 items-center font-semibold text-accent">
          + New account
        </Link>
      </Card>
    );
  } else if (categories.data.length === 0) {
    content = (
      <Card className="p-4">
        <p>Create a category first.</p>
        <Link to="/categories/new" state={{ draft: {} }} className="mt-2 inline-flex min-h-11 items-center font-semibold text-accent">
          + New category
        </Link>
      </Card>
    );
  } else {
    content = <NewTransactionForm accounts={accounts.data} categories={categories.data} />;
  }

  return (
    <Screen title="New transaction" backTo="/">
      {content}
    </Screen>
  );
}

// Mounted only once accounts and categories have loaded, so the defaults are
// known when the form initializes.
function NewTransactionForm({ accounts, categories }: { accounts: Account[]; categories: Category[] }) {
  const navigate = useNavigate();
  const state = useLocation().state as LocationState;
  // The default category is the first one the select shows.
  const firstCategory = groupCategories(categories).flatMap((g) => g.items)[0];

  return (
    <TransactionForm
      accounts={accounts}
      categories={categories}
      defaultValues={{
        direction: "out",
        // One account: nothing to choose. Several: make the choice explicit.
        account_id: accounts.length === 1 ? String(accounts[0].id) : "",
        amount: "",
        occurred_on: localToday(),
        note: "",
        ...state?.draft,
        // A category created mid-entry wins over the one picked before leaving.
        category_id: String(state?.categoryId ?? (state?.draft?.category_id || firstCategory.id)),
      }}
      onSaved={() => navigate("/", { replace: true })}
      onNewCategory={(draft) => navigate("/categories/new", { state: { draft } })}
    />
  );
}
