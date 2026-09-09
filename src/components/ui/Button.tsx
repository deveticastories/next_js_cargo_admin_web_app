import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "default" | "primary" | "ghost";
export type ButtonSize = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /**
   * Pass the same busy flag you're already tracking for the API call this
   * button triggers (`saving`, `submitting`, ...) — shows a spinner and
   * disables the button for the duration, so no click can double-fire a
   * create/update/delete request while the last one is still in flight.
   */
  loading?: boolean;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: "",
  primary: "cc-btn-primary",
  ghost: "cc-btn-ghost",
};

/** Every clickable action in the admin panel — new/edit/delete/save/cancel — goes through this. */
export function Button({ variant = "default", size = "md", loading = false, className = "", disabled, children, ...props }: ButtonProps) {
  const classes = ["cc-btn", VARIANT_CLASS[variant], size === "sm" ? "cc-btn-sm" : "", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <span className="cc-btn-spinner" aria-hidden="true" />}
      {children}
    </button>
  );
}
