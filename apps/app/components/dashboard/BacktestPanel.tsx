"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@mosaic/ui/card";
import { Badge } from "@mosaic/ui/badge";
import { formatPct } from "@mosaic/core/utils";
import { InfoHint } from "@mosaic/ui/info-hint";
import type { BacktestResult } from "@mosaic/core/backtest";
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
import { useChartColors, tooltipStyle } from "@mosaic/ui/chartColors";

interface Props {
  result: BacktestResult;
}

function Stat({
  label,
  value,
  tone,
  hint,
  info,
}: {
  label: string;
  value: string;
  tone?: "pos" | "neg" | "neutral";
  hint?: string;
  info?: string;
}) {
  const color =
    tone === "pos" ? "text-success " : tone === "neg" ? "text-error " : "text-on-surface";
  return (
    <div className="rounded-md border border-outline-variant bg-surface-container p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-on-surface-variant">
        {label}
        {info && <InfoHint label={label} text={info} />}
      </div>
      <div className={`mt-1 font-mono text-lg font-semibold ${color}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[10px] text-on-surface-variant">{hint}</div>}
    </div>
  );
}

export function BacktestPanel({ result }: Props) {
  const cc = useChartColors();
  const beats = result.excessReturnPct > 0;
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            90-day backtest
          </CardTitle>
          <p className="mt-1 text-xs text-on-surface-variant">
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
            info="What this basket would have returned over the last 90 days, rebalanced daily, vs the MAG7.ssi benchmark."
          />
          <Stat
            label="Sharpe"
            value={result.sharpe.toFixed(2)}
            tone={result.sharpe >= 1 ? "pos" : result.sharpe < 0 ? "neg" : "neutral"}
            hint="annualized, rf=4%"
            info="Return earned per unit of total risk. Above 1 is good; higher means a smoother ride for the same gain."
          />
          <Stat
            label="Max drawdown"
            value={formatPct(result.maxDrawdownPct / 100)}
            tone="neg"
            hint={result.maxDrawdownDate}
            info="The worst peak-to-trough drop over the window — the deepest paper loss you'd have had to sit through."
          />
          <Stat
            label="Sortino"
            value={result.sortino.toFixed(2)}
            tone={result.sortino >= 1 ? "pos" : "neutral"}
            hint="downside-only vol"
            info="Like Sharpe, but only penalizes downside moves — it ignores 'good' volatility from upside swings."
          />
          <Stat
            label="Annualized return"
            value={formatPct(result.annualizedReturnPct / 100, { signed: true })}
            tone={result.annualizedReturnPct >= 0 ? "pos" : "neg"}
            info="The 90-day result scaled to a yearly rate so it's comparable across time horizons."
          />
          <Stat
            label="Annualized vol"
            value={formatPct(result.annualizedVolPct / 100)}
            tone="neutral"
            info="How much the basket's value swings, expressed as a yearly figure. Higher = bumpier."
          />
          <Stat
            label="Beta vs bench"
            value={result.beta.toFixed(2)}
            tone="neutral"
            info="Sensitivity to the MAG7.ssi benchmark. 1.0 moves in step; above 1 amplifies, below 1 dampens."
          />
          <Stat
            label="Win-rate (daily)"
            value={`${result.winRatePct.toFixed(1)}%`}
            tone="neutral"
            info="Share of days the basket finished up. A coin-flip is 50%."
          />
        </div>

        <div className="rounded-md border border-outline-variant bg-surface-container p-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-wider text-on-surface-variant">
              Equity curve · drawdown shadow
            </div>
            <LineChart className="h-3 w-3 text-on-surface-variant" />
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={result.series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="bt-eq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={cc.primary} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={cc.primary} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bt-dd" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={cc.error} stopOpacity={0} />
                    <stop offset="100%" stopColor={cc.error} stopOpacity={0.35} />
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
                  contentStyle={tooltipStyle(cc)}
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
                  stroke={cc.error} strokeOpacity={0.35}
                  fill="url(#bt-dd)"
                  isAnimationActive={false}
                />
                <Line
                  yAxisId="eq"
                  type="monotone"
                  dataKey="equity"
                  stroke={cc.primary}
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
