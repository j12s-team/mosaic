"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

/**
 * InfoHint — a tiny (?) affordance that reveals a one-sentence, plain-English
 * explanation of a metric. Works on hover (desktop) and tap (mobile), and is
 * keyboard accessible. No dependencies beyond lucide + React.
 */
export function InfoHint({
  text,
  label,
  side = "top",
}: {
  text: string;
  label?: string;
  side?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label ? `What “${label}” means` : "What this means"}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-grid h-3.5 w-3.5 place-items-center rounded-full text-muted-foreground/60 transition hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/50"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 z-50 w-52 -translate-x-1/2 rounded-lg border border-border/60 bg-popover/95 bg-card p-2.5 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-foreground shadow-xl backdrop-blur-xl ${
            side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
