import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { type Account, type AccountType, useCreateAccount, useUpdateAccount } from "../api/accounts";
import { Button } from "../components/Button";
import { Field } from "../components/Field";
import { inputClass } from "../components/styles";
import { ACCOUNT_TYPES, accountTypeIcon, accountTypeLabel } from "../lib/accountTypes";

// Mirrors the backend AccountCreate schema.
const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50, "Name must be at most 50 characters"),
  type: z.enum(ACCOUNT_TYPES as [AccountType, ...AccountType[]]),
});
type FormValues = z.infer<typeof schema>;

type Props = {
  // Set when editing: the form starts from it and saves with PUT.
  account?: Account;
  onSaved: () => void;
};

export function AccountForm({ account, onSaved }: Props) {
  const create = useCreateAccount();
  const update = useUpdateAccount();
  const save = account ? update : create;
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: account ? { name: account.name, type: account.type } : { name: "", type: "checking" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (account) await update.mutateAsync({ id: account.id, body: values });
      else await create.mutateAsync(values);
      onSaved();
    } catch {
      // Shown below via save.error
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field label="Name" htmlFor="account-name" error={errors.name?.message}>
        <input id="account-name" placeholder="e.g. Chase Freedom" className={inputClass} {...register("name")} />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Type</legend>
        <div className="grid grid-cols-2 gap-2">
          {ACCOUNT_TYPES.map((t) => (
            <label key={t}>
              <input type="radio" value={t} className="peer sr-only" {...register("type")} />
              <span className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line px-3 font-medium peer-checked:border-accent peer-checked:ring-2 peer-checked:ring-accent peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
                <span aria-hidden="true">{accountTypeIcon(t)}</span>
                {accountTypeLabel(t)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {save.error && (
        <p role="alert" className="text-sm text-danger">
          {save.error.message}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {account ? "Save" : "Add account"}
      </Button>
    </form>
  );
}
