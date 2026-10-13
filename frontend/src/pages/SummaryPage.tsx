import { useState } from "react";
import { useSummary } from "../api/summary";
import { Card } from "../components/Card";
import { CategoryChip } from "../components/CategoryChip";
import { Donut } from "../components/Donut";
import { GradientHeader } from "../components/GradientHeader";
import { ChevronLeftIcon, ChevronRightIcon } from "../components/icons";
import { MoneyText } from "../components/MoneyText";
import { currentMonthValue, monthLabel, shiftMonth } from "../lib/dates";
import { formatCents, sharePercent, toCents } from "../lib/money";
import { colorVar } from "../lib/palette";

const arrowClass = "inline-flex size-11 items-center justify-center rounded-full bg-white/20 disabled:opacity-40";

export function SummaryPage() {
  const thisMonth = currentMonthValue();
  const [monthValue, setMonthValue] = useState(thisMonth);
  const [year, month] = monthValue.split("-").map(Number);
  const summary = useSummary(year, month);

  // The API sorts by total, largest first, with unused categories (0) last.
  const rows = summary.data ?? [];
  const totalCents = rows.reduce((sum, r) => sum + toCents(r.total), 0);
  const segments = rows
    .filter((r) => toCents(r.total) > 0)
    .map((r) => ({ key: r.category_id, color: colorVar(r.color), cents: toCents(r.total) }));

  return (
    <>
      <GradientHeader>
        <div className="mt-2 flex items-center justify-between gap-2">
          <button type="button" aria-label="Previous month" onClick={() => setMonthValue(shiftMonth(monthValue, -1))} className={arrowClass}>
            <ChevronLeftIcon className="size-6" />
          </button>
          <div className="text-center">
            <h1 className="text-sm font-medium text-white/90">{monthLabel(monthValue)}</h1>
            <p className="text-3xl font-extrabold tracking-tight tabular-nums">{summary.data ? formatCents(totalCents) : "—"}</p>
          </div>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonthValue(shiftMonth(monthValue, 1))}
            disabled={monthValue === thisMonth}
            className={arrowClass}
          >
            <ChevronRightIcon className="size-6" />
          </button>
        </div>
      </GradientHeader>

      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-5">
        {summary.isPending && <p className="text-muted">Loading…</p>}
        {summary.isError && (
          <p role="alert" className="text-sm text-danger">
            {summary.error.message}
          </p>
        )}
        {summary.data && totalCents === 0 && (
          <Card className="p-6 text-center text-muted">No spending in {monthLabel(monthValue)}</Card>
        )}
        {summary.data && totalCents > 0 && (
          <Card className="p-4">
            <div className="flex justify-center py-2">
              <Donut segments={segments} size={160} thickness={24} />
            </div>
            <ul aria-label="Categories this month" className="mt-2 flex flex-col">
              {rows.map((r) => {
                const cents = toCents(r.total);
                const percent = sharePercent(cents, totalCents);
                return (
                  <li key={r.category_id} className="py-2.5">
                    <div className="flex items-center gap-3">
                      <CategoryChip category={r} size="sm" />
                      <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
                      <MoneyText amount={r.total} className="font-bold" />
                      {cents > 0 ? (
                        <span className="w-10 text-right text-sm text-muted tabular-nums">{percent}%</span>
                      ) : (
                        <span className="w-10" aria-hidden="true" />
                      )}
                    </div>
                    {cents > 0 && (
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-app">
                        <div className="h-full rounded-full" style={{ width: `${percent}%`, backgroundColor: colorVar(r.color) }} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </main>
    </>
  );
}
