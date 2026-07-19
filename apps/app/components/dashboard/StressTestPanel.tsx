"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@mosaic/ui/card";
import { Badge } from "@mosaic/ui/badge";
import { formatPct } from "@mosaic/core/utils";
import { InfoHint } from "@mosaic/ui/info-hint";
import type { ScenarioResult } from "@mosaic/core/scenarios";
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
            <AlertTriangle className="h-4 w-4 text-primary" />
            Historical regime stress tests
            <InfoHint
              label="Stress tests"
              text="Replays your exact basket weights through real crisis windows (COVID, FTX, ETH-ETF). 'Max DD' is the worst drop; 'days underwater' is how long until it recovered."
            />
          </CardTitle>
          <p className="mt-1 text-xs text-on-surface-variant">
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
                className="rounded-md border border-outline-variant bg-surface-container p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold leading-tight">{r.name}</span>
                  </div>
                  <Badge variant={positive ? "success" : "danger"} className="whitespace-nowrap text-[10px]">
                    {formatPct(r.basketReturnPct / 100, { signed: true })}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-on-surface-variant">{r.blurb}</p>
                <div className="mt-3 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Window</span>
                    <span className="font-mono">{r.days}d</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Max DD</span>
                    <span className="font-mono text-error">
                      {formatPct(r.maxDrawdownPct / 100)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Days underwater</span>
                    <span className="font-mono">{r.daysUnderwater}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Best leg</span>
                    <span className="font-mono text-success">
                      {r.bestConstituent.symbol} {formatPct(r.bestConstituent.pct / 100, { signed: true })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-on-surface-variant">Worst leg</span>
                    <span className="font-mono text-error">
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
