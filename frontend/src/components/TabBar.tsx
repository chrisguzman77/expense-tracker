import { NavLink } from "react-router-dom";
import { GridIcon, ListIcon, PieIcon, WalletIcon } from "./icons";

const TABS = [
  { to: "/", label: "Expenses", Icon: ListIcon, end: true },
  { to: "/summary", label: "Summary", Icon: PieIcon, end: false },
  { to: "/categories", label: "Categories", Icon: GridIcon, end: false },
  { to: "/accounts", label: "Accounts", Icon: WalletIcon, end: false },
];

// Bottom bar on phones; on wide screens the same tabs sit in the gradient header.
export function TabBar({ placement }: { placement: "bottom" | "top" }) {
  if (placement === "top") {
    return (
      <nav aria-label="Top navigation" className="hidden gap-1 md:flex">
        {TABS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold ${
                isActive ? "bg-white/25 text-white" : "text-white/90 hover:bg-white/15"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Tab bar"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="grid grid-cols-4">
        {TABS.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium ${
                isActive ? "text-accent" : "text-muted"
              }`
            }
          >
            <Icon className="size-6" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
