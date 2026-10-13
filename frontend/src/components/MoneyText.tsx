import { formatUsd } from "../lib/money";

export function MoneyText({ amount, className = "" }: { amount: string; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatUsd(amount)}</span>;
}
