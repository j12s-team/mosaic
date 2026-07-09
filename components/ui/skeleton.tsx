import { cn } from "@/lib/utils";

/** A neutral pulse placeholder on the highest surface-container tone. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-sm bg-surface-container-highest", className)}
      {...props}
    />
  );
}
