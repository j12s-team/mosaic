import { NextResponse } from "next/server";
import { getAllTickers } from "@/lib/sodex";
import { getFeaturedNews, listSsiIndexes } from "@/lib/sosovalue";

/**
 * GET /api/market-pulse
 *
 * Combines:
 *  - SoDEX tickers (filtered to plausible 24h moves to drop testnet glitches)
 *  - latest featured news from SoSoValue
 *  - top SSI index movers
 *
 * Used by the MarketPulse dashboard widget to show that the app is actually
 * pulling from both APIs in real time.
 */
export async function GET() {
  const [tickersRaw, news, ssi] = await Promise.all([
    getAllTickers().catch(() => []),
    getFeaturedNews({ pageSize: 6 }).catch(() => []),
    listSsiIndexes().catch(() => []),
  ]);

  // Keep USDC pairs only and drop obviously broken testnet ticks (anything
  // outside ±50% in a day on majors is wrong, not a real move). Then sort by
  // absolute move and slice the top 8.
  const tickers = tickersRaw
    .filter((t) => t.quote.toUpperCase() === "USDC" && t.lastPrice > 0)
    .filter((t) => Math.abs(t.changePct) < 0.5)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 8)
    .map((t) => ({
      symbol: t.base,
      display: t.display,
      lastPrice: t.lastPrice,
      changePct: t.changePct,
    }));

  // SSI movers — sort by absolute change, keep top 4.
  const ssiMovers = ssi
    .filter((idx) => typeof idx.changePct === "number")
    .sort((a, b) => Math.abs((b.changePct ?? 0)) - Math.abs((a.changePct ?? 0)))
    .slice(0, 4)
    .map((idx) => ({
      symbol: idx.symbol,
      name: idx.name,
      changePct: idx.changePct ?? 0,
    }));

  return NextResponse.json({
    tickers,
    ssiMovers,
    news: news.slice(0, 5),
    fetchedAt: new Date().toISOString(),
  });
}
