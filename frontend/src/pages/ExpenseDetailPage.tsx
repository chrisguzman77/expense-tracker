import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useDeleteExpense, useExpenses } from "../api/expenses";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { CategoryChip } from "../components/CategoryChip";
import { MoneyText } from "../components/MoneyText";
import { Screen } from "../components/Screen";
import { longDate } from "../lib/dates";

// Reads from the already-loaded expense list; the API has no single-expense GET.
export function ExpenseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const expenses = useExpenses();
  const remove = useDeleteExpense();
  const [confirming, setConfirming] = useState(false);
  const expense = expenses.data?.find((e) => e.id === Number(id));

  async function onDelete(expenseId: number) {
    try {
      await remove.mutateAsync(expenseId);
      navigate("/", { replace: true });
    } catch {
      // Shown below via remove.error
    }
  }

  return (
    <Screen title="Expense" backTo="/">
      {expenses.isPending && <p className="text-muted">Loading…</p>}
      {expenses.isError && (
        <p role="alert" className="text-sm text-danger">
          {expenses.error.message}
        </p>
      )}
      {expenses.data && !expense && <Card className="p-6 text-center text-muted">Expense not found</Card>}
      {expense && (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col items-center gap-2 p-6 text-center">
            <CategoryChip category={expense.category} size="lg" />
            <p className="font-semibold">{expense.category.name}</p>
            <MoneyText amount={expense.amount} className="text-4xl font-extrabold" />
          </Card>
          <Card className="p-4">
            <dl className="grid grid-cols-[5rem_1fr] gap-y-3 text-sm">
              <dt className="text-muted">Date</dt>
              <dd>{longDate(expense.spent_on)}</dd>
              <dt className="text-muted">Note</dt>
              <dd className="break-words">{expense.note || "—"}</dd>
            </dl>
          </Card>
          {remove.isError && (
            <p role="alert" className="text-sm text-danger">
              {remove.error.message}
            </p>
          )}
          {confirming ? (
            <Card className="flex flex-col gap-3 p-4">
              <p className="font-medium">Delete this expense? This can't be undone.</p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" onClick={() => setConfirming(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => onDelete(expense.id)} disabled={remove.isPending}>
                  Delete
                </Button>
              </div>
            </Card>
          ) : (
            <Button variant="danger" onClick={() => setConfirming(true)} className="w-full">
              Delete expense
            </Button>
          )}
        </div>
      )}
    </Screen>
  );
}
