import type { InputHTMLAttributes } from "react";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "onChange"> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Shown under the field and announced; also marks the field invalid. */
  error?: string;
  hint?: string;
}

/**
 * A controlled input with its visible label and inline error (guideline FE-06).
 */
export function TextField({ id, label, value, onChange, error, hint, ...props }: TextFieldProps) {
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={
          "min-h-[44px] w-full rounded-lg border bg-card transition-colors hover:border-ink-soft px-3 text-base text-ink " +
          "placeholder:text-ink-soft/70 " +
          (error ? "border-danger" : "border-line")
        }
        {...props}
      />
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
