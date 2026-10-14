import { zodResolver } from "@hookform/resolvers/zod";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { type Account, useAccounts } from "../api/accounts";
import { type Category, useCategories } from "../api/categories";
import { useCreateTransaction } from "../api/transactions";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { Field } from "../components/Field";
import { Screen } from "../components/Screen";
import { Segmented } from "../components/Segmented";
import { inputClass } from "../components/styles";
import { accountTypeIcon } from "../lib/accountTypes";
import { addDays, localToday } from "../lib/dates";

const DIRECTIONS = [
  { value: "out", label: "Money out" },
  { value: "in", label: "Money in" },
] as const;

// Amounts stay strings end to end (NUMERIC(12,2) on the backend); we only
// validate the shape here and never do float math on them. The field is always
// positive: the direction supplies the sign (money out is negative).
const amountMessage = "Enter an amount greater than 0 with up to 2 decimals";
const schema = z.object({
  direction: z.enum(["out", "in"]),
  account_id: z.string().min(1, "Pick an account"),
  category_id: z.string().min(1, "Pick a category"),
  amount: z
    .string()
    .regex(/^\d{1,10}(\.\d{1,2})?$/, amountMessage)
    .refine((v) => Number(v) > 0, amountMessage),
  occurred_on: z
    .string()
    .min(1, "Date is required")
    // Backend allows one day of slack for timezone skew; mirror it.
    .refine((v) => v <= addDays(localToday(), 1), "Date cannot be in the future"),
  note: z.string().trim().max(255, "Note must be at most 255 characters"),
});
type FormValues = z.infer<typeof schema>;

// Form values carried to the new-category screen and back, so nothing typed is lost.
export type TransactionDraft = Partial<FormValues>;
type LocationState = { draft?: TransactionDraft; categoryId?: number } | null;

export function NewTransactionPage() {
  const accounts = useAccounts();
  const categories = useCategories();
  const error = accounts.error ?? categories.error;

  let content: ReactNode;
  if (error) {
    content = (
      <p role="alert" className="text-sm text-danger">
        {error.message}
      </p>
    );
  } else if (!accounts.data || !categories.data) {
    content = <p className="text-muted">Loading…</p>;
  } else if (accounts.data.length === 0) {
    content = (
      <Card className="p-4">
        <p>Add an account first.</p>
        <Link to="/accounts/new" className="mt-2 inline-flex min-h-11 items-center font-semibold text-accent">
          + New account
        </Link>
      </Card>
    );
  } else if (categories.data.length === 0) {
    content = (
      <Card className="p-4">
        <p>Create a category first.</p>
        <Link to="/categories/new" state={{ draft: {} }} className="mt-2 inline-flex min-h-11 items-center font-semibold text-accent">
          + New category
        </Link>
      </Card>
    );
  } else {
    content = <TransactionForm accounts={accounts.data} categories={categories.data} />;
  }

  return (
    <Screen title="New transaction" backTo="/">
      {content}
    </Screen>
  );
}

// Mounted only once accounts and categories have loaded, so the defaults are
// known when the form initializes.
function TransactionForm({ accounts, categories }: { accounts: Account[]; categories: Category[] }) {
  const navigate = useNavigate();
  const state = useLocation().state as LocationState;
  const create = useCreateTransaction();
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      direction: "out",
      // One account: nothing to choose. Several: make the choice explicit.
      account_id: accounts.length === 1 ? String(accounts[0].id) : "",
      amount: "",
      occurred_on: localToday(),
      note: "",
      ...state?.draft,
      // A category created mid-entry wins over the one picked before leaving.
      category_id: String(state?.categoryId ?? (state?.draft?.category_id || categories[0].id)),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await create.mutateAsync({
        account_id: Number(values.account_id),
        category_id: Number(values.category_id),
        amount: values.direction === "out" ? `-${values.amount}` : values.amount,
        occurred_on: values.occurred_on,
        note: values.note || null,
      });
      navigate("/", { replace: true });
    } catch {
      // Shown below via create.error
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Segmented legend="Direction" hideLegend options={DIRECTIONS} field={register("direction")} />
      <Field label="Amount" htmlFor="amount" error={errors.amount?.message}>
        <input id="amount" inputMode="decimal" placeholder="0.00" className={`${inputClass} text-2xl font-bold`} {...register("amount")} />
      </Field>
      <Field label="Account" htmlFor="account_id" error={errors.account_id?.message}>
        <select id="account_id" className={inputClass} {...register("account_id")}>
          {accounts.length > 1 && <option value="">Choose an account</option>}
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {accountTypeIcon(a.type)} {a.name}
            </option>
          ))}
        </select>
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
      <Field label="Date" htmlFor="occurred_on" error={errors.occurred_on?.message}>
        <input id="occurred_on" type="date" className={inputClass} {...register("occurred_on")} />
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
        Add transaction
      </Button>
    </form>
  );
}
