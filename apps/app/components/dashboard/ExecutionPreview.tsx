"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@mosaic/ui/card";
import { Badge } from "@mosaic/ui/badge";
import { Button } from "@mosaic/ui/button";
import { formatUSD } from "@mosaic/core/utils";
import { InfoHint } from "@mosaic/ui/info-hint";
import type { Basket, ExecutionPlan } from "@mosaic/core/types";
import { ArrowDown, AlertTriangle, CheckCircle2, ChevronRight, Loader2, Lock, Zap } from "lucide-react";
import { getSession } from "@mosaic/core/wallet";
import { HOUSE_OWNER, saveBasketEverywhere, appendSnapshot } from "@mosaic/core/storage";
import type { Mandate } from "@mosaic/core/mandate";

interface ReceiptFill {
  orderId: string;
  status: string;
  market: string;
  side: string;
  filledNotionalUsd: number;
  avgPrice: number;
  estPrice?: number;
  estSlippageBps?: number;
  realisedSlippageBps?: number;
  simulated: boolean;
  dryRun?: boolean;
}

const IS_MAINNET = process.env.NEXT_PUBLIC_MOSAIC_NETWORK === "mainnet";

interface Props {
  plan: ExecutionPlan;
  basket: Basket;
  onExecuted?: () => void;
}

