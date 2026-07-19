import { NextResponse } from "next/server";
import { getFeaturedNews, getLivePrices, listSsiIndexes } from "@mosaic/core/sosovalue";

// Live data — never serve a build-time snapshot (fix: app showed demo/mock
// while the site showed live). Re-runs per request with the current env.
export const dynamic = "force-dynamic";

/**
 * GET /api/market-pulse
 *
 * Cross-API integration tile. Mixes:
 *  - live spot prices for a curated set of majors (SoSoValue token metrics)
 *  - top SSI indices ranked by 24h move (SoSoValue SSI list)
 *  - latest featured news (SoSoValue news)
 *
 * SoDEX testnet tickers are intentionally NOT used as the price source here
 * — testnet prints synthetic prices (SOL @ $140 etc.) that confused users.
 * Real spot prices come from SoSoValue; SoDEX is the execution venue, not
 * the quote source.
 */
const MAJORS = [
  "BTC",
  "ETH",
  "SOL",
  "BNB",
  "XRP",
  "DOGE",
  "ADA",
  "AVAX",
  "TAO",
  "WLD",
  "LDO",
  "ONDO",
  "RNDR",
  "FET",
  "IO",
  "PEPE",
  "WIF",
  "FIL",
];

export async function GET() {
  const [prices, news, ssi] = await Promise.all([
    getLivePrices(MAJORS).catch(() => []),
    getFeaturedNews({ pageSize: 6 }).catch(() => []),
    listSsiIndexes().catch(() => []),
  ]);

  // Movers — sort by absolute 24h move, take the top 8.
  const tickers = prices
    .filter((p) => p.price > 0)
    .sort((a, b) => Math.abs(b.changePct24h) - Math.abs(a.changePct24h))
    .slice(0, 8)
    .map((p) => ({
      symbol: p.symbol,
      display: `${p.symbol}/USDC`,
      lastPrice: p.price,
      changePct: p.changePct24h,
      source: p.source,
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

  // Honest sourcing. Prices come via SoSoValue market-snapshot; news/SSI via
  // other endpoints. Report each independently so a single failing endpoint
  // isn't mislabeled as "all demo", and expose WHY when not live.
  // "live" tracks the one reliable per-item signal: did a price actually come
  // from SoSoValue (source==="sosovalue") vs the curated seed table. When not
  // live, `reason` says WHY so the cause is visible in-app, not a silent pill.
  const live = tickers.some((t) => t.source === "sosovalue");
  const hasKey = Boolean(process.env.SOSOVALUE_API_KEY);
  const forcedMocks = process.env.MOSAIC_USE_MOCKS === "true";
  const reason = !hasKey
    ? "SOSOVALUE_API_KEY is not set in this environment"
    : forcedMocks
      ? "MOSAIC_USE_MOCKS=true is forcing the mock layer"
      : !live
        ? "SoSoValue returned no live prices — check server logs (MOSAIC_DEBUG_SODEX=1)"
        : null;

  return NextResponse.json({
    tickers,
    ssiMovers,
    news: news.slice(0, 5),
    live,
    reason,
    sosoConfigured: hasKey && !forcedMocks,
    priceSource: live ? "SoSoValue market snapshots" : "curated seed prices",
    fetchedAt: new Date().toISOString(),
  });
}
