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

export async function getFeaturedNews(opts: { currency?: string; pageSize?: number } = {}): Promise<NewsItem[]> {
  if (useMocks()) {
    return opts.currency
      ? MOCK_NEWS.filter((n) => n.tickers?.includes(opts.currency!.toUpperCase()))
      : MOCK_NEWS;
  }
  const params = new URLSearchParams();
  if (opts.currency) params.set("currency", opts.currency);
  params.set("pageSize", String(opts.pageSize ?? 10));
  const raw = await call<{ data: { list: any[] } }>(`/api/v1/news/featured/currency?${params}`);
  return raw.data.list.map((it: any) => ({
    id: String(it.id ?? it.newsId),
    title: it.title,
    summary: it.summary ?? it.description ?? "",
    source: it.source ?? "SoSoValue",
    publishedAt: it.publishTime ?? it.publishedAt,
    sentiment: it.sentiment,
    tickers: it.relatedTickers ?? it.currencies,
    url: it.url,
  }));
}

export async function getEtfFlows(asset: string): Promise<FlowDatum[]> {
  if (useMocks()) {
    return MOCK_FLOWS.map((f) => ({ ...f, symbol: asset.toUpperCase() }));
  }
  const raw = await call<{ data: { list: any[] } }>(`/api/v1/etf/spot/${asset.toLowerCase()}/flow`);
  let cum = 0;
  return raw.data.list.map((it: any) => {
    const inflow = Number(it.netInflow ?? it.netFlow ?? 0);
    cum += inflow;
    return {
      symbol: asset.toUpperCase(),
      date: it.date,
      netInflowUsd: inflow,
      cumulativeUsd: cum,
    };
  });
}

export interface SsiIndex {
  symbol: string; // MAG7.ssi etc
  name: string;
  description?: string;
  constituents: Array<{ symbol: string; weight: number }>;
}

export async function getSsiIndex(symbol: string): Promise<SsiIndex | null> {
  if (useMocks()) {
    if (symbol.toLowerCase() === "mag7.ssi") {
      return {
        symbol: "MAG7.ssi",
        name: "MAG7 Crypto Index",
        description: "The 7 largest crypto assets by liquidity-weighted market cap.",
        constituents: [
          { symbol: "BTC", weight: 0.5 },
          { symbol: "ETH", weight: 0.25 },
          { symbol: "SOL", weight: 0.08 },
          { symbol: "BNB", weight: 0.06 },
          { symbol: "XRP", weight: 0.05 },
          { symbol: "DOGE", weight: 0.03 },
          { symbol: "ADA", weight: 0.03 },
        ],
      };
    }
    return null;
  }
  const raw = await call<{ data: any }>(`/api/v1/index/${symbol}`);
  return {
    symbol: raw.data.symbol,
    name: raw.data.name,
    description: raw.data.description,
    constituents: (raw.data.composition ?? []).map((c: any) => ({
      symbol: c.symbol,
      weight: Number(c.weight),
    })),
  };
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

export async function getTokenMetrics(symbol: string): Promise<TokenMetrics | null> {
  const sym = symbol.toUpperCase();
  if (useMocks()) {
    const m = MOCK_TOKENS[sym];
    if (!m) return null;
    return { symbol: sym, ...m };
  }
  try {
    const raw = await call<{ data: any }>(`/api/v1/token/${sym}/metrics`);
    return {
      symbol: sym,
      name: raw.data.name,
      price: Number(raw.data.price),
      marketCap: Number(raw.data.marketCap),
      momentum30d: Number(raw.data.momentum30d ?? 0),
      sentiment: Number(raw.data.sentiment ?? 0),
      volatility: Number(raw.data.volatility ?? 0.5),
      liquidityScore: Number(raw.data.liquidityScore ?? 0.5),
      themes: raw.data.themes ?? [],
    };
  } catch {
    return null;
  }
}

export async function getCandidateUniverse(): Promise<TokenMetrics[]> {
  // For Buildathon scope, the candidate universe is the tokens we know
  // SoDEX supports. In production this would be /index/list ∪ /token/list.
  const symbols = Object.keys(MOCK_TOKENS);
  const all = await Promise.all(symbols.map((s) => getTokenMetrics(s)));
  return all.filter((x): x is TokenMetrics => Boolean(x));
}
