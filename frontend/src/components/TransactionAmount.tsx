import { formatCents, toCents } from "../lib/money";

// Money out (negative) reads like a price, with no minus sign; money in gets a
// plus sign and the income color, so the two never look alike.
export function TransactionAmount({ amount, className = "" }: { amount: string; className?: string }) {
  const cents = toCents(amount);
  if (cents > 0) {
    return <span className={`tabular-nums text-income ${className}`}>+{formatCents(cents)}</span>;
  }
  return <span className={`tabular-nums ${className}`}>{formatCents(-cents)}</span>;
}
