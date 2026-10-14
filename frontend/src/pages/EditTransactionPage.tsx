import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAccounts } from "../api/accounts";
import { useCategories } from "../api/categories";
import { type Transaction, useTransactions } from "../api/transactions";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { TransactionForm, type TransactionFormValues } from "./TransactionForm";

// A stored amount carries its sign; the form keeps the field positive and the sign in the toggle.
function toFormValues(transaction: Transaction): TransactionFormValues {
  const out = transaction.amount.startsWith("-");
  return {
    direction: out ? "out" : "in",
    account_id: String(transaction.account.id),
    category_id: String(transaction.category.id),
    amount: out ? transaction.amount.slice(1) : transaction.amount,
    occurred_on: transaction.occurred_on,
    note: transaction.note ?? "",
  };
}

// Reads from the already-loaded lists; the API has no single-transaction GET.
export function EditTransactionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const transactions = useTransactions();
  const accounts = useAccounts();
  const categories = useCategories();
  const error = transactions.error ?? accounts.error ?? categories.error;
  const transaction = transactions.data?.find((t) => t.id === Number(id));

  let content: ReactNode;
  if (error) {
    content = (
      <p role="alert" className="text-sm text-danger">
        {error.message}
      </p>
    );
  } else if (!transactions.data || !accounts.data || !categories.data) {
    content = <p className="text-muted">Loading…</p>;
  } else if (!transaction) {
    content = <Card className="p-6 text-center text-muted">Transaction not found</Card>;
  } else {
    content = (
      <TransactionForm
        accounts={accounts.data}
        categories={categories.data}
        defaultValues={toFormValues(transaction)}
        transactionId={transaction.id}
        onSaved={() => navigate(`/transactions/${transaction.id}`, { replace: true })}
      />
    );
  }

  return (
    <Screen title="Edit transaction" backTo={transaction ? `/transactions/${transaction.id}` : "/"}>
      {content}
    </Screen>
  );
}
