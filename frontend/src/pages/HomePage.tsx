import { useNavigate } from "react-router-dom";
import { useLogout, useMe } from "../api/auth";

export function HomePage() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  async function onLogout() {
    await logout.mutateAsync();
    navigate("/login", { replace: true });
  }

  return (
    <main className="mx-auto mt-16 max-w-2xl p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Expenses</h1>
        <div className="flex items-center gap-4 text-sm">
          <span>{me.data?.email}</span>
          <button type="button" onClick={onLogout} disabled={logout.isPending} className="rounded border px-3 py-1 disabled:opacity-50">
            Log out
          </button>
        </div>
      </header>
    </main>
  );
}
