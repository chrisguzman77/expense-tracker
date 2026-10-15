import { Link } from "react-router-dom";
import { useAccounts } from "../api/accounts";
import { AccountIcon } from "../components/AccountIcon";
import { Card } from "../components/Card";
import { GradientHeader } from "../components/GradientHeader";
import { ChevronRightIcon, PlusIcon } from "../components/icons";
import { accountTypeLabel } from "../lib/accountTypes";

export function AccountsPage() {
  const accounts = useAccounts();

  return (
    <>
      <GradientHeader overlap>
        <div className="mt-2 flex items-end justify-between gap-4">
          <h1 className="text-3xl font-extrabold">Accounts</h1>
          <Link
            to="/accounts/new"
            aria-label="Add account"
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-white text-indigo-600 shadow-md"
          >
            <PlusIcon className="size-6" />
          </Link>
        </div>
      </GradientHeader>
      <main className="mx-auto -mt-10 flex max-w-2xl flex-col gap-4 px-4">
        {accounts.isPending && <Card className="p-4 text-muted">Loading…</Card>}
        {accounts.isError && (
          <p role="alert" className="text-sm text-danger">
            {accounts.error.message}
          </p>
        )}
        {accounts.data && (
          <Card>
            <ul aria-label="Accounts" className="divide-y divide-line">
              {accounts.data.map((a) => (
                <li key={a.id}>
                  <Link to={`/accounts/${a.id}`} className="flex min-h-14 items-center gap-3 px-3 py-2">
                    <AccountIcon type={a.type} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{a.name}</span>
                      <span className="block text-sm text-muted">{accountTypeLabel(a.type)}</span>
                    </span>
                    <ChevronRightIcon className="size-5 shrink-0 text-muted" />
                  </Link>
                </li>
              ))}
              {accounts.data.length === 0 && <li className="p-4 text-sm text-muted">No accounts yet.</li>}
            </ul>
          </Card>
        )}
      </main>
    </>
  );
}
