import type { components } from "../api/schema";

export type CategoryColor = components["schemas"]["CategoryRead"]["color"];

// A Record keyed by the generated API union: tsc fails if the backend's color
// list and this one ever differ. Shades live in index.css as --cat-<name>.
const LABELS: Record<CategoryColor, string> = {
  amber: "Amber",
  emerald: "Emerald",
  sky: "Sky",
  violet: "Violet",
  rose: "Rose",
  orange: "Orange",
  teal: "Teal",
  indigo: "Indigo",
  lime: "Lime",
  slate: "Slate",
};

export const CATEGORY_COLORS = Object.keys(LABELS) as CategoryColor[];

export function colorLabel(color: CategoryColor): string {
  return LABELS[color];
}

export function colorVar(color: string): string {
  return color in LABELS ? `var(--cat-${color})` : "var(--cat-slate)";
}
