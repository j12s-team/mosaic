"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@mosaic/ui/card";
import { Badge } from "@mosaic/ui/badge";
import { Button } from "@mosaic/ui/button";
import { formatPct, formatUSD } from "@mosaic/core/utils";
import { InfoHint } from "@mosaic/ui/info-hint";
import { Skeleton } from "@mosaic/ui/skeleton";
import { getSession, shortAddress } from "@mosaic/core/wallet";
import type { PortfolioSnapshot, RebalanceProposal } from "@mosaic/core/types";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  AlertCircle,
  ArrowUpRight,
  CheckCheck,
  Newspaper,
  RefreshCw,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { useChartColors, tooltipStyle } from "@mosaic/ui/chartColors";

const ICONS = {
  news: Newspaper,
  flow: ArrowUpRight,
  drift: Activity,
  metric: Sparkles,
} as const;

interface LivePortfolio extends PortfolioSnapshot {
  source?: "live" | "mock";
  walletAddress?: string;
}

export function Portfolio() {
  const cc = useChartColors();
  const [data, setData] = useState<LivePortfolio | null>(null);
  const [resolved, setResolved] = useState<Record<string, "approved" | "dismissed">>({});
  const [refreshing, setRefreshing] = useState(false);
  const [errored, setErrored] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      const addr = getSession()?.address;
      const url = addr ? `/api/portfolio?address=${encodeURIComponent(addr)}` : "/api/portfolio";
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setErrored(false);
    } catch {
      setErrored(true);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // Re-fetch every 30s so balances stay reasonably fresh.
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  if (!data) {
    if (errored) {
      return (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center text-sm text-on-surface-variant">
            <span>Couldn&apos;t load your portfolio just now.</span>
            <Button size="sm" variant="secondary" onClick={load} disabled={refreshing}>
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  const proposals = data.pendingProposals.filter((p) => !resolved[p.id]);
  const isLive = data.source === "live";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              {isLive ? "Your SoDEX wallet" : "Live portfolio"}
              <Badge variant={isLive ? "success" : "outline"} className="text-[10px]">
                {isLive ? "live · testnet" : "demo · mocks"}
              </Badge>
              <InfoHint
                label="live vs demo"
                text={
                  isLive
                    ? "Live: balances are read straight from your connected SoDEX testnet account and priced from /markets/tickers."
                    : "Demo: no wallet connected, so this shows a deterministic mock portfolio. Connect a wallet to see real SoDEX testnet balances."
                }
              />
            </CardTitle>
            <p className="mt-1 text-xs text-on-surface-variant italic">
              {isLive && data.walletAddress
                ? `Address ${shortAddress(data.walletAddress)} — values priced from /markets/tickers.`
                : `“${data.thesisPrompt}”`}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              <button
                onClick={load}
                disabled={refreshing}
                className="rounded-sm border border-outline-variant p-1 text-on-surface-variant transition hover:bg-surface-container hover:text-on-surface disabled:opacity-50"
                title="Refresh balances"
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
              </button>
              <div className="font-mono text-2xl font-semibold">
                {formatUSD(data.netValueUsd)}
              </div>
            </div>
            {!isLive && (
              <Badge
                variant={data.netPnlUsd >= 0 ? "success" : "danger"}
                className="mt-1"
              >
                {data.netPnlUsd >= 0 ? "+" : ""}
                {formatUSD(data.netPnlUsd)} ({formatPct(data.netPnlPct, { signed: true })})
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isLive && (
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.history}>
                  <defs>
                    <linearGradient id="pv" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={cc.primary} stopOpacity={0.45} />
                      <stop offset="100%" stopColor={cc.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={cc.primary}
                    strokeWidth={2}
                    fill="url(#pv)"
                  />
                  <XAxis dataKey="t" hide />
                  <YAxis hide domain={["dataMin - 30", "dataMax + 30"]} />
                  <Tooltip
                    contentStyle={tooltipStyle(cc)}
                    labelFormatter={(v) => new Date(v).toLocaleDateString()}
                    formatter={(v: number) => [formatUSD(v), "Net value"]}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {data.positions.length === 0 ? (
            <div className="rounded-md border border-warning/30 bg-warning/[0.04] p-4 text-xs text-warning">
              No balances detected on this SoDEX account. Visit the{" "}
              <a
                className="underline underline-offset-4"
                href="https://testnet.sodex.com/faucet"
                target="_blank"
                rel="noopener noreferrer"
              >
                testnet faucet
              </a>{" "}
              to claim USDC, then refresh.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border border-outline-variant">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container brand-label">
                  <tr>
                    <th className="px-3 py-2">Asset</th>
                    <th className="px-3 py-2 text-right">Weight</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Mkt value</th>
                    {!isLive && <th className="px-3 py-2 text-right">PnL</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/60">
                  {data.positions.map((p) => (
                    <tr key={p.symbol}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{p.symbol}</div>
                        <div className="text-[10px] text-on-surface-variant">{p.name}</div>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {(p.weight * 100).toFixed(1)}%
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {p.qty.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatUSD(p.marketValueUsd)}
                      </td>
                      {!isLive && (
                        <td
                          className={`px-3 py-2 text-right font-mono ${
                            p.pnlUsd >= 0 ? "text-success " : "text-error "
                          }`}
                        >
                          {p.pnlUsd >= 0 ? "+" : ""}
                          {formatUSD(p.pnlUsd)} · {formatPct(p.pnlPct, { signed: true })}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {isLive && (
            <div className="text-[11px] text-on-surface-variant">
              PnL tracking lights up once you execute a Mosaic basket — Mosaic records the
              entry fills locally so the realised-return chart in <em>My baskets</em> below
              fills in over time.
            </div>
          )}
        </CardContent>
      </Card>

      {proposals.length > 0 && (
        <Card className="border-warning/20 bg-warning/[0.04]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" />
              Rebalance proposed by Mosaic
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {proposals.map((p) => (
              <ProposalCard
                key={p.id}
                proposal={p}
                onApprove={() => setResolved({ ...resolved, [p.id]: "approved" })}
                onDismiss={() => setResolved({ ...resolved, [p.id]: "dismissed" })}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProposalCard({
  proposal,
  onApprove,
  onDismiss,
}: {
  proposal: RebalanceProposal;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="rebalance-pulse rounded-md border border-outline-variant bg-surface-container p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant="warning" className="text-[10px]">
            Trigger: {proposal.trigger}
          </Badge>
          <h4 className="mt-2 font-medium leading-snug">{proposal.summary}</h4>
          <p className="mt-2 text-xs text-on-surface-variant">{proposal.detail}</p>
        </div>
        <span className="whitespace-nowrap font-mono text-[10px] text-on-surface-variant">
          {new Date(proposal.generatedAt).toLocaleTimeString()}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {proposal.changes.map((c) => (
          <div
            key={c.symbol}
            className="rounded-md border border-outline-variant bg-surface-container-low dark:bg-surface-container-low p-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{c.symbol}</span>
              <span className="font-mono text-xs">
                {(c.fromWeight * 100).toFixed(1)}%
                <span className="mx-1 text-on-surface-variant">→</span>
                <span
                  className={
                    c.toWeight > c.fromWeight ? "text-success " : "text-error "
                  }
                >
                  {(c.toWeight * 100).toFixed(1)}%
                </span>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-on-surface-variant">{c.reason}</p>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="brand-label">
          Citations from SoSoValue
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {proposal.citations.map((c, i) => {
            const Icon = ICONS[c.kind] ?? Sparkles;
            return (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-sm border border-outline-variant bg-surface-container px-2 py-1 text-[11px]"
              >
                <Icon className="h-3 w-3 text-primary" />
                <span>{c.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Button size="sm" variant="secondary" onClick={onDismiss}>
          <X className="h-3.5 w-3.5" />
          Dismiss
        </Button>
        <Button size="sm" onClick={onApprove}>
          <CheckCheck className="h-3.5 w-3.5" />
          Approve &amp; route to SoDEX
        </Button>
      </div>
    </div>
  );
}
