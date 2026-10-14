import { useNavigate, useParams } from "react-router-dom";
import { useCategories } from "../api/categories";
import { Card } from "../components/Card";
import { Screen } from "../components/Screen";
import { CategoryForm } from "./CategoryForm";

// Reads from the already-loaded category list; the API has no single-category GET.
export function EditCategoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const categories = useCategories();
  const category = categories.data?.find((c) => c.id === Number(id));

  return (
    <Screen title="Edit category" backTo="/categories">
      {categories.isPending && <p className="text-muted">Loading…</p>}
      {categories.isError && (
        <p role="alert" className="text-sm text-danger">
          {categories.error.message}
        </p>
      )}
      {categories.data && !category && <Card className="p-6 text-center text-muted">Category not found</Card>}
      {category && (
        <Card className="p-4">
          <CategoryForm category={category} onSaved={() => navigate("/categories", { replace: true })} />
        </Card>
      )}
    </Screen>
  );
}
