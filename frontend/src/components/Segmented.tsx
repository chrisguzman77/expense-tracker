import type { UseFormRegisterReturn } from "react-hook-form";

type Props = {
  legend: string;
  hideLegend?: boolean;
  options: readonly { value: string; label: string }[];
  field: UseFormRegisterReturn;
};

// A group of radio buttons drawn as a segmented control.
export function Segmented({ legend, hideLegend = false, options, field }: Props) {
  return (
    <fieldset>
      <legend className={hideLegend ? "sr-only" : "mb-2 text-sm font-medium"}>{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-xl bg-app p-1">
        {options.map(({ value, label }) => (
          <label key={value}>
            <input type="radio" value={value} className="peer sr-only" {...field} />
            <span className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 font-semibold text-muted peer-checked:bg-surface peer-checked:text-fg peer-checked:shadow-sm peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
              {label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
