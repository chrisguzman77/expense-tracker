import type { ReactNode } from "react";

export function AuthCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-brand px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 text-fg shadow-xl">
        <p className="text-sm font-medium text-muted">Expense Tracker</p>
        <h1 className="mb-6 text-2xl font-extrabold">{title}</h1>
        {children}
      </div>
    </main>
  );
}
