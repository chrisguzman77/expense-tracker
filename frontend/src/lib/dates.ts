// Dates here are local calendar dates as "YYYY-MM-DD" strings, matching the
// API's occurred_on. Parsing goes through new Date(y, m - 1, d) so the browser's
// time zone never shifts a date by one.

const pad = (n: number) => String(n).padStart(2, "0");

function parse(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatLocal(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localToday(): string {
  return formatLocal(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parse(iso);
  return formatLocal(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

export function dayLabel(iso: string, today: string = localToday()): string {
  if (iso === today) return "Today";
  const sameYear = iso.slice(0, 4) === today.slice(0, 4);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(parse(iso));
}

export function longDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parse(iso));
}

// Month values are "YYYY-MM", the same shape as <input type="month">.
export function currentMonthValue(): string {
  return localToday().slice(0, 7);
}

export function shiftMonth(value: string, delta: number): string {
  const [y, m] = value.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthLabel(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(parse(`${value}-01`));
}

export function monthName(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long" }).format(parse(`${value}-01`));
}
