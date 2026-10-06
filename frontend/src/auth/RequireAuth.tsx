import { Navigate, Outlet } from "react-router-dom";
import { useMe } from "../api/auth";

export function RequireAuth() {
  const me = useMe();
  if (me.isPending) return <p>Loading…</p>;
  if (me.isError) return <Navigate to="/login" replace />;
  return <Outlet />;
}
