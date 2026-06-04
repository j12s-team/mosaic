"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPct } from "@/lib/utils";
import { InfoHint } from "@/components/ui/info-hint";
import type { MonteCarloResult } from "@/lib/montecarlo";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import { Dices } from "lucide-react";

interface Props {
  result: MonteCarloResult;
}

export function MonteCarloPanel({ result }: Props) {
  const exp = result.expectedTerminal - 1;
  const med = result.medianTerminal - 1;
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Dices className="h-4 w-4 text-brand-600 dark:text-brand-300" />
            Monte Carlo · 30-day projection
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {result.paths.toLocaleString()} bootstrap paths from observed daily returns.
            Heavy-tailed by construction — Normal-fit would underestimate tail risk.
          </p>
        </div>
        <Badge variant="brand">{result.paths.toLocaleString()} paths</Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-lg border border-border/40 bg-secondary/30 dark:bg-background/40 p-3">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              VaR (95%)
              <InfoHint label="VaR (95%)" text="Value at Risk: in a normal-to-bad month (the worst 1-in-20), you'd be down at least this much in 30 days." />
            </div>
            <div className="mt-1 font-mono text-lg font-semibold text-red-700 dark:text-red-300">
              {formatPct(result.varPct95 / 100, { signed: true })}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">5th-pct terminal return</div>
          </div>
          <div className="rounded-lg border border-border/40 bg-secondary/30 dark:bg-background/40 p-3">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              CVaR (95%)
              <InfoHint label="CVaR (95%)" text="Conditional VaR: if you do land in that worst 5% of outcomes, this is the average loss — the 'how bad is bad' number." />
            </div>
            <div className="mt-1 font-mono text-lg font-semibold text-red-700 dark:text-red-300">
              {formatPct(result.cvarPct95 / 100, { signed: true })}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">avg loss in worst 5%</div>
          </div>
          <div className="rounded-lg border border-border/40 bg-secondary/30 dark:bg-background/40 p-3">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Expected
              <InfoHint label="Expected" text="The average 30-day return across all 1,000 simulated paths — the middle-of-the-road outcome, not a guarantee." />
            </div>
            <div className={`mt-1 font-mono text-lg font-semibold ${exp >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"}`}>
              {formatPct(exp, { signed: true })}
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">mean terminal return</div>
          </div>
          <div className="rounded-lg border border-border/40 bg-secondary/30 dark:bg-background/40 p-3">
            <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
              Loss prob.
              <InfoHint label="Loss probability" text="Share of the 1,000 simulated paths that finished below what you put in — your odds of being underwater at day 30." />
            </div>
            <div className={`mt-1 font-mono text-lg font-semibold ${result.probLossPct >= 50 ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"}`}>
              {result.probLossPct.toFixed(1)}%
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">P(terminal &lt; entry)</div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
          {/* Fan chart */}
          <div className="rounded-lg border border-border/40 bg-secondary/30 dark:bg-background/40 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Path fan (p10 / p50 / p90)
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={result.fan} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="mc-fan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="rgb(49,158,255)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="rgb(49,158,255)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis dataKey="step" tick={{ fill: "currentColor", fillOpacity: 0.55, fontSize: 10 }} />
                  <YAxis
                    tick={{ fill: "currentColor", fillOpacity: 0.55, fontSize: 10 }}
                    width={48}
                    domain={["auto", "auto"]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,15,28,0.95)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number, name: string) => [
                      `${((v - 1) * 100).toFixed(2)}%`,
                      name,
                    ]}
                  />
                  <Area type="monotone" dataKey="p90" stroke="rgba(49,158,255,0.4)" fill="url(#mc-fan)" />
                  <Area type="monotone" dataKey="p10" stroke="rgba(49,158,255,0.4)" fill="rgba(10,15,28,1)" />
                  <Line type="monotone" dataKey="p50" stroke="rgb(49,158,255)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Terminal histogram */}
          <div className="rounded-lg border border-border/40 bg-secondary/30 dark:bg-background/40 p-3">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              Terminal-value distribution
            </div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={result.histogram} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                  <XAxis
                    dataKey="x"
                    tick={{ fill: "currentColor", fillOpacity: 0.55, fontSize: 9 }}
                    tickFormatter={(v: number) => `${((v - 1) * 100).toFixed(0)}%`}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,15,28,0.95)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => `${(((v as number) - 1) * 100).toFixed(2)}%`}
                    formatter={(v: number) => [`${v} paths`, "Count"]}
                  />
                  <Bar dataKey="count" fill="rgba(49,158,255,0.6)" />
                  <ReferenceLine x={1} stroke="currentColor" strokeOpacity={0.4} strokeDasharray="2 2" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              Dashed line = breakeven · Median {(med * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
