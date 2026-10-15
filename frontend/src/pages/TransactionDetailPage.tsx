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
