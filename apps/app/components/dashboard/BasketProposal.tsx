"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@mosaic/ui/card";
import { Badge } from "@mosaic/ui/badge";
import { Progress } from "@mosaic/ui/progress";
import { formatPct, formatUSD } from "@mosaic/core/utils";
import { InfoHint } from "@mosaic/ui/info-hint";
import { MosaicTiles } from "@/components/dashboard/MosaicTiles";
import { assetColor, seriesColors, useChartColors } from "@mosaic/ui/chartColors";
import type { Basket } from "@mosaic/core/types";
import { TrendingUp, AlertTriangle, ShieldCheck } from "lucide-react";
import { ExplainBasket } from "./ExplainBasket";

interface Props {
  basket: Basket;
}

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
            <ShieldCheck className="h-4 w-4 text-primary" />
            Proposed basket
          </CardTitle>
          <p className="mt-1 text-xs text-on-surface-variant">
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
        <p className="text-sm leading-relaxed text-on-surface-variant">{basket.reasoning}</p>

        {/* Stacked weight bar */}
        <div>
          <div className="brand-label">
            Weights
          </div>
          <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full ring-1 ring-outline-variant/60">
            {basket.constituents.map((c) => (
              <div
                key={c.symbol}
                style={{ width: `${c.weight * 100}%`, background: assetColor(c.symbol, dotPalette) }}
                title={`${c.symbol}: ${(c.weight * 100).toFixed(1)}%`}
              />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {basket.constituents.map((c) => (
              <div key={c.symbol} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: assetColor(c.symbol, dotPalette) }}
                />
                <span className="font-medium">{c.symbol}</span>
                <span className="font-mono text-on-surface-variant">
                  {(c.weight * 100).toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        <MosaicTiles basket={basket} />

        {/* Per-constituent rationale — revealed one-by-one */}
        <div className="space-y-2">
          {basket.constituents.map((c, i) => (
            <div
              key={c.symbol}
              className="tile-in rounded-md border border-outline-variant bg-surface-container p-3"
              style={{ "--tile-i": i } as React.CSSProperties}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                      style={{ background: assetColor(c.symbol, dotPalette) }}
                    />
                    <span className="font-semibold">{c.symbol}</span>
                    <span className="truncate text-xs text-on-surface-variant">{c.name}</span>
                  </div>
                  <p className="mt-1 text-xs text-on-surface-variant">{c.rationale}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="font-mono text-sm">{(c.weight * 100).toFixed(1)}%</div>
                  <div className="text-[10px] text-on-surface-variant">
                    {c.metrics.momentum30d !== undefined && (
                      <span
                        className={
                          c.metrics.momentum30d >= 0 ? "text-success " : "text-error "
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
                    <div className="text-on-surface-variant">Sentiment</div>
                    <Progress
                      value={(c.metrics.sentiment + 1) * 50}
                      barClassName={
                        c.metrics.sentiment >= 0 ? "bg-success" : "bg-error"
                      }
                    />
                  </div>
                )}
                {c.metrics.liquidityScore !== undefined && (
                  <div>
                    <div className="text-on-surface-variant">Liquidity</div>
                    <Progress value={c.metrics.liquidityScore * 100} />
                  </div>
                )}
                {c.metrics.volatility !== undefined && (
                  <div>
                    <div className="text-on-surface-variant">Volatility</div>
                    <Progress
                      value={Math.min(100, c.metrics.volatility * 80)}
                      barClassName="bg-warning"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-outline-variant bg-surface-container p-3 text-xs">
          <div>
            <div className="flex items-center gap-1 text-on-surface-variant">
              Expected annualized vol
              <InfoHint label="Expected annualized vol" text="How much this basket's value is expected to swing over a year. Lower means a steadier portfolio." />
            </div>
            <div className="font-mono text-base">
              {(basket.expectedAnnualVol * 100).toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-on-surface-variant">
              Concentration cap
              <InfoHint label="Concentration cap" text="The largest single-token weight. The agent caps this so no one coin can dominate the basket's risk." />
            </div>
            <div className="font-mono text-base">
              {Math.max(...basket.constituents.map((c) => c.weight * 100)).toFixed(0)}%
            </div>
          </div>
          <div>
            <div className="flex items-center gap-1 text-on-surface-variant">
              Notional
              <InfoHint label="Notional" text="The total USDC this basket would deploy across all legs when executed on SoDEX." />
            </div>
            <div className="font-mono text-base">{formatUSD(basket.thesis.amountUsd)}</div>
          </div>
        </div>

        <ExplainBasket basket={basket} executionNotionalUsd={basket.thesis.amountUsd} />
      </CardContent>
    </Card>
  );
}
