import type { ReactNode } from "react";

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-2xl bg-surface shadow-sm ring-1 ring-line ${className}`}>{children}</div>;
}
