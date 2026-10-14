import { Link } from "react-router-dom";
import { useTransactions } from "../api/transactions";
import { useSummary } from "../api/summary";
import { Card } from "../components/Card";
import { GradientHeader } from "../components/GradientHeader";
import { PlusIcon } from "../components/icons";
import { currentMonthValue, monthName } from "../lib/dates";
import { formatUsd, sumAmounts } from "../lib/money";
import { BreakdownCard } from "./BreakdownCard";
import { TransactionList } from "./TransactionList";

export function TransactionsPage() {
  const monthValue = currentMonthValue();
  const [year, month] = monthValue.split("-").map(Number);
  const transactions = useTransactions();
  const summary = useSummary(year, month);
  const total = summary.data ? formatUsd(sumAmounts(summary.data.map((r) => r.total))) : "—";

  return (
    <>
      <GradientHeader overlap>
        <div className="mt-2 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-sm font-medium text-white/90">{monthName(monthValue)} spending</h1>
            <p className="text-4xl font-extrabold tracking-tight tabular-nums">{total}</p>
          </div>
          <Link
            to="/transactions/new"
            aria-label="Add transaction"
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-indigo-600 shadow-md"
          >
            <PlusIcon className="size-6" />
          </Link>
        </div>
      </GradientHeader>
      <main className="mx-auto -mt-10 grid max-w-5xl gap-6 px-4 md:grid-cols-[20rem_1fr] md:items-start">
        <BreakdownCard rows={summary.data} error={summary.error?.message} />
        <div className="md:mt-14">
          {transactions.isPending && <Card className="p-4 text-muted">Loading…</Card>}
          {transactions.isError && (
            <p role="alert" className="text-sm text-danger">
              {transactions.error.message}
            </p>
          )}
          {transactions.data && <TransactionList transactions={transactions.data} />}
        </div>
      </main>
    </>
  );
}
