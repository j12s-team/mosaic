"use client";

import { Loader2, CheckCircle2 } from "lucide-react";

export interface LogStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done";
  detail?: string;
}

export function AgentLog({ steps }: { steps: LogStep[] }) {
  return (
    <div className="rounded-md border border-outline-variant bg-surface-container-low dark:bg-surface-container-low p-4">
      <div className="mb-2 brand-label">
        Agent log
      </div>
      <ol className="space-y-2 text-sm">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className="tile-in flex items-start gap-3"
            style={{ "--tile-i": i } as React.CSSProperties}
          >
            <div className="mt-0.5">
              {s.status === "done" ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : s.status === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-outline-variant" />
              )}
            </div>
            <div>
              <div
                className={
                  s.status === "pending"
                    ? "text-on-surface-variant"
                    : "text-on-surface"
                }
              >
                {s.label}
              </div>
              {s.detail && (
                <div className="font-mono text-[11px] text-on-surface-variant">
                  {s.detail}
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
