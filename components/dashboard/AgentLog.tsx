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
    <div className="rounded-xl border border-white/5 bg-card/40 p-4 backdrop-blur-xl">
      <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        Agent log
      </div>
      <ol className="space-y-2 text-sm">
        {steps.map((s) => (
          <li key={s.id} className="flex items-start gap-3">
            <div className="mt-0.5">
              {s.status === "done" ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              ) : s.status === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin text-brand-300" />
              ) : (
                <div className="h-4 w-4 rounded-full border border-white/10" />
              )}
            </div>
            <div>
              <div
                className={
                  s.status === "pending"
                    ? "text-muted-foreground"
                    : "text-foreground"
                }
              >
                {s.label}
              </div>
              {s.detail && (
                <div className="font-mono text-[11px] text-muted-foreground">
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
