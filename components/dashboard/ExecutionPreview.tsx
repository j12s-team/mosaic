"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatUSD } from "@/lib/utils";
import { InfoHint } from "@/components/ui/info-hint";
import type { Basket, ExecutionPlan } from "@/lib/types";
import { ArrowDown, AlertTriangle, CheckCircle2, ChevronRight, Loader2, Lock, Zap } from "lucide-react";
import { getSession } from "@/lib/wallet";
import { HOUSE_OWNER, saveBasket, appendSnapshot } from "@/lib/storage";

interface Props {
  plan: ExecutionPlan;
  basket: Basket;
  onExecuted?: () => void;
}

export function ExecutionPreview({ plan, basket, onExecuted }: Props) {
  const [stage, setStage] = useState<"review" | "confirm" | "executing" | "done">("review");
  const [failed, setFailed] = useState(false);

  async function onExecute() {
    setStage("executing");
    setFailed(false);
    let res: Response;
    try {
      res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basketId: plan.basketId,
          confirm: true,
          legs: plan.legs.map((l) => ({
            market: l.market,
            side: l.side,
            notionalUsd: l.notionalUsd,
            maxSlippageBps: 50,
          })),
        }),
      });
    } catch {
      setFailed(true);
      setStage("review");
      return;
    }
    if (!res.ok) {
      setFailed(true);
      setStage("review");
      return;
    }

    // Persist the basket so the "thesis vs realised" loop can begin.
    const owner = getSession()?.address ?? HOUSE_OWNER;
    saveBasket(owner, {
      basket,
      execution: {
        executedAt: new Date().toISOString(),
        notionalUsd: plan.totalNotionalUsd,
        fills: plan.legs.map((l) => ({
          symbol: l.market.split("/")[0],
          price: l.estPrice,
          weight: l.notionalUsd / plan.totalNotionalUsd,
        })),
      },
      savedAt: new Date().toISOString(),
      status: "active",
    });
    // Initial t=0 snapshot — realised return starts at 0%.
    appendSnapshot(owner, {
      basketId: basket.id,
      takenAt: new Date().toISOString(),
      marketValueUsd: plan.totalNotionalUsd,
      pnlUsd: 0,
      pnlPct: 0,
    });

    setStage("done");
    onExecuted?.();
    // Tell MyBaskets (and any other listener) that a new basket just landed
    // — it will refresh its list, expand the new card, and scroll it into
    // view so the user can actually see what was executed.
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("mosaic:basket-executed", {
          detail: { basketId: basket.id },
        }),
      );
    }
  }

  function jumpToBasket() {
    if (typeof window === "undefined") return;
    const el = document.getElementById(`basket-${basket.id}`) ?? document.getElementById("saved-baskets");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-brand-600 dark:text-brand-300" />
            SoDEX execution plan
          </CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Multi-leg, IOC limits, slippage capped at 50bps per leg.
          </p>
        </div>
        <Badge variant="brand">{plan.venue}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-border/40 bg-secondary/30 dark:bg-background/40 p-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            Estimated total slippage (size-weighted)
            <InfoHint
              label="Slippage"
              text="The expected gap between the quoted price and your real fill, walking SoDEX's orderbook. 100 bps = 1%. Lower is cheaper to enter."
            />
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold">
            {plan.estTotalSlippageBps} bps
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-border/40">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">Side</th>
                <th className="px-3 py-2 text-right">Notional</th>
                <th className="px-3 py-2 text-right">Est. price</th>
                <th className="px-3 py-2 text-right">Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {plan.legs.map((leg) => (
                <tr key={leg.market}>
                  <td className="px-3 py-2 font-medium">{leg.market}</td>
                  <td className="px-3 py-2 capitalize">
                    <Badge
                      variant={leg.side === "buy" ? "success" : "danger"}
                      className="text-[10px]"
                    >
                      {leg.side}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatUSD(leg.notionalUsd)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {leg.estPrice.toFixed(4)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {leg.estSlippageBps} bps
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {stage === "review" && (
          <>
            {failed && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-700 dark:text-red-300">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                Execution didn&apos;t go through. No orders were placed — please try again.
              </div>
            )}
            <Button className="w-full" onClick={() => setStage("confirm")}>
              Review &amp; confirm <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {stage === "confirm" && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700 dark:text-amber-300" />
              <div className="space-y-2 text-sm">
                <p className="font-medium">
                  This will place {plan.legs.length} live orders on SoDEX (
                  {process.env.NEXT_PUBLIC_NETWORK ?? "testnet"}).
                </p>
                <p className="text-xs text-muted-foreground">
                  Total notional <span className="font-mono">{formatUSD(plan.totalNotionalUsd)}</span>{" "}
                  · max slippage 50bps per leg · IOC limits, no market orders.
                </p>
                <div className="flex gap-2 pt-2">
                  <Button onClick={onExecute}>Confirm &amp; execute</Button>
                  <Button variant="secondary" onClick={() => setStage("review")}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {stage === "executing" && (
          <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-secondary/30 dark:bg-background/40 p-4 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-brand-600 dark:text-brand-300" />
            Routing {plan.legs.length} legs through SoDEX…
          </div>
        )}

        {stage === "done" && (
          <div className="space-y-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-700 dark:text-emerald-300" />
              <div className="space-y-1">
                <p className="font-medium">
                  Basket executed · {plan.legs.length} legs routed to SoDEX{" "}
                  {process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "mainnet" : "testnet"}.
                </p>
                <p className="text-xs text-muted-foreground">
                  Mosaic recorded the {formatUSD(plan.totalNotionalUsd)} entry locally and is now
                  snapshotting realised PnL. The basket card just opened below — expand it to see
                  every fill price and weight, plus the thesis-vs-realised curve as it fills in.
                </p>
              </div>
            </div>
            <Button size="sm" variant="secondary" onClick={jumpToBasket} className="w-full">
              <ArrowDown className="h-3.5 w-3.5" />
              Jump to my basket
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
