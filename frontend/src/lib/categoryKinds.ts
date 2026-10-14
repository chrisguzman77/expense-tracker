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
