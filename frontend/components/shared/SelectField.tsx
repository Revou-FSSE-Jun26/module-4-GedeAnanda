import type { SelectHTMLAttributes } from "react";

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id" | "onChange"> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

/** A controlled select with its visible label (guideline FE-06). */
export function SelectField({ id, label, value, onChange, options, ...props }: SelectFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-[44px] w-full rounded-lg border border-line bg-card px-3 text-base text-ink"
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
