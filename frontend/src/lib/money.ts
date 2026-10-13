// Amounts are decimal strings from the API (NUMERIC(12,2)). We never put them
// through floating point: all arithmetic is on integer cents.

export function toCents(amount: string): number {
  // The sign is handled separately: "-12.5" is -(12 dollars + 50 cents), not -12 + 50.
  const negative = amount.startsWith("-");
  const [whole, frac = ""] = (negative ? amount.slice(1) : amount).split(".");
  const cents = Number(whole) * 100 + Number((frac + "00").slice(0, 2));
  return negative ? -cents : cents;
}

function splitCents(cents: number): { sign: string; dollars: string; frac: string } {
  const abs = Math.abs(cents);
  return {
    sign: cents < 0 ? "-" : "",
    dollars: String(Math.floor(abs / 100)),
    frac: String(abs % 100).padStart(2, "0"),
  };
}

function fromCents(cents: number): string {
  const { sign, dollars, frac } = splitCents(cents);
  return `${sign}${dollars}.${frac}`;
}

export function formatAmount(amount: string): string {
  return fromCents(toCents(amount));
}

export function sumAmounts(amounts: string[]): string {
  return fromCents(amounts.reduce((acc, a) => acc + toCents(a), 0));
}

export function formatCents(cents: number): string {
  const { sign, dollars, frac } = splitCents(cents);
  return `${sign}$${dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${frac}`;
}

export function formatUsd(amount: string): string {
  return formatCents(toCents(amount));
}

export function sharePercent(partCents: number, totalCents: number): number {
  return totalCents === 0 ? 0 : Math.round((partCents * 100) / totalCents);
}
