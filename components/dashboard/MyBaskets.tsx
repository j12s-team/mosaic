"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPct, formatUSD } from "@/lib/utils";
import { getSession } from "@/lib/wallet";
import {
  HOUSE_OWNER,
  listBaskets,
  predictedVsRealised,
  type SavedBasket,
} from "@/lib/storage";
import { seedHouseBasketsIfNeeded } from "@/lib/houseBaskets";
import { Bookmark, Sparkles } from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function MyBaskets() {
  const [owner, setOwner] = useState<string>(HOUSE_OWNER);
  const [baskets, setBaskets] = useState<SavedBasket[]>([]);

  useEffect(() => {
    // Seed the house namespace with 3 demo baskets + 7d snapshot history
    // so first-time judges see a realised-return curve immediately.
    seedHouseBasketsIfNeeded();
    const s = getSession();
    setOwner(s?.address ?? HOUSE_OWNER);
  }, []);

  useEffect(() => {
    setBaskets(listBaskets(owner));
  }, [owner]);

  if (baskets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bookmark className="h-4 w-4 text-brand-600 dark:text-brand-300" />
            Your saved baskets
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border/60 bg-secondary/30 dark:bg-background/40 p-8 text-center text-sm text-muted-foreground">
            <Sparkles className="mx-auto h-5 w-5 text-brand-600/60 dark:text-brand-300/60" />
            <p className="mt-2">
              No saved baskets yet. Build one above and hit{" "}
              <span className="font-medium text-foreground">Confirm &amp; execute</span> —
              we&apos;ll start snapshotting it for thesis-vs-realised tracking.
            </p>
            <p className="mt-2 text-[11px]">
              Owner: <span className="font-mono">{owner === HOUSE_OWNER ? "house (unconnected)" : owner.slice(0, 6) + "…" + owner.slice(-4)}</span>
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bookmark className="h-4 w-4 text-brand-600 dark:text-brand-300" />
          Your saved baskets ({baskets.length})
        </CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Thesis vs realised return tracked since the moment you executed.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {baskets.map((b) => {
          const pvr = predictedVsRealised(owner, b.basket.id);
          const realised = pvr?.realisedReturnPct ?? 0;
          return (
            <div key={b.basket.id} className="rounded-xl border border-border/40 bg-secondary/30 dark:bg-background/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={b.status === "active" ? "success" : "outline"}>
                      {b.status}
                    </Badge>
                    {b.basket.benchmark && (
                      <Badge variant="brand">vs {b.basket.benchmark.symbol}</Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {b.basket.constituents.length} legs · {pvr?.daysHeld ?? 0}d held
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-snug">&ldquo;{b.basket.thesis.prompt}&rdquo;</p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    Realised
                  </div>
                  <div
                    className={`font-mono text-lg font-semibold ${
                      realised >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
                    }`}
                  >
                    {formatPct(realised / 100, { signed: true })}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    on {formatUSD(b.execution.notionalUsd)}
                  </div>
                </div>
              </div>

              {pvr && pvr.realisedSeries.length > 1 && (
                <div className="mt-3 h-16">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={pvr.realisedSeries} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id={`rr-${b.basket.id}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={realised >= 0 ? "rgb(52,211,153)" : "rgb(248,113,113)"} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={realised >= 0 ? "rgb(52,211,153)" : "rgb(248,113,113)"} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area
                        type="monotone"
                        dataKey="realised"
                        stroke={realised >= 0 ? "rgb(52,211,153)" : "rgb(248,113,113)"}
                        strokeWidth={1.5}
                        fill={`url(#rr-${b.basket.id})`}
                        isAnimationActive={false}
                      />
                      <XAxis dataKey="t" hide />
                      <YAxis hide domain={["auto", "auto"]} />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(10,15,28,0.95)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                        labelFormatter={(v) => new Date(v).toLocaleString()}
                        formatter={(v: number) => [formatPct(v), "Realised"]}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
