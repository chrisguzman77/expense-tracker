import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useCategories } from "../api/categories";
import { useCreateExpense, useDeleteExpense, useExpenses } from "../api/expenses";

// Amounts stay strings end to end (NUMERIC(12,2) on the backend); we only
// validate the shape here and never do float math on them.
const amountMessage = "Enter an amount greater than 0 with up to 2 decimals";
const schema = z.object({
  category_id: z.string().min(1, "Pick a category"),
  amount: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, amountMessage)
    .refine((v) => Number(v) > 0, amountMessage),
  spent_on: z
    .string()
    .min(1, "Date is required")
    // Backend allows one day of slack for timezone skew; mirror it.
    .refine((v) => v <= addDays(localToday(), 1), "Date cannot be in the future"),
  note: z.string().trim().max(255, "Note must be at most 255 characters"),
});
type FormValues = z.infer<typeof schema>;

export function ExpensesPage() {
  const categories = useCategories();
  const expenses = useExpenses();
  const create = useCreateExpense();
  const remove = useDeleteExpense();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { amount: "", spent_on: localToday(), note: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        category_id: Number(values.category_id),
        amount: values.amount,
        spent_on: values.spent_on,
        note: values.note || null,
      });
      reset({ category_id: values.category_id, amount: "", spent_on: localToday(), note: "" });
    } catch {
      // Shown below via create.error
    }
  });

  const serverError = create.error ?? remove.error;
  const field = "rounded border p-2";

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-xl font-semibold">Expenses</h2>

      {categories.data && categories.data.length === 0 && (
        <p className="text-sm">
          Create a category first on the{" "}
          <Link to="/categories" className="underline">
            Categories
          </Link>{" "}
          page.
        </p>
      )}

      {categories.data && categories.data.length > 0 && (
        <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="category_id">Category</label>
            <select id="category_id" className={field} {...register("category_id")}>
              {categories.data.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {errors.category_id && <p className="text-sm text-red-600">{errors.category_id.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="amount">Amount</label>
            <input id="amount" inputMode="decimal" placeholder="0.00" className={field} {...register("amount")} />
            {errors.amount && <p className="text-sm text-red-600">{errors.amount.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="spent_on">Date</label>
            <input id="spent_on" type="date" className={field} {...register("spent_on")} />
            {errors.spent_on && <p className="text-sm text-red-600">{errors.spent_on.message}</p>}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="note">Note</label>
            <input id="note" className={field} {...register("note")} />
            {errors.note && <p className="text-sm text-red-600">{errors.note.message}</p>}
          </div>
          <button type="submit" disabled={isSubmitting} className="rounded bg-black px-4 py-2 text-white disabled:opacity-50 sm:col-span-2">
            Add expense
          </button>
        </form>
      )}

      {serverError && (
        <p role="alert" className="text-sm text-red-600">
          {serverError.message}
        </p>
      )}

      {expenses.isPending && <p>Loading…</p>}
      {expenses.isError && <p className="text-sm text-red-600">{expenses.error.message}</p>}
      {expenses.data && (
        <ul aria-label="Expenses" className="divide-y rounded border">
          {expenses.data.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-4 p-3">
              <div className="flex flex-col">
                <span>
                  <span className="font-medium">{e.category.name}</span>
                  {e.note && (
                    <>
                      <span className="text-gray-400">{" · "}</span>
                      <span className="text-gray-600">{e.note}</span>
                    </>
                  )}
                </span>
                <span className="text-sm text-gray-500">{e.spent_on}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="tabular-nums">{e.amount}</span>
                <button
                  type="button"
                  onClick={() => remove.mutate(e.id)}
                  disabled={remove.isPending}
                  aria-label={`Delete expense ${e.id}`}
                  className="text-sm text-red-600 underline disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
          {expenses.data.length === 0 && <li className="p-3 text-sm text-gray-500">No expenses yet.</li>}
        </ul>
      )}
    </section>
  );
}

function localToday(): string {
  return formatLocal(new Date());
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return formatLocal(new Date(y, m - 1, d + days));
}

function formatLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
