import { Outlet } from "react-router-dom";
import { TabBar } from "../components/TabBar";

// Tab screens render their own GradientHeader; this adds the bottom tab bar and
// the padding that keeps content above it (and above the home indicator).
export function AppLayout() {
  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-10">
      <Outlet />
      <TabBar placement="bottom" />
    </div>
  );
}
