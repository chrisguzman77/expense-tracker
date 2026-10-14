import type { Category } from "../api/categories";
import type { components } from "../api/schema";

export type CategoryKind = components["schemas"]["CategoryRead"]["kind"];

// A Record keyed by the generated API union: tsc fails if the lists drift apart.
const LABELS: Record<CategoryKind, string> = {
  spending: "Spending",
  income: "Income",
  transfer: "Transfer",
};

export const CATEGORY_KINDS = Object.keys(LABELS) as CategoryKind[];

export function kindLabel(kind: CategoryKind): string {
  return LABELS[kind];
}

// Grouped by kind, spending first: the order the transaction form's category select shows them in.
export function groupCategories(categories: Category[]) {
  return CATEGORY_KINDS.map((kind) => ({ kind, items: categories.filter((c) => c.kind === kind) }));
}
