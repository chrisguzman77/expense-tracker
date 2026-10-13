import { useState } from "react";
import { useSummary } from "../api/summary";
import { formatAmount, sumAmounts } from "../lib/money";
import { GradientHeader } from "../components/GradientHeader";

function currentMonthValue(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function SummaryPage() {
  // <input type="month"> value is "YYYY-MM"; the API wants separate ints.
  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [year, month] = monthValue.split("-").map(Number);
  const summary = useSummary(year, month);

  return (
    <>
      <GradientHeader>
        <h1 className="mt-2 text-3xl font-extrabold">Summary</h1>
      </GradientHeader>
      <section className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <label htmlFor="month">Month</label>
            <input
              id="month"
              type="month"
              value={monthValue}
              onChange={(e) => e.target.value && setMonthValue(e.target.value)}
              className="rounded border p-2"
            />
          </div>
        </div>

        {summary.isPending && <p>Loading…</p>}
        {summary.isError && <p className="text-sm text-red-600">{summary.error.message}</p>}
        {summary.data && (
          <table aria-label="Summary" className="w-full text-left">
            <thead>
              <tr className="border-b text-sm text-gray-500">
                <th className="py-2 font-normal">Category</th>
                <th className="py-2 text-right font-normal">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {summary.data.map((row) => (
                <tr key={row.category_id}>
                  <td className="py-2">{row.name}</td>
                  <td className="py-2 text-right tabular-nums">{formatAmount(row.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-semibold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right tabular-nums">{sumAmounts(summary.data.map((r) => r.total))}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </section>
    </>
  );
}
