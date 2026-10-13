import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronLeftIcon } from "./icons";

type Props = { title: string; backTo: string; backState?: unknown; children: ReactNode };

// Shell for screens pushed on top of the tabs. A home-screen app has no browser
// back button, so every pushed screen carries its own, to a fixed route (the
// app may have been opened directly on this screen, with no history).
export function Screen({ title, backTo, backState, children }: Props) {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-line bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto grid h-14 max-w-xl grid-cols-[5rem_1fr_5rem] items-center px-2">
          <Link to={backTo} state={backState} className="inline-flex min-h-11 items-center gap-0.5 px-1 font-medium text-accent">
            <ChevronLeftIcon className="size-5" />
            Back
          </Link>
          <h1 className="truncate text-center font-semibold">{title}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-xl px-4 pt-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">{children}</main>
    </div>
  );
}
