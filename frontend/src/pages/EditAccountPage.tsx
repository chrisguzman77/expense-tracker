import { useNavigate, useParams } from "react-router-dom";
import { useAccounts, useDeleteAccount } from "../api/accounts";
import { ApiError } from "../api/client";
import { Card } from "../components/Card";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { Screen } from "../components/Screen";
import { AccountForm } from "./AccountForm";

// Reads from the already-loaded account list; the API has no single-account GET.
export function EditAccountPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const accounts = useAccounts();
  const remove = useDeleteAccount();
  const account = accounts.data?.find((a) => a.id === Number(id));
  // A successful delete reloads the list before we navigate away; don't flash "not found".
  const deleting = remove.isPending || remove.isSuccess;

  const removeError =
    remove.error instanceof ApiError && remove.error.status === 409
      ? "This account still has transactions; move or delete them first."
      : remove.error?.message;

  async function onDelete(accountId: number) {
    try {
      await remove.mutateAsync(accountId);
      navigate("/accounts", { replace: true });
    } catch {
      // Shown below via removeError
    }
  }

  return (
    <Screen title="Edit account" backTo={account ? `/accounts/${account.id}` : "/accounts"}>
      {accounts.isPending && <p className="text-muted">Loading…</p>}
      {accounts.isError && (
        <p role="alert" className="text-sm text-danger">
          {accounts.error.message}
        </p>
      )}
      {accounts.data && !account && !deleting && <Card className="p-6 text-center text-muted">Account not found</Card>}
      {account && (
        <div className="flex flex-col gap-6">
          <Card className="p-4">
            <AccountForm account={account} onSaved={() => navigate(`/accounts/${account.id}`, { replace: true })} />
          </Card>
          <ConfirmDelete
            label="Delete account"
            question="Delete this account? This can't be undone."
            onConfirm={() => onDelete(account.id)}
            pending={remove.isPending}
            error={removeError}
            onCancel={() => remove.reset()}
          />
        </div>
      )}
    </Screen>
  );
}
