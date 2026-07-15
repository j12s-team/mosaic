"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ShieldCheck, ShieldAlert, Copy, ArrowRight, Hexagon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@mosaic/ui/card";
import { MosaicTiles } from "@/components/dashboard/MosaicTiles";
import { Badge } from "@mosaic/ui/badge";
import { Button } from "@mosaic/ui/button";
import { Input } from "@mosaic/ui/input";
import { useChartColors, tooltipStyle } from "@mosaic/ui/chartColors";
import type { SavedBasket, BasketSnapshot } from "@mosaic/core/storage";

interface Verdict {
  ok: boolean;
  count: number;
  headHash: string | null;
  signed: boolean;
  firstBreak?: { index: number; takenAt: string; reason: string };
}

export default function PublicBasketClient({
  slug,
  record,
  snapshots,
  mirroredFrom,
}: {
  slug: string;
  record: SavedBasket;
  snapshots: BasketSnapshot[];
  mirroredFrom: string | null;
}) {
  const cc = useChartColors();
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [notional, setNotional] = useState("1000");

  useEffect(() => {
    fetch(`/api/verify/${encodeURIComponent(record.basket.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setVerdict)
      .catch(() => setVerdict(null));
  }, [record.basket.id]);

  const series = useMemo(
    () =>
      snapshots.map((s) => ({
        t: s.takenAt.slice(0, 10),
        v: s.marketValueUsd,
        pct: +(s.pnlPct * 100).toFixed(2),
      })),
    [snapshots],
  );

  const latest = snapshots[snapshots.length - 1];
  const realisedPct = latest ? +(latest.pnlPct * 100).toFixed(2) : 0;
  const daysTracked = snapshots.length
    ? Math.max(
        1,
        Math.round(
          (new Date(snapshots[snapshots.length - 1].takenAt).getTime() -
            new Date(snapshots[0].takenAt).getTime()) /
            86400_000,
        ),
      )
    : 0;

  const mirrorHref = `/app?mirror=${encodeURIComponent(slug)}&notional=${
    Number(notional.replace(/[^0-9.]/g, "")) || 1000
  }`;

  return (
    <main className="mx-auto max-w-content px-4 pt-8 pb-24 sm:px-6">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary-container">
            <Hexagon className="h-4 w-4 text-primary" />
          </span>
          Mosaic
        </Link>
        <Link href="/">
          <Button variant="text" size="sm">
            Open the agent <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-headline-md text-on-background">
            {record.label ?? "Public basket"}
          </h1>
          <Badge variant="brand">public</Badge>
          {mirroredFrom && <Badge>mirrored</Badge>}
          {verdict &&
            (verdict.ok ? (
              <Badge variant="success" title={verdict.headHash ?? undefined}>
                <ShieldCheck className="h-3 w-3" />
                track record verified · {verdict.count} snapshots
              </Badge>
            ) : (
              <Badge variant="danger">
                <ShieldAlert className="h-3 w-3" />
                chain broken: {verdict.firstBreak?.reason}
              </Badge>
            ))}
        </div>
        <p className="mt-2 max-w-2xl text-body-md text-on-surface-variant">
          “{record.basket.thesis.prompt}”
        </p>
        <p className="mt-1 text-label-md text-on-surface-variant">
          Every point below was recorded server-side and hash-chained — Mosaic cannot silently
          rewrite this history.{" "}
          <a
            className="text-primary underline-offset-4 hover:underline"
            href={`/api/verify/${encodeURIComponent(record.basket.id)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Verify the chain yourself →
          </a>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Realised track record</CardTitle>
              <CardDescription>
                {daysTracked} days tracked · realised{" "}
                <span className={realisedPct >= 0 ? "text-success" : "text-error"}>
                  {realisedPct >= 0 ? "+" : ""}
                  {realisedPct}%
                </span>{" "}
                on ${record.execution.notionalUsd.toLocaleString()} initial
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series}>
                    <defs>
                      <linearGradient id="pb-eq" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={cc.primary} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={cc.primary} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="t"
                      tick={{ fill: "currentColor", fillOpacity: 0.55, fontSize: 10 }}
                    />
                    <YAxis
                      domain={["auto", "auto"]}
                      tick={{ fill: "currentColor", fillOpacity: 0.55, fontSize: 10 }}
                      width={56}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle(cc)}
                      formatter={(v: number, name: string) =>
                        name === "v" ? [`$${v.toLocaleString()}`, "Value"] : [v, name]
                      }
                    />
                    <Area
                      type="monotone"
                      dataKey="v"
                      stroke={cc.primary}
                      strokeWidth={2}
                      fill="url(#pb-eq)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
              <CardDescription>{record.basket.constituents.length} constituents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <MosaicTiles basket={record.basket} />
              {record.basket.constituents.map((c) => (
                <div
                  key={c.symbol}
                  className="flex items-center justify-between gap-3 rounded-sm border border-outline-variant bg-surface-container px-3 py-2"
                >
                  <div className="min-w-0">
                    <span className="font-mono text-label-lg text-on-surface">{c.symbol}</span>
                    <span className="ml-2 text-label-md text-on-surface-variant">{c.name}</span>
                    <p className="mt-0.5 truncate text-label-md text-on-surface-variant">
                      {c.rationale}
                    </p>
                  </div>
                  <span className="font-mono text-title-md text-on-surface">
                    {(c.weight * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rebalance history</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-body-md text-on-surface-variant">
                No rebalances recorded yet — proposals executed against this basket will appear
                here with their citations.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-8 lg:self-start">
          <Card variant="filled">
            <CardHeader>
              <CardTitle>Mirror this basket</CardTitle>
              <CardDescription>
                Copy these exact weights, scaled to your amount, into your own Mosaic account —
                you review the full analysis and confirm before anything executes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <label className="block text-label-md text-on-surface-variant" htmlFor="notional">
                Amount (USDC)
              </label>
              <Input
                id="notional"
                inputMode="decimal"
                value={notional}
                onChange={(e) => setNotional(e.target.value)}
              />
              <Link href={mirrorHref} className="block">
                <Button className="w-full">
                  <Copy className="h-4 w-4" />
                  Mirror with ${(Number(notional.replace(/[^0-9.]/g, "")) || 1000).toLocaleString()}
                </Button>
              </Link>
              <p className="text-label-md text-on-surface-variant">
                Mirroring creates a new basket owned by you. Nothing is shared back to the
                original owner.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About this record</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-body-md text-on-surface-variant">
              <p>
                Started {new Date(record.execution.executedAt).toLocaleDateString()} with $
                {record.execution.notionalUsd.toLocaleString()}.
              </p>
              <p>
                Snapshots are valued daily by Mosaic&apos;s server from live prices, signed, and
                linked into a hash chain. {verdict?.signed ? "Signatures active." : ""}
              </p>
              {record.basket.benchmark && (
                <p>Benchmark: {record.basket.benchmark.name} ({record.basket.benchmark.symbol}).</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
