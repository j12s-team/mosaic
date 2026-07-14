import { getEtfFlows, getFeaturedNews, getSsiIndex, listSsiIndexes } from "@mosaic/core/sosovalue";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@mosaic/ui/card";
import { Badge } from "@mosaic/ui/badge";
import { formatCompact, formatUSD, timeAgo } from "@mosaic/core/utils";
import { Newspaper, ArrowDownUp, Boxes, Radio } from "lucide-react";

// Refresh the server-rendered landing data every 30 seconds so visitors
// see live ticking values, matching the section copy.
export const revalidate = 30;

export async function LiveData() {
  const [news, flows, mag7, allIndexes] = await Promise.all([
    getFeaturedNews({ pageSize: 4 }).catch(() => []),
    getEtfFlows("ETH").catch(() => []),
    getSsiIndex("MAG7.ssi").catch(() => null),
    listSsiIndexes().catch(() => []),
  ]);

  const cumFlow = flows[flows.length - 1]?.cumulativeUsd ?? 0;
  const todayFlow = flows[flows.length - 1]?.netInflowUsd ?? 0;
  const lastUpdated = new Date();
  const indexCount = allIndexes.length;

  return (
    <section id="data" className="relative mx-auto max-w-content px-6 py-24">
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-success/30 bg-success/10 px-3 py-1 text-xs font-medium text-success">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          Live · streaming from SoSoValue
        </div>
        <h2 className="mt-4 text-balance text-4xl font-semibold leading-tight md:text-5xl">
          Wired into SoSoValue from day one.
        </h2>
        <p className="mt-4 text-balance text-on-surface-variant">
          News, ETF flows, and SSI on-chain indices — pulled directly from SoSoValue&apos;s public
          APIs, rendered server-side, and refreshed every 30 seconds. No mock fixtures, no stale
          screenshots: what you see below is what the agent reads.
        </p>
        <p className="mt-3 font-mono text-[11px] uppercase tracking-wider text-on-surface-variant">
          Last refresh · {lastUpdated.toUTCString().slice(17, 25)} UTC
        </p>
      </div>

      <div className="mt-14 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Newspaper className="h-4 w-4 text-primary" />
                Featured news feed
              </CardTitle>
              <CardDescription className="text-xs">
                {news.length > 0
                  ? `${news.length} story${news.length === 1 ? "" : "ies"} · SoSoValue research desk`
                  : "SoSoValue research desk"}
              </CardDescription>
            </div>
            <Badge variant="brand">
              <Radio className="h-3 w-3" />
              Live
            </Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {news.map((n) => (
              <div
                key={n.id}
                className="rounded-md border border-outline-variant bg-surface-container p-3 transition hover:border-outline-variant"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-on-surface-variant">
                    {n.source}
                  </span>
                  <span className="text-[10px] text-on-surface-variant">
                    {timeAgo(n.publishedAt)}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">{n.title}</p>
                {n.tickers && n.tickers.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {n.tickers.slice(0, 4).map((t) => (
                      <Badge key={t} variant="outline" className="text-[10px]">
                        ${t}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ArrowDownUp className="h-4 w-4 text-primary" />
                ETH spot ETF flows (7d)
              </CardTitle>
              <CardDescription className="text-xs">
                Institutional bid · SoSoValue ETF dashboard
              </CardDescription>
            </div>
            <Badge variant="brand">
              <Radio className="h-3 w-3" />
              Live
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border border-outline-variant bg-surface-container p-3">
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                  Latest day net
                </div>
                <div className={`mt-1 text-lg font-semibold ${todayFlow >= 0 ? "text-success " : "text-error "}`}>
                  {todayFlow >= 0 ? "+" : ""}{formatUSD(todayFlow, { maxFrac: 0 })}
                </div>
              </div>
              <div className="rounded-md border border-outline-variant bg-surface-container p-3">
                <div className="text-[10px] uppercase tracking-wider text-on-surface-variant">
                  7d cumulative
                </div>
                <div className={`mt-1 text-lg font-semibold ${cumFlow >= 0 ? "text-success " : "text-error "}`}>
                  {cumFlow >= 0 ? "+" : ""}{formatUSD(cumFlow, { maxFrac: 0 })}
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-1.5">
              {flows.slice(-7).map((f) => (
                <div key={f.date} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-on-surface-variant">{f.date}</span>
                  <div className="flex h-1.5 flex-1 mx-3 rounded-full bg-surface-container overflow-hidden">
                    <div
                      className={`h-full ${f.netInflowUsd >= 0 ? "bg-success" : "bg-error"}`}
                      style={{
                        width: `${Math.min(100, (Math.abs(f.netInflowUsd) / 250_000_000) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="w-16 text-right font-mono">
                    {f.netInflowUsd >= 0 ? "+" : ""}{formatCompact(f.netInflowUsd)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Boxes className="h-4 w-4 text-primary" />
                SSI Index — {mag7?.symbol ?? "MAG7.ssi"}
              </CardTitle>
              <CardDescription className="text-xs">
                {indexCount > 0 ? `${indexCount} SSI indices available` : "On-chain composite"}
              </CardDescription>
            </div>
            <Badge variant="brand">
              <Radio className="h-3 w-3" />
              Live
            </Badge>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-on-surface-variant line-clamp-2">{mag7?.description}</p>
            <div className="mt-3 space-y-2">
              {(mag7?.constituents ?? []).slice(0, 7).map((c) => (
                <div key={c.symbol}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{c.symbol}</span>
                    <span className="font-mono text-on-surface-variant">
                      {(c.weight * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-surface-container">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${c.weight * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-2 text-[11px] text-on-surface-variant">
        <span className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 font-mono">
          GET /api/v1/news/featured/currency
        </span>
        <span className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 font-mono">
          GET /api/v1/etf/spot/eth/flow
        </span>
        <span className="rounded-full border border-outline-variant bg-surface-container-low px-3 py-1 font-mono">
          GET /api/v1/index/MAG7.ssi
        </span>
      </div>
    </section>
  );
}
