import * as React from "react";
import { cn } from "@mosaic/core/utils";
import { cva, type VariantProps } from "class-variance-authority";

/**
 * M3 buttons (DESIGN.md `button-filled`): 40px tall, fully rounded,
 * label-lg typography, 24px horizontal padding. Filled buttons gain
 * elevation-1 on hover while keeping the primary fill.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-label-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        filled:
          "bg-primary text-on-primary hover:shadow-elevation-1 hover:bg-primary/90 active:bg-primary/85",
        tonal:
          "bg-secondary-container text-on-secondary-container hover:shadow-elevation-1 hover:bg-secondary-container/80",
        elevated:
          "bg-surface-container-low text-primary shadow-elevation-1 hover:shadow-elevation-2 hover:bg-surface-container",
        outlined:
          "border border-outline bg-transparent text-primary hover:bg-primary/10",
        text: "text-primary hover:bg-primary/10",
        error: "bg-error text-on-error hover:shadow-elevation-1 hover:bg-error/90",
        link: "text-primary underline-offset-4 hover:underline",
        // Legacy aliases (shadcn-era names) — resolve to M3 equivalents.
        default:
          "bg-primary text-on-primary hover:shadow-elevation-1 hover:bg-primary/90 active:bg-primary/85",
        secondary:
          "bg-secondary-container text-on-secondary-container hover:shadow-elevation-1 hover:bg-secondary-container/80",
        outline:
          "border border-outline bg-transparent text-primary hover:bg-primary/10",
        ghost: "text-primary hover:bg-primary/10",
        destructive:
          "bg-error text-on-error hover:shadow-elevation-1 hover:bg-error/90",
      },
      size: {
        default: "h-10 px-6", // 40px per DESIGN.md
        sm: "h-8 px-4",
        lg: "h-12 px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "filled", size: "default" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";
