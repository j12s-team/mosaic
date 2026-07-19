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
/** Documented API base (SoSoValue API docs). */
const V1 = "/openapi/v1";

function useMocks() {
  return process.env.MOSAIC_USE_MOCKS === "true" || !process.env.SOSOVALUE_API_KEY;
}

/** Some deployments wrap responses in { code, data }; others return raw. */
function unwrap<T>(raw: unknown): T {
  const r = raw as { code?: number; data?: unknown };
  if (r && typeof r === "object" && "data" in r) return r.data as T;
  return raw as T;
}

// ---------------------------------------------------------------------------
// Currency id resolution — /currencies gives { currency_id, symbol, name };
// market snapshots & klines are keyed by currency_id. Cached ~1h.
// ---------------------------------------------------------------------------

interface CurrencyRow {
  currency_id: string | number;
  symbol: string;
  name?: string;
}

/** Known symbol drift between Mosaic's universe and the /currencies list. */
const CURRENCY_ALIASES: Record<string, string[]> = {
  RNDR: ["RNDR", "RENDER"],
  IO: ["IO", "IONET", "IO.NET"],
  WIF: ["WIF", "DOGWIFHAT"],
  FET: ["FET", "ASI"],
  TAO: ["TAO", "BITTENSOR"],
  POLYX: ["POLYX", "POLYMESH"],
};

let currencyCache: { at: number; map: Map<string, CurrencyRow> } | null = null;

async function currencyMap(): Promise<Map<string, CurrencyRow>> {
  if (currencyCache && Date.now() - currencyCache.at < 3_600_000) return currencyCache.map;
  const rows = unwrap<CurrencyRow[]>(await call<unknown>(`${V1}/currencies`));
  const map = new Map<string, CurrencyRow>();
  if (Array.isArray(rows)) {
    for (const r of rows) {
      if (r?.symbol) map.set(String(r.symbol).toUpperCase(), r);
    }
  }
  currencyCache = { at: Date.now(), map };
  return map;
}

interface MarketSnapshot {
  price?: number | string;
  change_pct_24h?: number | string;
  marketcap?: number | string;
  [k: string]: unknown;
}

function findCurrency(map: Map<string, CurrencyRow>, sym: string): CurrencyRow | null {
  const upper = sym.toUpperCase();
  for (const candidate of CURRENCY_ALIASES[upper] ?? [upper]) {
    const row = map.get(candidate);
    if (row) return row;
  }
  return null;
}

async function marketSnapshot(sym: string): Promise<MarketSnapshot | null> {
  const map = await currencyMap();
  const row = findCurrency(map, sym);
  if (!row) {
    if (process.env.MOSAIC_DEBUG_SODEX === "1") {
      console.warn(`[sosovalue] no /currencies match for ${sym}`);
    }
    return null;
  }
  return unwrap<MarketSnapshot>(
    await call<unknown>(`${V1}/currencies/${row.currency_id}/market-snapshot`),
  );
}

/** N-day price momentum from daily klines (fraction, e.g. 0.12 = +12%). */
async function klineMomentum(sym: string, days: number): Promise<number | null> {
  try {
    const map = await currencyMap();
    const row = findCurrency(map, sym);
    if (!row) return null;
    const rows = unwrap<Array<{ close?: number | string; timestamp?: number }>>(
      await call<unknown>(`${V1}/currencies/${row.currency_id}/klines?interval=1d&limit=${days + 1}`),
    );
    if (!Array.isArray(rows) || rows.length < 2) return null;
    const first = Number(rows[0]?.close);
    const last = Number(rows[rows.length - 1]?.close);
    if (!first || !last) return null;
    return +(last / first - 1).toFixed(4);
  } catch {
    return null;
  }
}

/**
 * Normalize a change field to a FRACTION (0.034 = +3.4%). Live responses
 * report fractions; some surfaces report percent numbers (1.82 = +1.82%).
 * Heuristic: |n| > 1 is percent-style (daily index/currency moves above
 * 100% don't realistically occur), else it is already a fraction.
 */
function pctToFraction(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return +(Math.abs(n) > 1 ? n / 100 : n).toFixed(6);
}

