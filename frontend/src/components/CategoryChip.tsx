import { colorVar } from "../lib/palette";

type Props = {
  category: { name: string; icon: string; color: string };
  size?: "sm" | "md" | "lg";
};

const SIZES = {
  sm: "size-8 rounded-lg text-base",
  md: "size-10 rounded-xl text-lg",
  lg: "size-14 rounded-2xl text-2xl",
};

// Decorative: the category name is always shown next to it, so color is never
// the only signal.
export function CategoryChip({ category, size = "md" }: Props) {
  return (
    <span
      aria-hidden="true"
      data-color={category.color}
      className={`inline-flex shrink-0 items-center justify-center ${SIZES[size]}`}
      style={{ backgroundColor: colorVar(category.color) }}
    >
      {category.icon}
    </span>
  );
}
