import type { ReactNode } from "react";

type Props = { label: string; htmlFor: string; error?: string; children: ReactNode };

export function Field({ label, htmlFor, error, children }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
