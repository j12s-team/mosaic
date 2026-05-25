import { NextResponse } from "next/server";
import { getAllTickers } from "@/lib/sodex";
import { getFeaturedNews } from "@/lib/sosovalue";

/**
 * GET /api/market-pulse
 *
 * Combines:
 *  - top SoDEX tickers (largest 24h movers, both up and down)
 *  - latest featured news from SoSoValue
 *
 * Used by the MarketPulse dashboard widget to show that the app is actually
 * pulling from both APIs in real time.
 */
export async function GET() {
  const [tickersRaw, news] = await Promise.all([
    getAllTickers().catch(() => []),
    getFeaturedNews({ pageSize: 6 }).catch(() => []),
  ]);

  // Keep USDC pairs only and the top movers in either direction.
  const tickers = tickersRaw
    .filter((t) => t.quote.toUpperCase() === "USDC" && t.lastPrice > 0)
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 8)
    .map((t) => ({
      symbol: t.base,
      display: t.display,
      lastPrice: t.lastPrice,
      changePct: t.changePct,
    }));

  return NextResponse.json({
    tickers,
    news: news.slice(0, 5),
    fetchedAt: new Date().toISOString(),
  });
}
