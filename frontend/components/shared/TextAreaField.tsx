import type { TextareaHTMLAttributes } from "react";

interface TextAreaFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id" | "onChange"> {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  /** Hide the label visually when the surrounding heading already names the field. */
  labelHidden?: boolean;
}

/** A controlled textarea with its label and inline error (guideline FE-06). */
export function TextAreaField({
  id,
  label,
  value,
  onChange,
  error,
  labelHidden = false,
  rows = 3,
  ...props
}: TextAreaFieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelHidden ? "sr-only" : "text-sm font-semibold"}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={
          "w-full rounded-lg border bg-card px-3 py-2 text-base text-ink " +
          (error ? "border-danger" : "border-line")
        }
        {...props}
      />
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
