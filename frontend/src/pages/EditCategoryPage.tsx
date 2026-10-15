import { useNavigate, useParams } from "react-router-dom";
import { useCategories, useDeleteCategory } from "../api/categories";
import { ApiError } from "../api/client";
import { Card } from "../components/Card";
import { ConfirmDelete } from "../components/ConfirmDelete";
import { Screen } from "../components/Screen";
import { CategoryForm } from "./CategoryForm";

// Reads from the already-loaded category list; the API has no single-category GET.
export function EditCategoryPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const categories = useCategories();
  const remove = useDeleteCategory();
  const category = categories.data?.find((c) => c.id === Number(id));
  // A successful delete reloads the list before we navigate away; don't flash "not found".
  const deleting = remove.isPending || remove.isSuccess;

  const removeError =
    remove.error instanceof ApiError && remove.error.status === 409
      ? "This category still has transactions; move or delete them first."
      : remove.error?.message;

  async function onDelete(categoryId: number) {
    try {
      await remove.mutateAsync(categoryId);
      navigate("/categories", { replace: true });
    } catch {
      // Shown below via removeError
    }
  }

  return (
    <Screen title="Edit category" backTo="/categories">
      {categories.isPending && <p className="text-muted">Loading…</p>}
      {categories.isError && (
        <p role="alert" className="text-sm text-danger">
          {categories.error.message}
        </p>
      )}
      {categories.data && !category && !deleting && (
        <Card className="p-6 text-center text-muted">Category not found</Card>
      )}
      {category && (
        <div className="flex flex-col gap-6">
          <Card className="p-4">
            <CategoryForm category={category} onSaved={() => navigate("/categories", { replace: true })} />
          </Card>
          <ConfirmDelete
            label="Delete category"
            question="Delete this category? This can't be undone."
            onConfirm={() => onDelete(category.id)}
            pending={remove.isPending}
            error={removeError}
            onCancel={() => remove.reset()}
          />
        </div>
      )}
    </Screen>
  );
}
