import { cn } from "@/lib/utils";

/** A neutral shimmer placeholder used while data is loading. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-secondary/70 dark:bg-background/50",
        className,
      )}
      {...props}
    />
  );
}
