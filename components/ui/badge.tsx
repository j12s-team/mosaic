import * as React from "react";
import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "outline" | "success" | "warning" | "danger" | "brand";
}

/**
 * M3 chip-style labels: container role pairs, label-md typography,
 * fully rounded (DESIGN.md shapes.full for tags).
 */
export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const styles = {
    default: "bg-secondary-container text-on-secondary-container border-transparent",
    outline: "border-outline bg-transparent text-on-surface-variant",
    success: "bg-success-container text-on-success-container border-transparent",
    warning: "bg-warning-container text-on-warning-container border-transparent",
    danger: "bg-error-container text-on-error-container border-transparent",
    brand: "bg-primary-container text-on-primary-container border-transparent",
  }[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-label-md",
        styles,
        className
      )}
      {...props}
    />
  );
}
