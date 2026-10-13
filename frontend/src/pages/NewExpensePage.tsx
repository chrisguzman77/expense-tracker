import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { type Category, useCategories } from "../api/categories";
import { useCreateExpense } from "../api/expenses";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Field } from "../components/Field";
import { Screen } from "../components/Screen";
import { inputClass } from "../components/styles";
import { addDays, localToday } from "../lib/dates";

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

// Form values carried to the new-category screen and back, so nothing typed is lost.
export type ExpenseDraft = Partial<FormValues>;
type LocationState = { draft?: ExpenseDraft; categoryId?: number } | null;

export function NewExpensePage() {
  const categories = useCategories();

  return (
    <Screen title="New expense" backTo="/">
      {categories.isPending && <p className="text-muted">Loading…</p>}
      {categories.isError && (
        <p role="alert" className="text-sm text-danger">
          {categories.error.message}
        </p>
      )}
      {categories.data?.length === 0 && (
        <Card className="p-4">
          <p>Create a category first.</p>
          <Link to="/categories/new" state={{ draft: {} }} className="mt-2 inline-flex min-h-11 items-center font-semibold text-accent">
            + New category
          </Link>
        </Card>
      )}
      {categories.data && categories.data.length > 0 && <ExpenseForm categories={categories.data} />}
    </Screen>
  );
}

// Mounted only once categories have loaded, so the default category is known
// when the form initializes.
function ExpenseForm({ categories }: { categories: Category[] }) {
  const navigate = useNavigate();
  const state = useLocation().state as LocationState;
  const create = useCreateExpense();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      amount: "",
      spent_on: localToday(),
      note: "",
      ...state?.draft,
      // A category created mid-entry wins over the one picked before leaving.
      category_id: String(state?.categoryId ?? (state?.draft?.category_id || categories[0].id)),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        category_id: Number(values.category_id),
        amount: values.amount,
        spent_on: values.spent_on,
        note: values.note || null,
      });
      navigate("/", { replace: true });
    } catch {
      // Shown below via create.error
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Amount" htmlFor="amount" error={errors.amount?.message}>
        <input id="amount" inputMode="decimal" placeholder="0.00" className={`${inputClass} text-2xl font-bold`} {...register("amount")} />
      </Field>
      <Field label="Category" htmlFor="category_id" error={errors.category_id?.message}>
        <select id="category_id" className={inputClass} {...register("category_id")}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => navigate("/categories/new", { state: { draft: getValues() } })}
          className="min-h-11 self-start text-sm font-semibold text-accent"
        >
          + New category
        </button>
      </Field>
      <Field label="Date" htmlFor="spent_on" error={errors.spent_on?.message}>
        <input id="spent_on" type="date" className={inputClass} {...register("spent_on")} />
      </Field>
      <Field label="Note" htmlFor="note" error={errors.note?.message}>
        <input id="note" placeholder="Optional" className={inputClass} {...register("note")} />
      </Field>
      {create.isError && (
        <p role="alert" className="text-sm text-danger">
          {create.error.message}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
        Add expense
      </Button>
    </form>
  );
}
