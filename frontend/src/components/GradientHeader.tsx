import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { GearIcon } from "./icons";
import { TabBar } from "./TabBar";

type Props = { children?: ReactNode; overlap?: boolean };

// The gradient band at the top of each tab. The status-bar inset keeps content
// clear of the notch when the app runs full screen. `overlap` leaves room for a
// card that overlaps the band (give the content below it -mt-10).
export function GradientHeader({ children, overlap = false }: Props) {
  return (
    <header className="bg-brand pt-[env(safe-area-inset-top)] text-white">
      <div className={`mx-auto max-w-5xl px-4 pt-2 ${overlap ? "pb-14" : "pb-6"}`}>
        <div className="flex min-h-11 items-center gap-2">
          <TabBar placement="top" />
          <Link
            to="/settings"
            aria-label="Settings"
            className="ml-auto inline-flex size-11 items-center justify-center rounded-full hover:bg-white/15"
          >
            <GearIcon className="size-6" />
          </Link>
        </div>
        {children}
      </div>
    </header>
  );
}
