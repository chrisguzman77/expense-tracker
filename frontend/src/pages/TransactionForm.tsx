import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Account } from "../api/accounts";
import type { Category } from "../api/categories";
import { useCreateTransaction, useUpdateTransaction } from "../api/transactions";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { Segmented } from "../components/Segmented";
import { inputClass } from "../components/styles";
import { accountTypeIcon } from "../lib/accountTypes";
import { groupCategories, kindLabel } from "../lib/categoryKinds";
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
export type TransactionFormValues = z.infer<typeof schema>;

// Form values carried to the new-category screen and back, so nothing typed is lost.
export type TransactionDraft = Partial<TransactionFormValues>;

type Props = {
  accounts: Account[];
  categories: Category[];
  defaultValues: TransactionFormValues;
  // Set when editing: the form saves with PUT instead of POST.
  transactionId?: number;
  onSaved: () => void;
  // Create only: opens the new-category screen with what's typed so far.
  onNewCategory?: (draft: TransactionDraft) => void;
};

export function TransactionForm({ accounts, categories, defaultValues, transactionId, onSaved, onNewCategory }: Props) {
  const groups = groupCategories(categories);
  const create = useCreateTransaction();
  const update = useUpdateTransaction();
  const save = transactionId === undefined ? create : update;
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<TransactionFormValues>({ resolver: zodResolver(schema), defaultValues });

  const onSubmit = handleSubmit(async (values) => {
    const body = {
      account_id: Number(values.account_id),
      category_id: Number(values.category_id),
      amount: values.direction === "out" ? `-${values.amount}` : values.amount,
      occurred_on: values.occurred_on,
      note: values.note || null,
    };
    try {
      if (transactionId === undefined) await create.mutateAsync(body);
      else await update.mutateAsync({ id: transactionId, body });
      onSaved();
    } catch {
      // Shown below via save.error
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
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <optgroup key={g.kind} label={kindLabel(g.kind)}>
                {g.items.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
        </select>
        {onNewCategory && (
          <button
            type="button"
            onClick={() => onNewCategory(getValues())}
            className="min-h-11 self-start text-sm font-semibold text-accent"
          >
            + New category
          </button>
        )}
      </Field>
      <Field label="Date" htmlFor="occurred_on" error={errors.occurred_on?.message}>
        <input id="occurred_on" type="date" className={inputClass} {...register("occurred_on")} />
      </Field>
      <Field label="Note" htmlFor="note" error={errors.note?.message}>
        <input id="note" placeholder="Optional" className={inputClass} {...register("note")} />
      </Field>
      {save.error && (
        <p role="alert" className="text-sm text-danger">
          {save.error.message}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
        {transactionId === undefined ? "Add transaction" : "Save"}
      </Button>
    </form>
  );
}