export function ExecutionPreview({ plan, basket, onExecuted }: Props) {
  const [stage, setStage] = useState<"review" | "confirm" | "executing" | "done">("review");
  const [failed, setFailed] = useState(false);
  const [gateReasons, setGateReasons] = useState<string[]>([]);
  const [receipt, setReceipt] = useState<ReceiptFill[]>([]);
  const [mandate, setMandate] = useState<Mandate | null>(null);
  const [mandateChecked, setMandateChecked] = useState(!IS_MAINNET);

  // On mainnet, execution requires a signed mandate covering this basket —
  // look one up for the connected wallet. Re-run the lookup whenever the
  // Mandates panel signs/revokes one (mosaic:mandates-changed), so the
  // execute button unlocks the moment a covering mandate exists instead of
  // waiting for a full page reload.
  useEffect(() => {
    if (!IS_MAINNET) return;
    const lookup = () => {
      const addr = getSession()?.address;
      if (!addr) {
        setMandateChecked(true);
        return;
      }
      fetch(`/api/mandate?wallet=${addr}`)
        .then((r) => r.json())
        .then((d) => {
          const now = Date.now() / 1000;
          const m = (d.mandates ?? []).find(
            (x: Mandate) => x.basketId === basket.id && x.status === "active" && x.expiry > now,
          );
          setMandate(m ?? null);
        })
        .catch(() => setMandate(null))
        .finally(() => setMandateChecked(true));
    };
    lookup();
    window.addEventListener("mosaic:mandates-changed", lookup);
    return () => window.removeEventListener("mosaic:mandates-changed", lookup);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basket.id]);

  async function onExecute() {
    setStage("executing");
    setFailed(false);
    setGateReasons([]);
    let res: Response;
    try {
      res = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          basketId: plan.basketId,
          confirm: true,
          mandateId: mandate?.id,
          wallet: getSession()?.address,
          legs: plan.legs.map((l) => ({
            market: l.market,
            side: l.side,
            notionalUsd: l.notionalUsd,
            maxSlippageBps: 50,
            estSlippageBps: l.estSlippageBps,
          })),
        }),
      });
    } catch {
      setFailed(true);
      setStage("review");
      return;
    }
    if (!res.ok) {
      try {
        const body = await res.json();
        if (Array.isArray(body.reasons)) {
          setGateReasons(body.reasons.map((r: { rule: string; detail: string }) => `${r.rule}: ${r.detail}`));
        } else if (body.error) {
          setGateReasons([body.error]);
        }
      } catch {
        /* generic failure */
      }
      setFailed(true);
      setStage("review");
      return;
    }
    try {
      const body = await res.json();
      setReceipt(Array.isArray(body.fills) ? body.fills : []);
    } catch {
      setReceipt([]);
    }

    // Persist the basket so the "thesis vs realised" loop can begin.
    // Writes to the local cache and — when DATABASE_URL is configured —
    // to Postgres, where the server records a chained t=0 snapshot.
    const owner = getSession()?.address ?? HOUSE_OWNER;
    await saveBasketEverywhere(owner, {
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
            <Zap className="h-4 w-4 text-primary" />
            SoDEX execution plan
          </CardTitle>
          <p className="mt-1 text-xs text-on-surface-variant">
            Multi-leg, IOC limits, slippage capped at 50bps per leg.
          </p>
        </div>
        <Badge variant="brand">{plan.venue}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-outline-variant bg-surface-container p-3">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-on-surface-variant">
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

        <div className="overflow-hidden rounded-md border border-outline-variant">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-container text-[10px] uppercase tracking-wider text-on-surface-variant">
              <tr>
                <th className="px-3 py-2">Market</th>
                <th className="px-3 py-2">Side</th>
                <th className="px-3 py-2 text-right">Notional</th>
                <th className="px-3 py-2 text-right">Est. price</th>
                <th className="px-3 py-2 text-right">Slip</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60">
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
              <div className="rounded-md border border-error/30 bg-error/5 p-3 text-xs text-error">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  Execution didn&apos;t go through. No orders were placed.
                </div>
                {gateReasons.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-5">
                    {gateReasons.map((r) => (
                      <li key={r} className="list-disc">{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {IS_MAINNET && mandateChecked && !mandate && (
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning-container/40 p-3 text-xs text-on-surface">
                <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-warning" />
                <span>
                  Mainnet execution needs a signed <span className="font-medium">investment
                  mandate</span> for this basket — sign one in the Mandates panel first. The
                  mandate caps notional, tokens, and slippage, and you can revoke it anytime.
                </span>
              </div>
            )}
            <Button
              className="w-full"
              onClick={() => setStage("confirm")}
              disabled={IS_MAINNET && !mandate}
            >
              Review &amp; confirm <ChevronRight className="h-4 w-4" />
            </Button>
          </>
        )}

        {stage === "confirm" && (
          <div className="rounded-md border border-warning/20 bg-warning/5 p-4">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 flex-shrink-0 text-warning" />
              <div className="space-y-2 text-sm">
                <p className="font-medium">
                  This will place {plan.legs.length} live orders on SoDEX (
                  {process.env.NEXT_PUBLIC_NETWORK ?? "testnet"}).
                </p>
                <p className="text-xs text-on-surface-variant">
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
          <div className="flex items-center gap-3 rounded-md border border-outline-variant bg-surface-container p-4 text-sm">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            Routing {plan.legs.length} legs through SoDEX…
          </div>
        )}

        {stage === "done" && (
          <div className="space-y-3 rounded-md border border-success/20 bg-success/5 p-4 text-sm">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-success" />
              <div className="space-y-1">
                <p className="font-medium">
                  Basket executed · {plan.legs.length} legs routed to SoDEX{" "}
                  {process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "mainnet" : "testnet"}.
                </p>
                <p className="text-xs text-on-surface-variant">
                  Mosaic recorded the {formatUSD(plan.totalNotionalUsd)} entry locally and is now
                  snapshotting realised PnL. The basket card just opened below — expand it to see
                  every fill price and weight, plus the thesis-vs-realised curve as it fills in.
                </p>
              </div>
            </div>
            {receipt.length > 0 && (
              <div className="overflow-hidden rounded-md border border-outline-variant">
                <div className="border-b border-outline-variant bg-surface-container px-3 py-2 text-[10px] uppercase tracking-wider text-on-surface-variant">
                  Execution receipt · predicted vs realised
                </div>
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-container text-[10px] uppercase tracking-wider text-on-surface-variant">
                    <tr>
                      <th className="px-3 py-2">Market</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Filled</th>
                      <th className="px-3 py-2 text-right">Est slip</th>
                      <th className="px-3 py-2 text-right">Realised</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/60">
                    {receipt.map((f) => (
                      <tr key={f.orderId}>
                        <td className="px-3 py-2 font-medium">{f.market}</td>
                        <td className="px-3 py-2">
                          <Badge
                            variant={
                              f.status === "FILLED" ? "success"
                              : f.status === "PARTIAL" ? "warning"
                              : f.status === "REJECTED" ? "danger"
                              : "outline"
                            }
                            className="text-[10px]"
                          >
                            {f.status.toLowerCase()}
                          </Badge>
                        </td>
                        <td className="px-3 py-2 text-right font-mono">{formatUSD(f.filledNotionalUsd)}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {f.estSlippageBps != null ? `${f.estSlippageBps} bps` : "—"}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {f.realisedSlippageBps != null ? `${f.realisedSlippageBps} bps` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {receipt.some((f) => f.simulated) && (
                  <div className="border-t border-outline-variant px-3 py-2 text-[10px] text-on-surface-variant">
                    Simulated fills — arm MOSAIC_REAL_ORDERS with SoDEX credentials for live transport.
                  </div>
                )}
              </div>
            )}
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
