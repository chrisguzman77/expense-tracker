import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useCategories, useCreateCategory, useDeleteCategory } from "../api/categories";

// Mirrors the backend CategoryCreate schema: name 1..50 characters.
const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50, "Name must be at most 50 characters"),
});
type FormValues = z.infer<typeof schema>;

export function CategoriesPage() {
  const categories = useCategories();
  const create = useCreateCategory();
  const remove = useDeleteCategory();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync(values);
      reset();
    } catch {
      // Shown below via create.error
    }
  });

  const serverError = create.error ?? remove.error;

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Categories</h2>

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-1">
        <div className="flex gap-2">
          <label htmlFor="name" className="sr-only">
            New category
          </label>
          <input id="name" placeholder="New category" className="flex-1 rounded border p-2" {...register("name")} />
          <button type="submit" disabled={isSubmitting} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50">
            Add
          </button>
        </div>
        {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
      </form>

      {serverError && (
        <p role="alert" className="text-sm text-red-600">
          {serverError.message}
        </p>
      )}

      {categories.isPending && <p>Loading…</p>}
      {categories.isError && <p className="text-sm text-red-600">{categories.error.message}</p>}
      {categories.data && (
        <ul aria-label="Categories" className="divide-y rounded border">
          {categories.data.map((category) => (
            <li key={category.id} className="flex items-center justify-between p-3">
              <span>{category.name}</span>
              <button
                type="button"
                onClick={() => remove.mutate(category.id)}
                disabled={remove.isPending}
                aria-label={`Delete ${category.name}`}
                className="text-sm text-red-600 underline disabled:opacity-50"
              >
                Delete
              </button>
            </li>
          ))}
          {categories.data.length === 0 && <li className="p-3 text-sm text-gray-500">No categories yet.</li>}
        </ul>
      )}
    </section>
  );
}
