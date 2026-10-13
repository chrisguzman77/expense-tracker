import { Link } from "react-router-dom";
import type { Expense } from "../api/expenses";
import { Card } from "../components/Card";
import { CategoryChip } from "../components/CategoryChip";
import { MoneyText } from "../components/MoneyText";
import { dayLabel } from "../lib/dates";

type DayGroup = { day: string; items: Expense[] };

// The API returns expenses newest first, so rows for the same day are adjacent.
function groupByDay(expenses: Expense[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const expense of expenses) {
    const last = groups.at(-1);
    if (last && last.day === expense.spent_on) last.items.push(expense);
    else groups.push({ day: expense.spent_on, items: [expense] });
  }
  return groups;
}

export function ExpenseList({ expenses }: { expenses: Expense[] }) {
  if (expenses.length === 0) {
    return <Card className="p-6 text-center text-muted">No expenses yet. Tap + to add one.</Card>;
  }

  return (
    <div className="flex flex-col gap-5">
      {groupByDay(expenses).map(({ day, items }) => (
        <section key={day} aria-label={dayLabel(day)}>
          <h2 className="mb-2 px-1 text-sm font-bold">{dayLabel(day)}</h2>
          <Card>
            <ul className="divide-y divide-line">
              {items.map((e) => (
                <li key={e.id}>
                  <Link to={`/expenses/${e.id}`} className="flex min-h-14 items-center gap-3 px-3 py-2">
                    <CategoryChip category={e.category} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{e.category.name}</span>
                      {e.note && <span className="block truncate text-sm text-muted">{e.note}</span>}
                    </span>
                    <MoneyText amount={e.amount} className="font-bold" />
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
