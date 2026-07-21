import { NextResponse } from "next/server";
import { getFeaturedNews, listSsiIndexes } from "@mosaic/core/sosovalue";
import { getAllTickers, currentNetwork } from "@mosaic/core/sodex";

// Live data — never serve a build-time snapshot. Re-runs per request; the
// underlying SoSoValue/SoDEX clients cache + rate-limit, so this is cheap.
export const dynamic = "force-dynamic";

/**
 * GET /api/market-pulse
 *
 * Movers + SSI + news. QUOTA-AWARE: the SoSoValue Demo plan is only
 * 10k calls/month · 10/min, so we do NOT price a basket of majors via
 * per-symbol SoSoValue snapshots here (that was ~18 calls/load). Instead:
 *  - Prices: SoDEX `/markets/tickers` — ONE cached, quota-free call. On
 *    mainnet these are real spot; on testnet they're synthetic (labeled).
 *  - SSI movers + featured news: SoSoValue (2 calls, heavily cached).
 */
const MAJORS = new Set([
  "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "ADA", "AVAX", "TAO", "WLD",
  "LDO", "ONDO", "RNDR", "RENDER", "FET", "IO", "PEPE", "WIF", "FIL", "LINK",
  "UNI", "AAVE", "ARB", "OP", "SOSO",
]);

export async function GET() {
  const network = currentNetwork();
  const [sodexTickers, news, ssi] = await Promise.all([
    getAllTickers().catch(() => []),
    getFeaturedNews({ pageSize: 6 }).catch(() => []),
    listSsiIndexes().catch(() => []),
  ]);

  // Movers from SoDEX tickers (quota-free). Curate to majors, rank by |24h|.
  const tickers = sodexTickers
    .filter((t) => t.lastPrice > 0 && MAJORS.has(t.base.toUpperCase()))
    .sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))
    .slice(0, 8)
    .map((t) => ({
      symbol: t.base,
      display: t.display,
      lastPrice: t.lastPrice,
      changePct: t.changePct,
      source: "sodex" as const,
    }));

  const ssiMovers = ssi
    .filter((idx) => typeof idx.changePct === "number")
    .sort((a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0))
    .slice(0, 4)
    .map((idx) => ({ symbol: idx.symbol, name: idx.name, changePct: idx.changePct ?? 0 }));

  // Prices are live whenever SoDEX returned real markets. On mainnet that's
  // real spot; on testnet the prices are synthetic, so we flag that.
  const pricesLive = tickers.length > 0;
  const live = pricesLive || ssiMovers.length > 0;
  const hasKey = Boolean(process.env.SOSOVALUE_API_KEY);
  const forcedMocks = process.env.MOSAIC_USE_MOCKS === "true";
  const reason = !live
    ? forcedMocks
      ? "MOSAIC_USE_MOCKS=true is forcing the mock layer"
      : "No live SoDEX markets or SoSoValue indices returned"
    : network === "mainnet"
      ? "SoDEX mainnet prices are synthetic"
      : !hasKey
        ? "SSI/news show demo data — SOSOVALUE_API_KEY not set"
        : null;

  return NextResponse.json({
    tickers,
    ssiMovers,
    news: news.slice(0, 5),
    live,
    reason,
    network,
    priceSource: network === "mainnet" ? "SoDEX mainnet spot" : "SoDEX testnet (synthetic)",
    fetchedAt: new Date().toISOString(),
  });
}
