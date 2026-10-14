import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAccounts, useDeleteAccount } from "../api/accounts";
import { ApiError } from "../api/client";
import { AccountIcon } from "../components/AccountIcon";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { accountTypeLabel } from "../lib/accountTypes";

// Reads from the already-loaded account list; the API has no single-account GET.
export function AccountDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const accounts = useAccounts();
  const remove = useDeleteAccount();
  const [confirming, setConfirming] = useState(false);
  const account = accounts.data?.find((a) => a.id === Number(id));

  const removeError =
    remove.error instanceof ApiError && remove.error.status === 409
      ? "This account still has transactions; delete them first."
      : remove.error?.message;

  async function onDelete(accountId: number) {
    try {
      await remove.mutateAsync(accountId);
      navigate("/accounts", { replace: true });
    } catch {
      // Shown below via removeError
    }
  }

  function onCancel() {
    setConfirming(false);
    remove.reset();
  }

  return (
    <Screen title="Account" backTo="/accounts">
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
          {removeError && (
            <p role="alert" className="text-sm text-danger">
              {removeError}
            </p>
          )}
          {confirming ? (
            <Card className="flex flex-col gap-3 p-4">
              <p className="font-medium">Delete this account? This can't be undone.</p>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" onClick={onCancel}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => onDelete(account.id)} disabled={remove.isPending}>
                  Delete
                </Button>
              </div>
            </Card>
          ) : (
            <Button variant="danger" onClick={() => setConfirming(true)} className="w-full">
              Delete account
            </Button>
          )}
        </div>
      )}
    </Screen>
  );
}
