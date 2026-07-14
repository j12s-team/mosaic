import * as React from "react";
import { cn } from "@mosaic/core/utils";

/**
 * M3 outlined text fields: surface background, outline border, 4px radius
 * (shapes.xs), 2px primary focus indicator, on-surface-variant placeholder.
 */
const fieldClasses =
  "w-full rounded-xs border border-outline bg-surface px-4 py-2 text-body-md text-on-surface placeholder:text-on-surface-variant focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-40";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn("flex h-10", fieldClasses, className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn("flex", fieldClasses, className)} {...props} />
  )
);
Textarea.displayName = "Textarea";
