"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

/**
 * InfoHint — a tiny (?) affordance that reveals a one-sentence, plain-English
 * explanation of a metric. M3 rich-tooltip styling: inverse-surface container
 * with inverse-on-surface text, elevation-2, shapes.sm radius.
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
        className="inline-grid h-3.5 w-3.5 place-items-center rounded-full text-on-surface-variant transition hover:text-on-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 z-50 w-52 -translate-x-1/2 rounded-sm bg-inverse-surface p-2.5 text-left text-label-md font-normal normal-case leading-relaxed tracking-normal text-inverse-on-surface shadow-elevation-2 ${
            side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
          }`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
