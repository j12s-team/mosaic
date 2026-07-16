import * as React from "react";
import { cn } from "@mosaic/core/utils";

type CardVariant = "elevated" | "filled" | "outlined";

/**
 * M3 cards (DESIGN.md `card-elevated`): 12px radius (shapes.md), tonal
 * surface-container fills, elevation-1 for the elevated variant. No
 * translucency or backdrop blur — depth is tonal.
 */
// Amendment 2 (DESIGN.md): cards mirror the site's brand panels — panel
// surface + violet hairline. Inner content keeps MD3 token contrast.
const cardVariants: Record<CardVariant, string> = {
  elevated: "bg-[var(--panel)] border border-[var(--line)]",
  filled: "bg-[var(--panel2)] border border-[var(--line)]",
  outlined: "bg-transparent border border-[var(--line)]",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "elevated", ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg text-on-surface", cardVariants[variant], className)}
      {...props}
    />
  )
);
Card.displayName = "Card";

export const CardHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1 p-4 pb-2", className)} {...props} />
);

export const CardTitle = ({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn("text-title-md text-on-surface", className)} {...props} />
);

export const CardDescription = ({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn("text-body-md text-on-surface-variant", className)} {...props} />
);

export const CardContent = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("p-4 pt-2", className)} {...props} />
);

export const CardFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex items-center p-4 pt-2", className)} {...props} />
);
