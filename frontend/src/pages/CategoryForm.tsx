import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { type Category, useCreateCategory, useUpdateCategory } from "../api/categories";
import { Button } from "../components/Button";
import { CategoryChip } from "../components/CategoryChip";
import { Field } from "../components/Field";
import { Segmented } from "../components/Segmented";
import { inputClass } from "../components/styles";
import { CATEGORY_KINDS, type CategoryKind, kindLabel } from "../lib/categoryKinds";
import { CATEGORY_COLORS, type CategoryColor, colorLabel, colorVar } from "../lib/palette";

// Mirrors the backend CategoryCreate schema.
const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(50, "Name must be at most 50 characters"),
  // Counted in code points like the backend (Python len), not UTF-16 units:
  // "👨‍👩‍👧" is 5 code points but 8 units.
  icon: z
    .string()
    .trim()
    .min(1, "Pick an emoji")
    .refine((v) => [...v].length <= 16, "Emoji must be at most 16 characters"),
  color: z.enum(CATEGORY_COLORS as [CategoryColor, ...CategoryColor[]]),
  kind: z.enum(CATEGORY_KINDS as [CategoryKind, ...CategoryKind[]]),
});
type FormValues = z.infer<typeof schema>;

const DEFAULTS: FormValues = { name: "", icon: "🏷️", color: "amber", kind: "spending" };

type Props = {
  // Set when editing: the form starts from it and saves with PUT.
  category?: Category;
  onSaved?: (category: Category) => void;
};

export function CategoryForm({ category, onSaved }: Props) {
  const create = useCreateCategory();
  const update = useUpdateCategory();
  const save = category ? update : create;
  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: category
      ? { name: category.name, icon: category.icon, color: category.color, kind: category.kind }
      : DEFAULTS,
  });
  const [icon, color] = useWatch({ control, name: ["icon", "color"] });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = category
        ? await update.mutateAsync({ id: category.id, body: values })
        : await create.mutateAsync(values);
      // The Categories tab keeps this form on screen to add another.
      if (!category) reset(DEFAULTS);
      onSaved?.(saved);
    } catch {
      // Shown below via save.error
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <CategoryChip category={{ name: "", icon: icon || DEFAULTS.icon, color }} size="lg" />
        <div className="flex-1">
          <Field label="Name" htmlFor="category-name" error={errors.name?.message}>
            <input id="category-name" className={inputClass} {...register("name")} />
          </Field>
        </div>
      </div>
      <Field label="Emoji" htmlFor="category-icon" error={errors.icon?.message}>
        <input id="category-icon" className={inputClass} {...register("icon")} />
      </Field>
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Color</legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.map((c) => (
            <label key={c} className="relative">
              <input type="radio" value={c} aria-label={colorLabel(c)} className="peer sr-only" {...register("color")} />
              <span
                aria-hidden="true"
                className="block size-11 cursor-pointer rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-fg peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
                style={{ backgroundColor: colorVar(c) }}
              />
            </label>
          ))}
        </div>
      </fieldset>
      <Segmented
        legend="Kind"
        options={CATEGORY_KINDS.map((kind) => ({ value: kind, label: kindLabel(kind) }))}
        field={register("kind")}
      />
      {category && <p className="text-sm text-muted">Changing the kind also changes past months in the summary.</p>}
      {save.error && (
        <p role="alert" className="text-sm text-danger">
          {save.error.message}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {category ? "Save" : "Add category"}
      </Button>
    </form>
  );
}
