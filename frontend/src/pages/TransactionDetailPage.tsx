import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDeleteTransaction, useTransactions } from "../api/transactions";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CategoryChip } from "../components/CategoryChip";
import { Screen } from "../components/Screen";
import { TransactionAmount } from "../components/TransactionAmount";
import { longDate } from "../lib/dates";

// Reads from the already-loaded transaction list; the API has no single-transaction GET.
export function TransactionDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const transactions = useTransactions();
  const remove = useDeleteTransaction();
  const [confirming, setConfirming] = useState(false);
  const transaction = transactions.data?.find((t) => t.id === Number(id));

  async function onDelete(transactionId: number) {
    try {
      await remove.mutateAsync(transactionId);
      navigate("/", { replace: true });
    } catch {
      // Shown below via remove.error
    }
  }

  return (
    <Screen title="Transaction" backTo="/">
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
          {remove.isError && (
            <p role="alert" className="text-sm text-danger">
              {remove.error.message}
            </p>
          )}
          {confirming ? (
            <Card className="flex flex-col gap-3 p-4">
              <p className="font-medium">Delete this transaction? This can't be undone.</p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => onDelete(transaction.id)} disabled={remove.isPending}>
                  Delete
                </Button>
              </div>
            </Card>
          ) : (
            <Button variant="danger" onClick={() => setConfirming(true)} className="w-full">
              Delete transaction
            </Button>
          )}
        </div>
      )}
    </Screen>
  );
}
