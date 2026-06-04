"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPct } from "@/lib/utils";
import { InfoHint } from "@/components/ui/info-hint";
import type { ScenarioResult } from "@/lib/scenarios";
import { AlertTriangle, ShieldOff, TrendingDown, TrendingUp } from "lucide-react";

interface Props {
  results: ScenarioResult[];
}

function regimeIcon(id: string) {
  if (id === "covid") return ShieldOff;
  if (id === "ftx") return TrendingDown;
  return TrendingUp;
}

export function StressTestPanel({ results }: Props) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-brand-600 dark:text-brand-300" />
            Historical regime stress tests
            <InfoHint
              label="Stress tests"
              text="Replays your exact basket weights through real crisis windows (COVID, FTX, ETH-ETF). 'Max DD' is the worst drop; 'days underwater' is how long until it recovered."
            />
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            How this basket would have behaved through three named market regimes.
          </p>
        </div>
        <Badge variant="brand">{results.length} regimes</Badge>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 md:grid-cols-3">
          {results.map((r) => {
            const Icon = regimeIcon(r.id);
            const positive = r.basketReturnPct >= 0;
            return (
              <div
                key={r.id}
                className="rounded-lg border border-border/40 bg-secondary/30 dark:bg-background/40 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-brand-600 dark:text-brand-300" />
                    <span className="text-sm font-semibold leading-tight">{r.name}</span>
                  </div>
                  <Badge variant={positive ? "success" : "danger"} className="whitespace-nowrap text-[10px]">
                    {formatPct(r.basketReturnPct / 100, { signed: true })}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{r.blurb}</p>
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Window</span>
                    <span className="font-mono">{r.days}d</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max DD</span>
                    <span className="font-mono text-red-700 dark:text-red-300">
                      {formatPct(r.maxDrawdownPct / 100)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Days underwater</span>
                    <span className="font-mono">{r.daysUnderwater}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Best leg</span>
                    <span className="font-mono text-emerald-700 dark:text-emerald-300">
                      {r.bestConstituent.symbol} {formatPct(r.bestConstituent.pct / 100, { signed: true })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Worst leg</span>
                    <span className="font-mono text-red-700 dark:text-red-300">
                      {r.worstConstituent.symbol} {formatPct(r.worstConstituent.pct / 100, { signed: true })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
