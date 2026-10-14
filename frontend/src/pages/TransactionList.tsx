import { Link } from "react-router-dom";
import type { Transaction } from "../api/transactions";
import { Card } from "../components/Card";
import { CategoryChip } from "../components/CategoryChip";
import { TransactionAmount } from "../components/TransactionAmount";
import { dayLabel } from "../lib/dates";

type DayGroup = { day: string; items: Transaction[] };

// The API returns transactions newest first, so rows for the same day are adjacent.
function groupByDay(transactions: Transaction[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const transaction of transactions) {
    const last = groups.at(-1);
    if (last && last.day === transaction.occurred_on) last.items.push(transaction);
    else groups.push({ day: transaction.occurred_on, items: [transaction] });
  }
  return groups;
}

export function TransactionList({ transactions, emptyMessage = "No transactions yet. Tap + to add one." }: { transactions: Transaction[]; emptyMessage?: string }) {
  if (transactions.length === 0) {
    return <Card className="p-6 text-center text-muted">{emptyMessage}</Card>;
  }

  return (
    <div className="flex flex-col gap-5">
      {groupByDay(transactions).map(({ day, items }) => (
        <section key={day} aria-label={dayLabel(day)}>
          <h2 className="mb-2 px-1 text-sm font-bold">{dayLabel(day)}</h2>
          <Card>
            <ul className="divide-y divide-line">
              {items.map((t) => (
                <li key={t.id}>
                  <Link to={`/transactions/${t.id}`} className="flex min-h-14 items-center gap-3 px-3 py-2">
                    <CategoryChip category={t.category} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{t.category.name}</span>
                      <span className="block truncate text-sm text-muted">
                        {[t.account.name, t.note].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <TransactionAmount amount={t.amount} className="font-bold" />
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
    </div>
  );
}
