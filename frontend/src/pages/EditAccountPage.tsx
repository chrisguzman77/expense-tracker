import { useNavigate, useParams } from "react-router-dom";
import { useAccounts } from "../api/accounts";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { AccountForm } from "./AccountForm";

// Reads from the already-loaded account list; the API has no single-account GET.
export function EditAccountPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const accounts = useAccounts();
  const account = accounts.data?.find((a) => a.id === Number(id));

  return (
    <Screen title="Edit account" backTo={`/accounts/${id}`}>
      {accounts.isPending && <p className="text-muted">Loading…</p>}
      {accounts.isError && (
        <p role="alert" className="text-sm text-danger">
          {accounts.error.message}
        </p>
      )}
      {accounts.data && !account && <Card className="p-6 text-center text-muted">Account not found</Card>}
      {account && (
        <Card className="p-4">
          <AccountForm account={account} onSaved={() => navigate(`/accounts/${account.id}`, { replace: true })} />
        </Card>
      )}
    </Screen>
  );
}
