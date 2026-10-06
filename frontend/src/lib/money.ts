// Amounts are decimal strings from the API (NUMERIC(12,2)). We never put them
// through floating point: all arithmetic is on integer cents.

function toCents(amount: string): number {
  const [whole, frac = ""] = amount.split(".");
  return Number(whole) * 100 + Number((frac + "00").slice(0, 2));
}

function fromCents(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const frac = Math.abs(cents % 100);
  return `${whole}.${String(frac).padStart(2, "0")}`;
}

export function formatAmount(amount: string): string {
  return fromCents(toCents(amount));
}

export function sumAmounts(amounts: string[]): string {
  return fromCents(amounts.reduce((acc, a) => acc + toCents(a), 0));
}
