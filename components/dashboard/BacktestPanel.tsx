"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPct } from "@/lib/utils";
import type { BacktestResult } from "@/lib/backtest";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LineChart, History } from "lucide-react";

interface Props {
  result: BacktestResult;
}

function Stat({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "neutral";
  hint?: string;
}) {
  const color =
    tone === "pos" ? "text-emerald-700 dark:text-emerald-300" : tone === "neg" ? "text-red-700 dark:text-red-300" : "text-foreground";
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/30 dark:bg-background/40 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 font-mono text-lg font-semibold ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function BacktestPanel({ result }: Props) {
  const beats = result.excessReturnPct > 0;
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-brand-600 dark:text-brand-300" />
            90-day backtest
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Daily-rebalanced replay over historical returns · vs MAG7.ssi benchmark
          </p>
        </div>
        <Badge variant={beats ? "success" : "warning"}>
          {beats ? "Beats" : "Trails"} bench {formatPct(result.excessReturnPct / 100, { signed: true })}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat
            label="Total return"
            value={formatPct(result.totalReturnPct / 100, { signed: true })}
            tone={result.totalReturnPct >= 0 ? "pos" : "neg"}
            hint={`bench ${formatPct(result.benchmarkTotalReturnPct / 100, { signed: true })}`}
          />
          <Stat
            label="Sharpe"
            value={result.sharpe.toFixed(2)}
            tone={result.sharpe >= 1 ? "pos" : result.sharpe < 0 ? "neg" : "neutral"}
            hint="annualized, rf=4%"
          />
          <Stat
            label="Max drawdown"
            value={formatPct(result.maxDrawdownPct / 100)}
            tone="neg"
            hint={result.maxDrawdownDate}
          />
          <Stat
            label="Sortino"
            value={result.sortino.toFixed(2)}
            tone={result.sortino >= 1 ? "pos" : "neutral"}
            hint="downside-only vol"
          />
          <Stat label="Annualized return" value={formatPct(result.annualizedReturnPct / 100, { signed: true })} tone={result.annualizedReturnPct >= 0 ? "pos" : "neg"} />
          <Stat label="Annualized vol" value={formatPct(result.annualizedVolPct / 100)} tone="neutral" />
          <Stat label="Beta vs bench" value={result.beta.toFixed(2)} tone="neutral" />
          <Stat label="Win-rate (daily)" value={`${result.winRatePct.toFixed(1)}%`} tone="neutral" />
        </div>

        <div className="rounded-lg border border-border/40 bg-secondary/30 dark:bg-background/40 p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Equity curve · drawdown shadow
            </div>
            <LineChart className="h-3 w-3 text-muted-foreground" />
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={result.series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="bt-eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(49,158,255)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="rgb(49,158,255)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bt-dd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(248,113,113)" stopOpacity={0} />
                    <stop offset="100%" stopColor="rgb(248,113,113)" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                <XAxis
                  dataKey="date"
                  hide
                />
                <YAxis
                  yAxisId="eq"
                  domain={["auto", "auto"]}
                  tick={{ fill: "currentColor", fillOpacity: 0.55, fontSize: 10 }}
                  width={48}
                />
                <YAxis
                  yAxisId="dd"
                  orientation="right"
                  domain={[-1, 0]}
                  hide
                />
                <Tooltip
                  contentStyle={{
                    background: "rgba(10,15,28,0.95)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(v) => v as string}
                  formatter={(v: number, name: string) => {
                    if (name === "equity") return [`${((v - 1) * 100).toFixed(2)}%`, "Return"];
                    if (name === "drawdown") return [`${(v * 100).toFixed(2)}%`, "Drawdown"];
                    return [v, name];
                  }}
                />
                <Area
                  yAxisId="dd"
                  type="monotone"
                  dataKey="drawdown"
                  stroke="rgba(248,113,113,0.35)"
                  fill="url(#bt-dd)"
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="eq"
                  type="monotone"
                  dataKey="equity"
                  stroke="rgb(49,158,255)"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