// ---------------------------------------------------------------------------
// Rate-limit-aware transport. SoSoValue quotas are tight, and one dashboard
// load fans out to dozens of endpoints — so:
//  - in-memory TTL cache (per server instance) dedupes repeat calls
//  - a 429 trips a global cooldown during which calls fail fast to fallbacks
//  - callers use mapLimit() to cap upstream concurrency
// ---------------------------------------------------------------------------

const memCache = new Map<string, { at: number; data: unknown }>();
let cooldownUntil = 0;

// Hard per-minute rate cap. The Demo plan allows 10 req/min; we self-limit to
// 8 to leave headroom, so we never trip a 429 that then trips the cooldown.
const RATE_MAX_PER_MIN = 8;
let rateWindow: number[] = [];
function underRateCap(): boolean {
  const now = Date.now();
  rateWindow = rateWindow.filter((t) => now - t < 60_000);
  if (rateWindow.length >= RATE_MAX_PER_MIN) return false;
  rateWindow.push(now);
  return true;
}

function ttlFor(path: string): number {
  // Longer TTLs to conserve the SoSoValue monthly quota — the movers tile
  // fires ~18 per-symbol market-snapshot calls, so short windows exhaust the
  // plan fast. Prices/indices for a 24h tile don't need minute-fresh data.
  if (path.includes("/currencies") && !path.includes("market-snapshot") && !path.includes("klines")) {
    return 6 * 60 * 60_000; // symbol list: 6h (rarely changes)
  }
  if (path.includes("klines")) return 60 * 60_000; // momentum inputs: 1h
  if (path.includes("/news")) return 30 * 60_000; // headlines: 30m
  if (path.includes("/index")) return 30 * 60_000; // SSI list: 30m
  return 15 * 60_000; // snapshots: 15m
}

/** Run `fn` over items with at most `limit` in flight. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const key = process.env.SOSOVALUE_API_KEY;
  if (!key) throw new Error("SOSOVALUE_API_KEY not set");

  const cached = memCache.get(path);
  if (cached && Date.now() - cached.at < ttlFor(path)) {
    return cached.data as T;
  }
  // Stale-on-error: a last-good response beats a seed fallback, always.
  const stale = cached ? (cached.data as T) : undefined;
  if (Date.now() < cooldownUntil) {
    if (stale !== undefined) return stale;
    throw new Error("SoSoValue rate-limit cooldown — serving fallbacks");
  }
  // Self-imposed per-minute cap: prefer stale/fallback over a 429.
  if (!underRateCap()) {
    if (stale !== undefined) return stale;
    throw new Error("SoSoValue local rate cap reached — serving fallbacks");
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "x-soso-api-key": key,
        ...(init?.headers ?? {}),
      },
      ...({ next: { revalidate: 30 } } as Record<string, unknown>),
    } as RequestInit);
  } catch (err) {
    if (stale !== undefined) return stale;
    throw err;
  }
  if (!res.ok) {
    if (res.status === 429) {
      cooldownUntil = Date.now() + 60_000;
    }
    if (stale !== undefined) return stale;
    throw new Error(`SoSoValue ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as T;
  memCache.set(path, { at: Date.now(), data });
  return data;
}

/**
 * Normalize an unknown news item from any SoSoValue endpoint into our
 * NewsItem shape. We accept many field-name variants because the docs and
 * production responses diverge.
 */
