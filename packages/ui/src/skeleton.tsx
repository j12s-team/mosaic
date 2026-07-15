import { cn } from "@mosaic/core/utils";

/**
 * Loading placeholder. Default: quiet sheen on the highest container tone.
 * `variant="tiles"` renders the mosaic tile grid — "tiles not yet placed"
 * (DESIGN.md tile semantics via the motion layer).
 */
export function Skeleton({
  className,
  variant = "sheen",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: "sheen" | "tiles" }) {
  return (
    <div
      className={cn(
        "mosaic-shimmer rounded-sm",
        variant === "tiles" && "mosaic-shimmer-tiles",
        className,
      )}
      {...props}
    />
  );
}
