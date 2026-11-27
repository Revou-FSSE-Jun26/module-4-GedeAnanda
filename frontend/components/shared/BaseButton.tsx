import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "destructive";

interface BaseButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-action text-white hover:bg-action-deep",
  secondary: "border border-line bg-card text-ink hover:border-ink-soft",
  destructive: "bg-danger text-white hover:bg-danger-deep",
};

/**
 * The app's only button (guideline FE-04). At least 44 x 44 px so it is easy
 * to hit on a phone.
 */
export function BaseButton({
  variant = "primary",
  type = "button",
  className = "",
  ...props
}: BaseButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      className={
        "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-2 rounded-lg " +
        "px-4 text-sm font-semibold transition-colors " +
        "disabled:cursor-not-allowed disabled:opacity-55 " +
        `${VARIANT_CLASSES[variant]} ${className}`
      }
      {...props}
    />
  );
}
