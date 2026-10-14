import { useCategories, useDeleteCategory } from "../api/categories";
import { Card } from "../components/Card";
import { CategoryChip } from "../components/CategoryChip";
import { GradientHeader } from "../components/GradientHeader";
import { TrashIcon } from "../components/icons";
import { kindLabel } from "../lib/categoryKinds";
import { CategoryForm } from "./CategoryForm";

export function CategoriesPage() {
  const categories = useCategories();
  const remove = useDeleteCategory();

  return (
    <>
      <GradientHeader overlap>
        <h1 className="mt-2 text-3xl font-extrabold">Categories</h1>
      </GradientHeader>
      <main className="mx-auto -mt-10 flex max-w-2xl flex-col gap-4 px-4">
        <Card className="p-4">
          <h2 className="mb-3 font-bold">New category</h2>
          <CategoryForm />
        </Card>

        {remove.isError && (
          <p role="alert" className="text-sm text-danger">
            {remove.error.message}
          </p>
        )}
        {categories.isPending && <p className="text-muted">Loading…</p>}
        {categories.isError && (
          <p role="alert" className="text-sm text-danger">
            {categories.error.message}
          </p>
        )}
        {categories.data && (
          <Card>
            <ul aria-label="Categories" className="divide-y divide-line">
              {categories.data.map((c) => (
                <li key={c.id} className="flex min-h-14 items-center gap-3 px-3 py-2">
                  <CategoryChip category={c} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                  {c.kind !== "spending" && (
                    <span className="rounded-full bg-app px-2 py-0.5 text-xs font-medium text-muted">{kindLabel(c.kind)}</span>
                  )}
                  <button
                    type="button"
                    onClick={() => remove.mutate(c.id)}
                    disabled={remove.isPending}
                    aria-label={`Delete ${c.name}`}
                    className="inline-flex size-11 items-center justify-center rounded-full text-muted hover:text-danger disabled:opacity-50"
                  >
                    <TrashIcon className="size-5" />
                  </button>
                </li>
              ))}
              {categories.data.length === 0 && <li className="p-4 text-sm text-muted">No categories yet.</li>}
            </ul>
          </Card>
        )}
      </main>
    </>
  );
}
