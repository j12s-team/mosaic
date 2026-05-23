"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatPct, formatUSD } from "@/lib/utils";
import type { Basket } from "@/lib/types";
import { TrendingUp, AlertTriangle, ShieldCheck } from "lucide-react";
import { ExplainBasket } from "./ExplainBasket";

interface Props {
  basket: Basket;
}

const COLORS = [
  "from-brand-300 to-brand-500",
  "from-violet-300 to-violet-500",
  "from-emerald-300 to-emerald-500",
  "from-amber-300 to-amber-500",
  "from-pink-300 to-pink-500",
  "from-cyan-300 to-cyan-500",
  "from-rose-300 to-rose-500",
  "from-lime-300 to-lime-500",
];

export function BasketProposal({ basket }: Props) {
  const riskBand =
    basket.riskScore < 30 ? "Low" : basket.riskScore < 60 ? "Moderate" : "High";
  const riskVariant =
    basket.riskScore < 30 ? "success" : basket.riskScore < 60 ? "warning" : "danger";

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-300" />
            Proposed basket
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {basket.constituents.length} constituents • created{" "}
            {new Date(basket.createdAt).toLocaleTimeString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {basket.benchmark && (
            <Badge variant="brand">
              vs {basket.benchmark.symbol}
            </Badge>
          )}
          <Badge variant={riskVariant as "success" | "warning" | "danger"}>
            <AlertTriangle className="h-3 w-3" />
            {riskBand} risk · {basket.riskScore}/100
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm leading-relaxed text-muted-foreground">{basket.reasoning}</p>

        {/* Stacked weight bar */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Weights
          </div>
          <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full ring-1 ring-white/5">
            {basket.constituents.map((c, i) => (
              <div
                key={c.symbol}
                className={`bg-gradient-to-r ${COLORS[i % COLORS.length]}`}
                style={{ width: `${c.weight * 100}%` }}
                title={`${c.symbol}: ${(c.weight * 100).toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {basket.constituents.map((c, i) => (
              <div key={c.symbol} className="flex items-center gap-2 text-xs">
                <span
                  className={`h-2.5 w-2.5 rounded-full bg-gradient-to-r ${
                    COLORS[i % COLORS.length]
                  }`}
                />
                <span className="font-medium">{c.symbol}</span>
                <span className="font-mono text-muted-foreground">
                  {(c.weight * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Per-constituent rationale */}
        <div className="space-y-2">
          {basket.constituents.map((c, i) => (
            <div
              key={c.symbol}
              className="rounded-lg border border-border/40 bg-secondary/30 dark:bg-background/40 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2.5 w-2.5 flex-shrink-0 rounded-full bg-gradient-to-r ${
                        COLORS[i % COLORS.length]
                      }`}
                    />
                    <span className="font-semibold">{c.symbol}</span>
                    <span className="truncate text-xs text-muted-foreground">{c.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.rationale}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="font-mono text-sm">{(c.weight * 100).toFixed(1)}%</div>
                  <div className="text-[10px] text-muted-foreground">
                    {c.metrics.momentum30d !== undefined && (
                      <span
                        className={
                          c.metrics.momentum30d >= 0 ? "text-emerald-500 dark:text-emerald-300" : "text-red-500 dark:text-red-300"
                        }
                      >
                        <TrendingUp className="mr-0.5 inline h-3 w-3" />
                        {formatPct(c.metrics.momentum30d, { signed: true })} 30d
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] uppercase tracking-wider">
                {c.metrics.sentiment !== undefined && (
                  <div>
                    <div className="text-muted-foreground">Sentiment</div>
                    <Progress
                      value={(c.metrics.sentiment + 1) * 50}
                      barClassName={
                        c.metrics.sentiment >= 0 ? "bg-emerald-400" : "bg-red-400"
                      }
                    />
                  </div>
                )}
                {c.metrics.liquidityScore !== undefined && (
                  <div>
                    <div className="text-muted-foreground">Liquidity</div>
                    <Progress value={c.metrics.liquidityScore * 100} />
                  </div>
                )}
                {c.metrics.volatility !== undefined && (
                  <div>
                    <div className="text-muted-foreground">Volatility</div>
                    <Progress
                      value={Math.min(100, c.metrics.volatility * 80)}
                      barClassName="bg-amber-400"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/40 bg-secondary/30 dark:bg-background/40 p-3 text-xs">
          <div>
            <div className="text-muted-foreground">Expected annualized vol</div>
            <div className="font-mono text-base">
              {(basket.expectedAnnualVol * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Concentration cap</div>
            <div className="font-mono text-base">
              {Math.max(...basket.constituents.map((c) => c.weight * 100)).toFixed(0)}%
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Notional</div>
            <div className="font-mono text-base">{formatUSD(basket.thesis.amountUsd)}</div>
          </div>
        </div>

        <ExplainBasket basket={basket} executionNotionalUsd={basket.thesis.amountUsd} />
      </CardContent>
    </Card>
  );
}
