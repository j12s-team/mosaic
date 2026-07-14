"use client";

// Dual-mode dashboard (adaptive-experience / dual-mode-ui spec):
//   guided — progressive stepper with plain-English framing (new users)
//   desk   — dense grid, everything mounted, keyboard-first (experts)
// One data layer, two compositions. Preference persists; first-ever
// visitors land in Guided.

import { useEffect, useState } from "react";
import { Compass, LayoutGrid, Keyboard, X } from "lucide-react";

export type UiMode = "guided" | "desk";

const KEY = "mosaic.uimode";

/**
 * Mode with persisted preference. Returns `null` until mounted so the SSR
 * markup (desk baseline) never mismatches; callers treat null as "desk".
 */
export function useUiMode(): { mode: UiMode | null; setMode: (m: UiMode) => void } {
  const [mode, setModeState] = useState<UiMode | null>(null);
  useEffect(() => {
    const stored = localStorage.getItem(KEY) as UiMode | null;
    setModeState(stored === "desk" || stored === "guided" ? stored : "guided");
  }, []);
  const setMode = (m: UiMode) => {
    setModeState(m);
    try {
      localStorage.setItem(KEY, m);
    } catch {
      /* private mode */
    }
  };
  return { mode, setMode };
}

export function ModeToggle({
  mode,
  onChange,
}: {
  mode: UiMode | null;
  onChange: (m: UiMode) => void;
}) {
  const active = mode ?? "desk";
  const base =
    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-label-lg transition";
  return (
    <div
      role="group"
      aria-label="Dashboard mode"
      className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-surface-container p-1"
    >
      <button
        type="button"
        aria-pressed={active === "guided"}
        onClick={() => onChange("guided")}
        className={`${base} ${
          active === "guided"
            ? "bg-secondary-container text-on-secondary-container"
            : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        <Compass className="h-3.5 w-3.5" />
        Guided
      </button>
      <button
        type="button"
        aria-pressed={active === "desk"}
        onClick={() => onChange("desk")}
        className={`${base} ${
          active === "desk"
            ? "bg-secondary-container text-on-secondary-container"
            : "text-on-surface-variant hover:text-on-surface"
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Desk
      </button>
    </div>
  );
}

/** Numbered step wrapper for Guided mode. */
export function GuidedStep({
  step,
  title,
  description,
  children,
  done,
}: {
  step: number;
  title: string;
  description: string;
  children: React.ReactNode;
  done?: boolean;
}) {
  return (
    <section aria-label={`Step ${step}: ${title}`}>
      <div className="mb-3 flex items-start gap-3">
        <span
          className={`grid h-8 w-8 flex-shrink-0 place-items-center rounded-full text-label-lg ${
            done
              ? "bg-primary text-on-primary"
              : "bg-secondary-container text-on-secondary-container"
          }`}
        >
          {step}
        </span>
        <div>
          <h2 className="text-title-md text-on-background">{title}</h2>
          <p className="text-body-md text-on-surface-variant">{description}</p>
        </div>
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

export interface DeskShortcut {
  key: string;
  label: string;
  run: () => void;
}

/**
 * Desk-mode keyboard shortcuts. Inactive whenever a text input is focused
 * (dual-mode-ui spec). `?` toggles the reference sheet.
 */
export function useDeskShortcuts(enabled: boolean, shortcuts: DeskShortcut[]) {
  const [sheetOpen, setSheetOpen] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "?") {
        e.preventDefault();
        setSheetOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") {
        setSheetOpen(false);
        return;
      }
      const match = shortcuts.find((s) => s.key === e.key);
      if (match) {
        e.preventDefault();
        match.run();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [enabled, shortcuts]);
  return { sheetOpen, setSheetOpen };
}

export function ShortcutSheet({
  open,
  onClose,
  shortcuts,
}: {
  open: boolean;
  onClose: () => void;
  shortcuts: DeskShortcut[];
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-label="Keyboard shortcuts"
    >
      <div
        className="w-full max-w-sm rounded-lg bg-surface-container-low p-5 shadow-elevation-3"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-title-md text-on-surface">
            <Keyboard className="h-4 w-4 text-primary" />
            Desk shortcuts
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-on-surface-variant transition hover:text-on-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="space-y-2">
          {shortcuts.map((s) => (
            <li key={s.key} className="flex items-center justify-between text-body-md">
              <span className="text-on-surface-variant">{s.label}</span>
              <kbd className="rounded-sm border border-outline-variant bg-surface-container px-2 py-0.5 font-mono text-label-md text-on-surface">
                {s.key}
              </kbd>
            </li>
          ))}
          <li className="flex items-center justify-between text-body-md">
            <span className="text-on-surface-variant">Toggle this sheet</span>
            <kbd className="rounded-sm border border-outline-variant bg-surface-container px-2 py-0.5 font-mono text-label-md text-on-surface">
              ?
            </kbd>
          </li>
        </ul>
      </div>
    </div>
  );
}
