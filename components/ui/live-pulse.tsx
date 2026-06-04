import { cn } from "@/lib/utils";

/**
 * LivePulse — the consistent green "live / streaming" indicator used across
 * the app so every real-time surface reads the same way.
 */
export function LivePulse({
  label,
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-[10px] text-muted-foreground", className)}>
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
      </span>
      {label && <span>{label}</span>}
    </span>
  );
}
