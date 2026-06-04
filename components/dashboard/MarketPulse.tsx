"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Layers, Newspaper, TrendingDown, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { LivePulse } from "@/components/ui/live-pulse";
import type { NewsItem } from "@/lib/types";

interface Ticker {
  symbol: string;
  display: string;
  lastPrice: number;
  changePct: number;
}

interface SsiMover {
  symbol: string;
  name: string;
  changePct: number;
}

/**
 * MarketPulse - a single widget that proves cross-API integration:
 *   - Top SoDEX movers (24h) from /markets/tickers
 *   - Latest SoSoValue featured news
 * Auto-refreshes every 60s.
 */
export function MarketPulse() {
  const [data, setData] = useState<{ tickers: Ticker[]; news: NewsItem[]; ssiMovers?: SsiMover[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch("/api/market-pulse", { cache: "no-store" });
        const j = await r.json();
        if (!cancelled) setData(j);
      } catch {
        if (!cancelled) setData({ tickers: [], news: [], ssiMovers: [] });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-600 dark:text-brand-300" />
          Live market pulse
          <Badge variant="brand" className="text-[10px]">
            SoDEX + SoSoValue
          </Badge>
          <LivePulse label="streaming" className="ml-auto" />
        </CardTitle>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Top 24h movers priced from{" "}
          <code className="font-mono">SoSoValue /token/metrics</code> (real spot, not testnet
          synthetic prices) alongside SSI index moves and featured news. Refreshes every minute.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Movers
          </div>
          {loading ? (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : data && data.tickers.length > 0 ? (
            <div className="grid gap-1.5 sm:grid-cols-2">
              {data.tickers.map((t) => {
                const up = t.changePct >= 0;
                return (
                  <div
                    key={t.symbol}
                    className="flex items-center justify-between rounded-md border border-border/40 bg-secondary/30 dark:bg-background/40 px-2 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{t.symbol}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {t.lastPrice < 0.0001
                          ? `$${t.lastPrice.toExponential(2)}`
                          : t.lastPrice < 1
                          ? `$${t.lastPrice.toFixed(4)}`
                          : `$${t.lastPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                      </span>
                    </div>
                    <span
                      className={`flex items-center gap-0.5 font-mono ${
                        up ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {(t.changePct * 100).toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-muted-foreground">No ticker data right now.</div>
          )}
        </div>

        {data && data.ssiMovers && data.ssiMovers.length > 0 && (
          <div>
            <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
              <Layers className="h-3 w-3" /> SoSoValue SSI movers
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {data.ssiMovers.map((m) => {
                const up = m.changePct >= 0;
                return (
                  <div
                    key={m.symbol}
                    className="flex items-center justify-between rounded-md border border-border/40 bg-secondary/30 dark:bg-background/40 px-2 py-1.5 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold">{m.symbol}</div>
                      <div className="truncate text-[10px] text-muted-foreground">{m.name}</div>
                    </div>
                    <span
                      className={`flex items-center gap-0.5 font-mono ${
                        up ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {(m.changePct * 100).toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <div className="mb-2 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Newspaper className="h-3 w-3" /> SoSoValue featured news
          </div>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data && data.news.length > 0 ? (
            <ul className="space-y-2">
              {data.news.map((n) => (
                <li key={n.id} className="rounded-md border border-border/40 bg-secondary/30 dark:bg-background/40 p-2">
                  <a
                    href={n.url ?? "#"}
                    target={n.url ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="text-xs font-medium hover:underline"
                  >
                    {n.title}
                  </a>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{n.source}</span>
                    {n.tickers && n.tickers.length > 0 && (
                      <span className="flex flex-wrap gap-0.5">
                        {n.tickers.slice(0, 3).map((tk) => (
                          <span
                            key={tk}
                            className="rounded bg-brand-500/10 px-1 font-mono text-brand-700 dark:text-brand-300"
                          >
                            {tk}
                          </span>
                        ))}
                      </span>
                    )}
                    {n.sentiment !== undefined && (
                      <span
                        className={
                          n.sentiment > 0.2
                            ? "text-emerald-600 dark:text-emerald-400"
                            : n.sentiment < -0.2
                            ? "text-red-600 dark:text-red-400"
                            : "text-muted-foreground"
                        }
                      >
                        sentiment {(n.sentiment * 100).toFixed(0)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="py-4 text-center text-xs text-muted-foreground">No news right now.</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
