import type { AccountType } from "../api/accounts";

// A Record keyed by the generated API union: tsc fails if the backend's type
// list and this one ever differ.
const TYPES: Record<AccountType, { label: string; icon: string }> = {
  checking: { label: "Checking", icon: "🏦" },
  savings: { label: "Savings", icon: "🐷" },
  credit_card: { label: "Credit card", icon: "💳" },
  cash: { label: "Cash", icon: "💵" },
};

export const ACCOUNT_TYPES = Object.keys(TYPES) as AccountType[];

export function accountTypeLabel(type: AccountType): string {
  return TYPES[type].label;
}

export function accountTypeIcon(type: AccountType): string {
  return TYPES[type].icon;
}
