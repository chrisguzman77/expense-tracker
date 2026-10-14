import type { AccountType } from "../api/accounts";
import { accountTypeIcon } from "../lib/accountTypes";

const SIZES = {
  md: "size-10 rounded-xl text-lg",
  lg: "size-14 rounded-2xl text-2xl",
};

// Decorative: the account's name and type are always shown next to it.
export function AccountIcon({ type, size = "md" }: { type: AccountType; size?: "md" | "lg" }) {
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center bg-app ${SIZES[size]}`}>
      {accountTypeIcon(type)}
    </span>
  );
}
