import { type ReactNode, useState } from "react";
import { Link } from "react-router-dom";
import type { CategorySummary } from "../api/summary";
import { Card } from "../components/Card";
import { Donut } from "../components/Donut";
import { MoneyText } from "../components/MoneyText";
import { toCents } from "../lib/money";
import { colorVar } from "../lib/palette";

const STORAGE_KEY = "breakdown-collapsed";
const LEGEND_SIZE = 4;

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveCollapsed(collapsed: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  } catch {
    // Storage unavailable: the choice just won't survive a reload.
  }
}

type Props = { rows?: CategorySummary[]; error?: string };

export function BreakdownCard({ rows, error }: Props) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    saveCollapsed(next);
  }

  // The API sorts rows by total, largest first.
  const spent = (rows ?? []).filter((r) => toCents(r.total) > 0);
  const segments = spent.map((r) => ({ key: r.category_id, color: colorVar(r.color), cents: toCents(r.total) }));
  const top = spent[0];

  const toggleButton = (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Show breakdown" : "Hide breakdown"}
      className="min-h-11 px-2 text-sm font-semibold text-accent"
    >
      {collapsed ? "Show" : "Hide"}
    </button>
  );

  let status: ReactNode = null;
  if (error) status = <p role="alert" className="text-sm text-danger">{error}</p>;
  else if (!rows) status = <p className="text-sm text-muted">Loading…</p>;
  else if (spent.length === 0) status = <p className="text-sm text-muted">No spending yet this month</p>;

  if (collapsed) {
    return (
      <Card className="flex items-center gap-3 px-4 py-1.5">
        {segments.length > 0 && <Donut segments={segments} size={28} thickness={6} />}
        <span className="font-bold">Breakdown</span>
        <span className="min-w-0 flex-1 truncate text-sm text-muted">
          {top && (
            <>
              Top: {top.name} <MoneyText amount={top.total} />
            </>
          )}
        </span>
        {toggleButton}
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold">Breakdown</h2>
        {toggleButton}
      </div>
      {status ?? (
        <div className="mt-2 flex items-center gap-4">
          <Donut segments={segments} size={96} thickness={16} />
          <ul aria-label="Top categories" className="flex min-w-0 flex-1 flex-col gap-1.5 text-sm">
            {spent.slice(0, LEGEND_SIZE).map((r) => (
              <li key={r.category_id} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2">
                  <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: colorVar(r.color) }} />
                  <span className="truncate">{r.name}</span>
                </span>
                <MoneyText amount={r.total} className="font-semibold" />
              </li>
            ))}
            {spent.length > LEGEND_SIZE && (
              <li>
                <Link to="/summary" className="inline-flex min-h-11 items-center font-medium text-accent">
                  + {spent.length - LEGEND_SIZE} more
                </Link>
              </li>
            )}
          </ul>
        </div>
      )}
    </Card>
  );
}
