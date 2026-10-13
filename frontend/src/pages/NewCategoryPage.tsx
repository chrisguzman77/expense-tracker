import { useLocation, useNavigate } from "react-router-dom";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { CategoryForm } from "./CategoryForm";
import type { ExpenseDraft } from "./NewExpensePage";

type LocationState = { draft?: ExpenseDraft } | null;

// Opened from "+ New category" on the expense form (with the form's draft in
// router state) or directly. With a draft, it hands the draft back along with
// the new category's id so the form comes back filled in and pre-selected.
export function NewCategoryPage() {
  const navigate = useNavigate();
  const draft = (useLocation().state as LocationState)?.draft;
  const fromExpense = draft !== undefined;

  return (
    <Screen
      title="New category"
      backTo={fromExpense ? "/expenses/new" : "/categories"}
      backState={fromExpense ? { draft } : undefined}
    >
      <Card className="p-4">
        <CategoryForm
          onCreated={(category) =>
            fromExpense
              ? navigate("/expenses/new", { replace: true, state: { draft, categoryId: category.id } })
              : navigate("/categories", { replace: true })
          }
        />
      </Card>
    </Screen>
  );
}
