import { Link } from "react-router-dom";
import { useCategories } from "../api/categories";
import { Card } from "../components/Card";
import { CategoryChip } from "../components/CategoryChip";
import { GradientHeader } from "../components/GradientHeader";
import { ChevronRightIcon } from "../components/icons";
import { kindLabel } from "../lib/categoryKinds";
import { CategoryForm } from "./CategoryForm";

export function CategoriesPage() {
  const categories = useCategories();

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
                <li key={c.id}>
                  <Link
                    to={`/categories/${c.id}/edit`}
                    aria-label={`Edit ${c.name}`}
                    className="flex min-h-14 items-center gap-3 px-3 py-2"
                  >
                    <CategoryChip category={c} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                    {c.kind !== "spending" && (
                      <span className="rounded-full bg-app px-2 py-0.5 text-xs font-medium text-muted">{kindLabel(c.kind)}</span>
                    )}
                    <ChevronRightIcon className="size-5 shrink-0 text-muted" />
                  </Link>
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
