import { cn } from "@/lib/utils";

/**
 * LivePulse — the consistent "live / streaming" indicator used across
 * the app. Uses the theme's semantic success role tokens.
 */
export function LivePulse({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-label-md text-on-surface-variant", className)}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
      </span>
      {label && <span>{label}</span>}
    </span>
  );
}