function stripHtml(input: unknown): string {
  return String(input ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeNewsItem(it: any): NewsItem | null {
  if (!it || !(it.title || it.headline || it.name)) return null;
  const matched = (it.matched_currencies ?? it.relatedTickers ?? it.currencies ?? it.tokens ?? it.tags ?? [])
    .map((c: any) => (typeof c === "string" ? c : c?.symbol ?? c?.ticker ?? ""))
    .filter(Boolean)
    .map((c: string) => c.toUpperCase());
  return {
    id: String(it.id ?? it.newsId ?? it.uid ?? it.url ?? Math.random()),
    title: stripHtml(it.title ?? it.headline ?? it.name),
    summary: stripHtml(it.summary ?? it.description ?? it.brief ?? it.content ?? "").slice(0, 280),
    source: it.author ?? it.source ?? it.mediaName ?? it.publisher ?? it.media_info?.name ?? "SoSoValue",
    publishedAt:
      it.release_time ?? it.publishTime ?? it.publishedAt ?? it.createTime ?? it.timestamp ?? new Date().toISOString(),
    sentiment: typeof it.sentiment === "number" ? it.sentiment : undefined,
    tickers: matched,
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
      // Live API wants pageNum/pageSize (its 400 says so); pageSize min 20.
      path: `${V1}/news/featured?${new URLSearchParams({
        pageNum: "1",
        pageSize: String(Math.max(20, pageSize)),
      })}`,
      pick: (r) => r?.data?.list ?? r?.data?.items ?? r?.list ?? r?.data ?? r ?? [],
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
      // Documented endpoint (SoSoValue API docs).
      path: `${V1}/etfs/summary-history?${new URLSearchParams({
        symbol: upper,
        country_code: "US",
        limit: "60",
      })}`,
      pick: (r) => r?.data?.list ?? r?.data ?? r?.list ?? r ?? [],
    },
  ];


  for (const c of candidates) {
    try {
      const raw = await call<any>(c.path);
      const rows = c.pick(raw) ?? [];
      if (!Array.isArray(rows) || rows.length === 0) continue;
      let cum = 0;
      const out: FlowDatum[] = rows.map((it: any) => {
        const inflow = Number(it.total_net_inflow ?? it.netInflow ?? it.netFlow ?? it.totalNetInflow ?? it.dailyNetInflow ?? 0);
        cum += inflow;
        return {
          symbol: upper,
          date: it.date ?? it.tradingDay ?? it.timestamp ?? "",
          netInflowUsd: inflow,
          cumulativeUsd: Number(it.cum_net_inflow ?? cum),
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

/** "ssimag7" → "MAG7.ssi" for display; pass through already-styled symbols. */
function ssiDisplaySymbol(ticker: string): string {
  if (ticker.toLowerCase().endsWith(".ssi")) return ticker;
  const bare = ticker.toLowerCase().startsWith("ssi") ? ticker.slice(3) : ticker;
  return `${bare.toUpperCase()}.ssi`;
}

export async function listSsiIndexes(): Promise<SsiIndex[]> {
  if (useMocks()) return MOCK_SSI_LIBRARY;
  // Documented endpoints: GET /indices → bare ticker array; per-ticker
  // market snapshots carry price + 24h change (percent).
  try {
    const tickers = unwrap<string[]>(await call<unknown>(`${V1}/indices`));
    if (Array.isArray(tickers) && tickers.length > 0 && typeof tickers[0] === "string") {
      const subset = tickers.slice(0, 12);
      const rows = await mapLimit(subset, 3, async (t): Promise<SsiIndex | null> => {
          try {
            const snap = unwrap<Record<string, unknown>>(
              await call<unknown>(`${V1}/indices/${t}/market-snapshot`),
            );
            return {
              symbol: ssiDisplaySymbol(t),
              name: ssiDisplaySymbol(t).replace(".ssi", " SSI"),
              changePct: pctToFraction(snap?.["24h_change_pct"] ?? snap?.change_pct_24h ?? 0),
              constituents: [],
            };
          } catch {
            return null;
          }
        });
      const live = rows.filter((x): x is SsiIndex => Boolean(x));
      if (live.length > 0) return live;
    }
  } catch (e) {
    if (process.env.MOSAIC_DEBUG_SODEX === "1") {
      console.warn("[sosovalue] /indices failed:", (e as Error).message);
    }
  }
  // Legacy path, then mocks.
  try {
    const raw = await call<{ data: { list: any[] } }>(`/api/v1/index/list`);
    const rows = (raw.data?.list ?? []).map((idx: any) => ({
      symbol: idx.symbol,
      name: idx.name ?? idx.symbol,
      description: idx.description,
      changePct: Number(idx.changePct ?? idx.change24h ?? 0),
      constituents: (idx.composition ?? idx.constituents ?? []).map((c: any) => ({
        symbol: c.symbol,
        weight: Number(c.weight),
      })),
    }));
    if (rows.length > 0) return rows;
  } catch {
    /* fall through */
  }
  console.warn("[sosovalue] listSsiIndexes fell back to mocks");
  return MOCK_SSI_LIBRARY;
}

export async function getSsiIndex(symbol: string): Promise<SsiIndex | null> {
  const mock = MOCK_SSI_LIBRARY.find((s) => s.symbol.toLowerCase() === symbol.toLowerCase()) ?? null;
  if (useMocks()) return mock;
  // Documented constituents endpoint (composition needed for basket building).
  const ticker = symbol.toLowerCase().endsWith(".ssi")
    ? `ssi${symbol.slice(0, -4).toLowerCase()}`
    : symbol;
  try {
    const rows = unwrap<Array<{ symbol?: string; ticker?: string; weight?: number | string }>>(
      await call<unknown>(`${V1}/indices/${ticker}/constituents`),
    );
    if (Array.isArray(rows) && rows.length > 0) {
      const constituents = rows
        .map((c) => ({
          symbol: String(c.symbol ?? c.ticker ?? "").toUpperCase(),
          weight: Number(c.weight ?? 0) > 1 ? Number(c.weight) / 100 : Number(c.weight ?? 0),
        }))
        .filter((c) => c.symbol && c.weight > 0);
      if (constituents.length > 0) {
        return {
          symbol: ssiDisplaySymbol(ticker),
          name: `${ssiDisplaySymbol(ticker).replace(".ssi", "")} SSI`,
          changePct: mock?.changePct,
          constituents,
        };
      }
    }
  } catch {
    /* fall through to legacy + mock */
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
    return mock;
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
  // Documented path first: live price + market cap from the market snapshot,
  // 30d momentum from daily klines, qualitative fields (sentiment, vol,
  // liquidity, themes) from the curated seed row — no API source for those.
  try {
    const snap = await marketSnapshot(sym);
    const price = Number(snap?.price);
    if (snap && Number.isFinite(price) && price > 0) {
      const momentum = await klineMomentum(sym, 30);
      return {
        symbol: sym,
        name: fallback?.name ?? sym,
        price,
        marketCap: Number(snap.marketcap ?? fallback?.marketCap ?? 0),
        momentum30d: momentum ?? fallback?.momentum30d ?? 0,
        sentiment: fallback?.sentiment ?? 0,
        volatility: fallback?.volatility ?? 0.6,
        liquidityScore: fallback?.liquidityScore ?? 0.5,
        themes: fallback?.themes ?? [],
      };
    }
  } catch (e) {
    if (process.env.MOSAIC_DEBUG_SODEX === "1") {
      console.warn(`[sosovalue] snapshot metrics for ${sym} failed:`, (e as Error).message);
    }
  }
  // Legacy /api/v1/token path removed — confirmed 404 on the live API; the
  // curated seed row is the fallback when snapshots are unavailable.
  return fallback;
}

export async function getCandidateUniverse(allowed?: Set<string>): Promise<TokenMetrics[]> {
  // SEED metrics only — ZERO SoSoValue calls. Candidate scoring uses
  // momentum30d / sentiment / volatility / liquidityScore, all curated seed
  // fields. Fetching them live cost ~1-2 SoSoValue calls PER TOKEN per build
  // (31+ tokens) — impossible under the Demo plan (10k/month · 10/min); a
  // single build blew the per-minute limit and ~0.5% of the month. Live
  // prices for the visible tiles come from SoDEX (free); execution prices
  // from the SoDEX orderbook. `allowed` restricts to tradable markets so the
  // agent never proposes an unlisted leg (e.g. MKR on mainnet).
  let symbols = Object.keys(MOCK_TOKENS);
  if (allowed && allowed.size > 0) {
    symbols = symbols.filter((s) => allowed.has(s.toUpperCase()));
  }
  return symbols
    .map((s) => mockMetricsFor(s))
    .filter((x): x is TokenMetrics => Boolean(x));
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

  const results = await mapLimit(upper, 4, async (s): Promise<LivePrice | null> => {
      // Documented path: /currencies/{id}/market-snapshot.
      try {
        const snap = await marketSnapshot(s);
        const price = Number(snap?.price);
        if (snap && Number.isFinite(price) && price > 0) {
          return {
            symbol: s,
            name: seedPrice(s)?.name ?? s,
            price,
            changePct24h: pctToFraction(snap.change_pct_24h ?? (snap as any)["24h_change_pct"] ?? 0),
            source: "sosovalue",
          };
        }
      } catch (e) {
        if (process.env.MOSAIC_DEBUG_SODEX === "1") {
          console.warn(`[sosovalue] market-snapshot for ${s} failed:`, (e as Error).message);
        }
      }
      return seedPrice(s);
    });

  const out = results.filter((x): x is LivePrice => Boolean(x));
  return out.length > 0 ? out : seedRows;
}
