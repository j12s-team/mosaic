"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatPct, formatUSD } from "@/lib/utils";
import { getSession, shortAddress } from "@/lib/wallet";
import type { PortfolioSnapshot, RebalanceProposal } from "@/lib/types";
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
  const [data, setData] = useState<LivePortfolio | null>(null);
  const [resolved, setResolved] = useState<Record<string, "approved" | "dismissed">>({});
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    setRefreshing(true);
    try {
      const addr = getSession()?.address;
      const url = addr ? `/api/portfolio?address=${encodeURIComponent(addr)}` : "/api/portfolio";
      const res = await fetch(url, { cache: "no-store" });
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
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
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          Loading portfolio…
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
              <Wallet className="h-4 w-4 text-brand-600 dark:text-brand-300" />
              {isLive ? "Your SoDEX wallet" : "Live portfolio"}
              <Badge variant={isLive ? "success" : "outline"} className="text-[10px]">
                {isLive ? "live · testnet" : "demo · mocks"}
              </Badge>
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground italic">
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
                className="rounded-md border border-border/40 p-1 text-muted-foreground transition hover:bg-secondary/40 hover:text-foreground disabled:opacity-50"
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
                      <stop offset="0%" stopColor="rgb(49,158,255)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="rgb(49,158,255)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke="rgb(49,158,255)"
                    strokeWidth={2}
                    fill="url(#pv)"
                  />
                  <XAxis dataKey="t" hide />
                  <YAxis hide domain={["dataMin - 30", "dataMax + 30"]} />
                  <Tooltip
                    contentStyle={{
                      background: "rgba(10,15,28,0.9)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelFormatter={(v) => new Date(v).toLocaleDateString()}
                    formatter={(v: number) => [formatUSD(v), "Net value"]}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {data.positions.length === 0 ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-4 text-xs text-amber-700 dark:text-amber-200">
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
            <div className="overflow-hidden rounded-lg border border-border/40">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.03] text-[10px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Asset</th>
                    <th className="px-3 py-2 text-right">Weight</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Mkt value</th>
                    {!isLive && <th className="px-3 py-2 text-right">PnL</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.positions.map((p) => (
                    <tr key={p.symbol}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{p.symbol}</div>
                        <div className="text-[10px] text-muted-foreground">{p.name}</div>
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
                            p.pnlUsd >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
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
            <div className="text-[11px] text-muted-foreground">
              PnL tracking lights up once you execute a Mosaic basket — Wave 2 records the
              entry fills locally so the realised-return chart in <em>My baskets</em> below
              fills in over time.
            </div>
          )}
        </CardContent>
      </Card>

      {proposals.length > 0 && (
        <Card className="border-amber-500/20 bg-amber-500/[0.04]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
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
    <div className="rounded-xl border border-border/40 bg-secondary/30 dark:bg-background/40 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Badge variant="warning" className="text-[10px]">
            Trigger: {proposal.trigger}
          </Badge>
          <h4 className="mt-2 font-medium leading-snug">{proposal.summary}</h4>
          <p className="mt-2 text-xs text-muted-foreground">{proposal.detail}</p>
        </div>
        <span className="whitespace-nowrap font-mono text-[10px] text-muted-foreground">
          {new Date(proposal.generatedAt).toLocaleTimeString()}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {proposal.changes.map((c) => (
          <div
            key={c.symbol}
            className="rounded-lg border border-border/40 bg-card/80 dark:bg-card/40 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{c.symbol}</span>
              <span className="font-mono text-xs">
                {(c.fromWeight * 100).toFixed(1)}%
                <span className="mx-1 text-muted-foreground">→</span>
                <span
                  className={
                    c.toWeight > c.fromWeight ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
                  }
                >
                  {(c.toWeight * 100).toFixed(1)}%
                </span>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{c.reason}</p>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Citations from SoSoValue
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {proposal.citations.map((c, i) => {
            const Icon = ICONS[c.kind] ?? Sparkles;
            return (
              <div
                key={i}
                className="flex items-center gap-1.5 rounded-md border border-border/40 bg-secondary/30 dark:bg-background/40 px-2 py-1 text-[11px]"
              >
                <Icon className="h-3 w-3 text-brand-600 dark:text-brand-300" />
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
