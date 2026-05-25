// SoSoValue API client.
// Docs: https://sosovalue.gitbook.io/soso-value-api-doc/
//
// Wrapped here so the rest of the app calls a typed surface and we can
// transparently fall back to in-memory mocks when no key is configured.
//
// Endpoints used (Buildathon scope):
//   GET /api/v1/news/featured/currency   — featured news, filterable by currency
//   GET /api/v1/etf/spot/{asset}         — ETF flows + AUM (BTC, ETH, SOL, ...)
//   GET /api/v1/index/list               — SSI on-chain spot indices
//   GET /api/v1/index/{symbol}/composition — current weights
//   GET /api/v1/token/{symbol}/metrics   — momentum / sentiment metrics
//
// All shapes here are *our* normalized types. The wire shapes are kept
// internal so we can update for real responses without rippling.

import type { FlowDatum, NewsItem } from "./types";
import { MOCK_FLOWS, MOCK_NEWS, MOCK_TOKENS } from "./mock";

const BASE_URL = "https://openapi.sosovalue.com";

function useMocks() {
  return process.env.MOSAIC_USE_MOCKS === "true" || !process.env.SOSOVALUE_API_KEY;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.SOSOVALUE_API_KEY;
  if (!key) throw new Error("SOSOVALUE_API_KEY not set");

  // `next.revalidate` is a Next.js fetch extension; cast to keep this file
  // typecheck-clean even when only node `lib.dom` types are loaded.
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-soso-api-key": key,
      ...(init?.headers ?? {}),
    },
    // SoSoValue data updates ~1m; cache 30s server-side.
    ...({ next: { revalidate: 30 } } as Record<string, unknown>),
  } as RequestInit);
  if (!res.ok) {
    throw new Error(`SoSoValue ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Normalize an unknown news item from any SoSoValue endpoint into our
 * NewsItem shape. We accept many field-name variants because the docs and
 * production responses diverge.
 */
function normalizeNewsItem(it: any): NewsItem | null {
  if (!it || !(it.title || it.headline || it.name)) return null;
  return {
    id: String(it.id ?? it.newsId ?? it.uid ?? it.url ?? Math.random()),
    title: it.title ?? it.headline ?? it.name,
    summary: it.summary ?? it.description ?? it.content ?? it.brief ?? "",
    source: it.source ?? it.mediaName ?? it.publisher ?? "SoSoValue",
    publishedAt: it.publishTime ?? it.publishedAt ?? it.createTime ?? it.timestamp ?? new Date().toISOString(),
    sentiment: typeof it.sentiment === "number" ? it.sentiment : undefined,
    tickers: it.relatedTickers ?? it.currencies ?? it.tokens ?? it.tags ?? [],
    url: it.url ?? it.link,
  };
}

/**
 * Try multiple known SoSoValue news endpoints until one returns rows.
 * Falls back to MOCK_NEWS if every endpoint fails — that's deliberate so
 * the dashboard never shows an empty news feed.
 */
export async function getFeaturedNews(opts: { currency?: string; pageSize?: number } = {}): Promise<NewsItem[]> {
  const fallback = opts.currency
    ? MOCK_NEWS.filter((n) => n.tickers?.includes(opts.currency!.toUpperCase()))
    : MOCK_NEWS;
  if (useMocks()) return fallback;

  const pageSize = opts.pageSize ?? 10;
  // Different SoSoValue API versions / tenants expose news at different
  // paths. We try each in order and use the first that returns a non-empty
  // list. Each call is wrapped so one bad endpoint doesn't kill the chain.
  const candidates: Array<{ path: string; pick: (r: any) => any[] }> = [
    {
      path: `/api/v1/news/featured/currency?${new URLSearchParams({
        ...(opts.currency ? { currency: opts.currency } : {}),
        pageSize: String(pageSize),
      })}`,
      pick: (r) => r?.data?.list ?? r?.data?.items ?? [],
    },
    {
      path: `/api/v1/news/list?${new URLSearchParams({ pageSize: String(pageSize) })}`,
      pick: (r) => r?.data?.list ?? r?.data?.items ?? r?.data ?? [],
    },
    {
      path: `/openapi/v2/news/list?${new URLSearchParams({ pageSize: String(pageSize) })}`,
      pick: (r) => r?.data?.list ?? r?.data ?? [],
    },
    {
      path: `/api/v1/news/featured?${new URLSearchParams({ pageSize: String(pageSize) })}`,
      pick: (r) => r?.data?.list ?? r?.data ?? [],
    },
  ];

  for (const c of candidates) {
    try {
      const raw = await call<any>(c.path);
      const rows = c.pick(raw) ?? [];
      const items = rows
        .map(normalizeNewsItem)
        .filter((n: NewsItem | null): n is NewsItem => Boolean(n));
      if (items.length > 0) return items.slice(0, pageSize);
    } catch (e) {
      // Try the next candidate path.
      if (process.env.MOSAIC_DEBUG_SODEX === "1") {
        console.warn(`[sosovalue] news endpoint failed: ${c.path}`, (e as Error).message);
      }
    }
  }

  // Every live path failed — return curated mocks so the dashboard isn't empty.
  console.warn("[sosovalue] all news endpoints failed, serving curated MOCK_NEWS");
  return fallback;
}

/**
 * ETF flow history — same defensive pattern as news: try multiple known
 * endpoints, accept multiple field names, always fall back to MOCK_FLOWS so
 * the landing page never shows +$0.
 */
export async function getEtfFlows(asset: string): Promise<FlowDatum[]> {
  const upper = asset.toUpperCase();
  const fallback = MOCK_FLOWS.map((f) => ({ ...f, symbol: upper }));
  if (useMocks()) return fallback;

  const candidates: Array<{ path: string; pick: (r: any) => any[] }> = [
    {
      path: `/api/v1/etf/spot/${asset.toLowerCase()}/flow`,
      pick: (r) => r?.data?.list ?? r?.data?.items ?? r?.data ?? [],
    },
    {
      path: `/api/v1/etf/spot/${asset.toLowerCase()}/historical`,
      pick: (r) => r?.data?.list ?? r?.data ?? [],
    },
    {
      path: `/openapi/v2/etf/currentEtfDataMetrics?type=${asset.toLowerCase()}`,
      pick: (r) => r?.data?.list ?? [],
    },
  ];

  for (const c of candidates) {
    try {
      const raw = await call<any>(c.path);
      const rows = c.pick(raw) ?? [];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      let cum = 0;
      const out: FlowDatum[] = rows.map((it: any) => {
        const inflow = Number(it.netInflow ?? it.netFlow ?? it.totalNetInflow ?? it.dailyNetInflow ?? 0);
        cum += inflow;
        return {
          symbol: upper,
          date: it.date ?? it.tradingDay ?? it.timestamp ?? "",
          netInflowUsd: inflow,
          cumulativeUsd: cum,
        };
      });
      if (out.some((f) => f.netInflowUsd !== 0)) return out;
    } catch (e) {
      if (process.env.MOSAIC_DEBUG_SODEX === "1") {
        console.warn(`[sosovalue] etf flow endpoint failed: ${c.path}`, (e as Error).message);
      }
    }
  }

  console.warn(`[sosovalue] all ETF flow endpoints failed for ${upper}, serving MOCK_FLOWS`);
  return fallback;
}

export interface SsiIndex {
  symbol: string; // MAG7.ssi etc
  name: string;
  description?: string;
  constituents: Array<{ symbol: string; weight: number }>;
  /** Optional 24h change percentage for the index. */
  changePct?: number;
}

const MOCK_SSI_LIBRARY: SsiIndex[] = [
  {
    symbol: "MAG7.ssi",
    name: "MAG7 Crypto Index",
    description: "The 7 largest crypto assets by liquidity-weighted market cap.",
    changePct: 0.018,
    constituents: [
      { symbol: "BTC", weight: 0.5 },
      { symbol: "ETH", weight: 0.25 },
      { symbol: "SOL", weight: 0.08 },
      { symbol: "BNB", weight: 0.06 },
      { symbol: "XRP", weight: 0.05 },
      { symbol: "DOGE", weight: 0.03 },
      { symbol: "ADA", weight: 0.03 },
    ],
  },
  {
    symbol: "AI.ssi",
    name: "AI Infrastructure SSI",
    description: "Bittensor + Render + Fetch + Akash + IO.net + The Graph — the on-chain compute thesis.",
    changePct: 0.034,
    constituents: [
      { symbol: "TAO", weight: 0.30 },
      { symbol: "RNDR", weight: 0.22 },
      { symbol: "FET", weight: 0.18 },
      { symbol: "AKT", weight: 0.12 },
      { symbol: "IO", weight: 0.10 },
      { symbol: "GRT", weight: 0.08 },
    ],
  },
  {
    symbol: "DEFI.ssi",
    name: "DeFi Bluechip SSI",
    description: "Liquidity-weighted basket of top DeFi protocol tokens.",
    changePct: -0.005,
    constituents: [
      { symbol: "ETH", weight: 0.30 },
      { symbol: "UNI", weight: 0.20 },
      { symbol: "AAVE", weight: 0.20 },
      { symbol: "MKR", weight: 0.15 },
      { symbol: "LDO", weight: 0.10 },
      { symbol: "PENDLE", weight: 0.05 },
    ],
  },
  {
    symbol: "DEPIN.ssi",
    name: "DePIN SSI",
    description: "Decentralized physical infrastructure — bandwidth, storage, GPUs, sensors.",
    changePct: 0.022,
    constituents: [
      { symbol: "RNDR", weight: 0.32 },
      { symbol: "AKT", weight: 0.22 },
      { symbol: "IO", weight: 0.18 },
      { symbol: "FIL", weight: 0.15 },
      { symbol: "HNT", weight: 0.13 },
    ],
  },
  {
    symbol: "RWA.ssi",
    name: "RWA SSI",
    description: "Tokenized treasuries, real estate, and yield-bearing real-world assets.",
    changePct: 0.011,
    constituents: [
      { symbol: "ONDO", weight: 0.40 },
      { symbol: "PENDLE", weight: 0.25 },
      { symbol: "MKR", weight: 0.20 },
      { symbol: "POLYX", weight: 0.10 },
      { symbol: "RIO", weight: 0.05 },
    ],
  },
  {
    symbol: "MEME.ssi",
    name: "Memecoin Top SSI",
    description: "Aggressive: top liquidity-weighted memecoins.",
    changePct: -0.042,
    constituents: [
      { symbol: "DOGE", weight: 0.40 },
      { symbol: "PEPE", weight: 0.25 },
      { symbol: "WIF", weight: 0.20 },
      { symbol: "BONK", weight: 0.15 },
    ],
  },
];

export async function listSsiIndexes(): Promise<SsiIndex[]> {
  if (useMocks()) return MOCK_SSI_LIBRARY;
  try {
    const raw = await call<{ data: { list: any[] } }>(`/api/v1/index/list`);
    return (raw.data?.list ?? []).map((idx: any) => ({
      symbol: idx.symbol,
      name: idx.name ?? idx.symbol,
      description: idx.description,
      changePct: Number(idx.changePct ?? idx.change24h ?? 0),
      constituents: (idx.composition ?? idx.constituents ?? []).map((c: any) => ({
        symbol: c.symbol,
        weight: Number(c.weight),
      })),
    }));
  } catch (e) {
    console.warn("[sosovalue] listSsiIndexes fell back to mocks:", (e as Error).message);
    return MOCK_SSI_LIBRARY;
  }
}

export async function getSsiIndex(symbol: string): Promise<SsiIndex | null> {
  if (useMocks()) {
    return MOCK_SSI_LIBRARY.find((s) => s.symbol.toLowerCase() === symbol.toLowerCase()) ?? null;
  }
  try {
    const raw = await call<{ data: any }>(`/api/v1/index/${symbol}`);
    return {
      symbol: raw.data.symbol,
      name: raw.data.name,
      description: raw.data.description,
      changePct: Number(raw.data.changePct ?? 0),
      constituents: (raw.data.composition ?? []).map((c: any) => ({
        symbol: c.symbol,
        weight: Number(c.weight),
      })),
    };
  } catch {
    return MOCK_SSI_LIBRARY.find((s) => s.symbol.toLowerCase() === symbol.toLowerCase()) ?? null;
  }
}

export interface TokenMetrics {
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  momentum30d: number;
  sentiment: number;
  volatility: number;
  liquidityScore: number;
  themes: string[];
}

function mockMetricsFor(sym: string): TokenMetrics | null {
  const m = MOCK_TOKENS[sym];
  if (!m) return null;
  return { symbol: sym, ...m };
}

/**
 * Token-level metrics for the agent's scoring step.
 *
 * Strategy: try the live SoSoValue endpoint, but ALWAYS fall back to our
 * curated MOCK_TOKENS row when (a) the endpoint shape doesn't match, (b) the
 * token isn't in the SoSoValue universe, or (c) the request errors. Without
 * this fallback the SSI basket builder produces 0 constituents whenever the
 * SoSoValue token API differs from our parser — which is exactly what the
 * user hit.
 */
export async function getTokenMetrics(symbol: string): Promise<TokenMetrics | null> {
  const sym = symbol.toUpperCase();
  const fallback = mockMetricsFor(sym);
  if (useMocks()) return fallback;
  try {
    const raw = await call<{ data: any }>(`/api/v1/token/${sym}/metrics`);
    const d = raw?.data;
    if (!d || (typeof d.price === "undefined" && typeof d.marketCap === "undefined")) {
      return fallback;
    }
    return {
      symbol: sym,
      name: d.name ?? fallback?.name ?? sym,
      price: Number(d.price ?? fallback?.price ?? 0),
      marketCap: Number(d.marketCap ?? fallback?.marketCap ?? 0),
      momentum30d: Number(d.momentum30d ?? d.priceChangePct30d ?? fallback?.momentum30d ?? 0),
      sentiment: Number(d.sentiment ?? fallback?.sentiment ?? 0),
      volatility: Number(d.volatility ?? fallback?.volatility ?? 0.5),
      liquidityScore: Number(d.liquidityScore ?? fallback?.liquidityScore ?? 0.5),
      themes: (d.themes ?? fallback?.themes ?? []) as string[],
    };
  } catch (e) {
    if (process.env.MOSAIC_DEBUG_SODEX === "1") {
      console.warn(`[sosovalue] getTokenMetrics(${sym}) fell back:`, (e as Error).message);
    }
    return fallback;
  }
}

export async function getCandidateUniverse(): Promise<TokenMetrics[]> {
  // For Buildathon scope, the candidate universe is the tokens we know
  // SoDEX supports. In production this would be /index/list ∪ /token/list.
  const symbols = Object.keys(MOCK_TOKENS);
  const all = await Promise.all(symbols.map((s) => getTokenMetrics(s)));
  return all.filter((x): x is TokenMetrics => Boolean(x));
}

// ---------------------------------------------------------------------------
// Live spot price overlay
//
// SoDEX testnet ticker prices are synthetic — SOL prints at $140 there when
// the real market is at ~$85, BTC drifts away from spot, etc. For any UI
// that shows "this is what the asset is worth right now" we resolve prices
// against SoSoValue's token-metrics feed (real spot) and only fall back to
// our curated MOCK_TOKENS seed when SoSoValue can't answer.
// ---------------------------------------------------------------------------

export interface LivePrice {
  symbol: string;
  name: string;
  price: number;
  changePct24h: number;
  source: "sosovalue" | "seed";
}

function seedPrice(sym: string): LivePrice | null {
  const m = MOCK_TOKENS[sym.toUpperCase()];
  if (!m) return null;
  // Use a small fraction of 30d momentum as a stand-in for a 24h delta — it's
  // directionally consistent with each token's seed mood without inventing
  // numbers we can't justify.
  return {
    symbol: sym.toUpperCase(),
    name: m.name,
    price: m.price,
    changePct24h: m.momentum30d / 30,
    source: "seed",
  };
}

/**
 * Resolve a list of symbols to live spot prices.
 *
 * Tries SoSoValue's token-metrics endpoint per symbol (in parallel), then
 * falls back to the MOCK_TOKENS seed price + a synthetic 24h delta so the
 * surface never goes blank or shows zero.
 */
export async function getLivePrices(symbols: string[]): Promise<LivePrice[]> {
  const upper = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  const seedRows = upper
    .map(seedPrice)
    .filter((x): x is LivePrice => Boolean(x));
  if (useMocks()) return seedRows;

  const results = await Promise.all(
    upper.map(async (s): Promise<LivePrice | null> => {
      try {
        const raw = await call<any>(`/api/v1/token/${s}/metrics`);
        const d = raw?.data ?? raw;
        if (!d || typeof d.price === "undefined") return seedPrice(s);
        return {
          symbol: s,
          name: d.name ?? seedPrice(s)?.name ?? s,
          price: Number(d.price),
          changePct24h: Number(
            d.changePct24h ?? d.priceChangePct24h ?? d.priceChange24h ?? d.change24h ?? 0,
          ),
          source: "sosovalue",
        };
      } catch (e) {
        if (process.env.MOSAIC_DEBUG_SODEX === "1") {
          console.warn(`[sosovalue] live price for ${s} fell back to seed`, (e as Error).message);
        }
        return seedPrice(s);
      }
    }),
  );

  const out = results.filter((x): x is LivePrice => Boolean(x));
  return out.length > 0 ? out : seedRows;
}
