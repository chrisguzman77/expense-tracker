import { useNavigate } from "react-router-dom";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { AccountForm } from "./AccountForm";

export function NewAccountPage() {
  const navigate = useNavigate();

  return (
    <Screen title="New account" backTo="/accounts">
      <Card className="p-4">
        <AccountForm onSaved={() => navigate("/accounts", { replace: true })} />
      </Card>
    </Screen>
  );
}
