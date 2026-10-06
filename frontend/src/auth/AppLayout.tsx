import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useLogout, useMe } from "../api/auth";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "font-semibold underline" : "hover:underline";

export function AppLayout() {
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  async function onLogout() {
    await logout.mutateAsync();
    navigate("/login", { replace: true });
  }

  return (
    <div className="mx-auto mt-8 max-w-2xl p-4">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <h1 className="text-2xl font-semibold">Expenses</h1>
          <nav className="flex gap-4 text-sm">
            <NavLink to="/" end className={linkClass}>
              Home
            </NavLink>
            <NavLink to="/categories" className={linkClass}>
              Categories
            </NavLink>
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span>{me.data?.email}</span>
          <button type="button" onClick={onLogout} disabled={logout.isPending} className="rounded border px-3 py-1 disabled:opacity-50">
            Log out
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
