import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "default" | "primary" | "ghost";
export type ButtonSize = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  default: "",
  primary: "cc-btn-primary",
  ghost: "cc-btn-ghost",
};

/** Every clickable action in the admin panel — new/edit/delete/save/cancel — goes through this. */
export function Button({ variant = "default", size = "md", className = "", ...props }: ButtonProps) {
  const classes = ["cc-btn", VARIANT_CLASS[variant], size === "sm" ? "cc-btn-sm" : "", className]
    .filter(Boolean)
    .join(" ");
  return <button className={classes} {...props} />;
}
