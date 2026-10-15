import { useParams } from "react-router-dom";
import { useAccounts } from "../api/accounts";
import { useTransactions } from "../api/transactions";
import { AccountIcon } from "../components/AccountIcon";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { accountTypeLabel } from "../lib/accountTypes";
import { TransactionList } from "./TransactionList";

// Reads from the already-loaded account list; the API has no single-account GET.
export function AccountDetailPage() {
  const { id } = useParams();
  const accounts = useAccounts();
  const transactions = useTransactions(Number(id));
  const account = accounts.data?.find((a) => a.id === Number(id));

  return (
    <Screen
      title="Account"
      backTo="/accounts"
      action={account ? { to: `/accounts/${account.id}/edit`, label: "Edit" } : undefined}
    >
      {accounts.isPending && <p className="text-muted">Loading…</p>}
      {accounts.isError && (
        <p role="alert" className="text-sm text-danger">
          {accounts.error.message}
        </p>
      )}
      {accounts.data && !account && <Card className="p-6 text-center text-muted">Account not found</Card>}
      {account && (
        <div className="flex flex-col gap-4">
          <Card className="flex flex-col items-center gap-2 p-6 text-center">
            <AccountIcon type={account.type} size="lg" />
            <p className="text-xl font-bold">{account.name}</p>
            <p className="text-sm text-muted">{accountTypeLabel(account.type)}</p>
          </Card>
          <section aria-label="Transactions" className="flex flex-col gap-2">
            <h2 className="px-1 font-bold">Transactions</h2>
            {transactions.isPending && <p className="text-muted">Loading…</p>}
            {transactions.isError && (
              <p role="alert" className="text-sm text-danger">
                {transactions.error.message}
              </p>
            )}
            {transactions.data && (
              <TransactionList transactions={transactions.data} emptyMessage="No transactions in this account yet." />
            )}
          </section>
        </div>
      )}
    </Screen>
  );
}
