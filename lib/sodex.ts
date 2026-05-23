// SoDEX API client.
// Docs: https://sodex.com/documentation/api/api
//
// Notes:
//   - Testnet base: https://api-testnet.sodex.com  (no whitelist required)
//   - Mainnet base: https://api.sodex.com          (Silver SoPoints OR Buildathon whitelist)
//   - Authenticated POSTs (place order) use HMAC-SHA256 over the request body.
//
// We expose a small surface intentionally — Mosaic only needs:
//   listMarkets / orderbook / placeOrder / portfolio.

import { createHmac } from "node:crypto";
import type { ExecutionPlan, OrderbookSnapshot, PortfolioPosition } from "./types";
import { MOCK_PORTFOLIO, MOCK_TOKENS, mockOrderbook } from "./mock";

/**
 * Pick the SoDEX base URL.
 *
 * Priority: explicit SODEX_BASE_URL > MOSAIC_NETWORK > default (testnet).
 *
 * Wave 2 ships mainnet path env-flagged so demos never accidentally execute
 * real money. Set `MOSAIC_NETWORK=mainnet` *and* deposit collateral per the
 * SoDEX docs to enable.
 */
function baseUrl() {
  if (process.env.SODEX_BASE_URL) return process.env.SODEX_BASE_URL;
  if (process.env.MOSAIC_NETWORK === "mainnet") return "https://api.sodex.com";
  return "https://api-testnet.sodex.com";
}

export function currentNetwork(): "testnet" | "mainnet" {
  return process.env.MOSAIC_NETWORK === "mainnet" ? "mainnet" : "testnet";
}

/** Mocks only kick in when explicitly forced. Public reads no longer require a key. */
function useMocks() {
  return process.env.MOSAIC_USE_MOCKS === "true";
}

/** Authenticated endpoints (place order, positions) require keys. */
function authedOrMock() {
  return useMocks() || !process.env.SODEX_API_KEY;
}

function sign(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

/** Unauthenticated public reads (markets, depth). No keys needed. */
async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`SoDEX ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/** Authenticated calls — orders, positions. */
async function call<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  const key = process.env.SODEX_API_KEY;
  const secret = process.env.SODEX_API_SECRET;
  if (!key || !secret) throw new Error("SODEX_API_KEY / SODEX_API_SECRET not set");

  const ts = Date.now().toString();
  const bodyStr = body ? JSON.stringify(body) : "";
  const signature = sign(secret, `${ts}${method}${path}${bodyStr}`);

  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-SODEX-APIKEY": key,
      "X-SODEX-TIMESTAMP": ts,
      "X-SODEX-SIGNATURE": signature,
    },
    body: bodyStr || undefined,
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`SoDEX ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

/**
 * Lightweight unauthenticated ping — used by the dashboard's health banner
 * to confirm we can actually reach SoDEX (testnet or mainnet) before the
 * user wastes time configuring keys.
 */
export async function pingPublic(): Promise<{ ok: boolean; latencyMs: number; status?: number; error?: string }> {
  const url = `${baseUrl()}/v1/public/markets`;
  const start = Date.now();
  try {
    const res = await fetch(url, { cache: "no-store" });
    return { ok: res.ok, latencyMs: Date.now() - start, status: res.status };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: (e as Error).message };
  }
}

export interface Market {
  symbol: string;        // e.g. "TAO/USDC"
  base: string;          // "TAO"
  quote: string;         // "USDC"
  minNotionalUsd: number;
  tickSize: number;
}

export async function listMarkets(): Promise<Market[]> {
  if (useMocks()) {
    return Object.keys(MOCK_TOKENS).map((b) => ({
      symbol: `${b}/USDC`,
      base: b,
      quote: "USDC",
      minNotionalUsd: 5,
      tickSize: 0.0001,
    }));
  }
  try {
    const raw = await publicGet<{ data: any[] }>("/v1/public/markets");
    return raw.data.map((m: any) => ({
      symbol: m.symbol,
      base: m.baseAsset,
      quote: m.quoteAsset,
      minNotionalUsd: Number(m.minNotional ?? 5),
      tickSize: Number(m.tickSize ?? 0.0001),
    }));
  } catch (e) {
    // If the live endpoint is unreachable we still want the demo to render.
    console.warn("[sodex] listMarkets fell back to mocks:", (e as Error).message);
    return Object.keys(MOCK_TOKENS).map((b) => ({
      symbol: `${b}/USDC`,
      base: b,
      quote: "USDC",
      minNotionalUsd: 5,
      tickSize: 0.0001,
    }));
  }
}

export async function getOrderbook(market: string): Promise<OrderbookSnapshot> {
  if (useMocks()) {
    const base = market.split("/")[0];
    const t = MOCK_TOKENS[base];
    return mockOrderbook(market, t?.price ?? 1);
  }
  try {
    const raw = await publicGet<{ data: any }>(
      `/v1/public/depth?symbol=${encodeURIComponent(market)}&limit=8`,
    );
    const bids = raw.data.bids.map(([p, s]: [string, string]) => ({ price: +p, size: +s }));
    const asks = raw.data.asks.map(([p, s]: [string, string]) => ({ price: +p, size: +s }));
    const mid = (bids[0].price + asks[0].price) / 2;
    return { market, bids, asks, midPrice: mid, capturedAt: new Date().toISOString() };
  } catch (e) {
    console.warn(`[sodex] depth(${market}) fell back to mocks:`, (e as Error).message);
    const base = market.split("/")[0];
    const t = MOCK_TOKENS[base];
    return mockOrderbook(market, t?.price ?? 1);
  }
}

/** Estimate VWAP fill for a USD notional, walking the orderbook. */
export function estimateFill(book: OrderbookSnapshot, side: "buy" | "sell", notionalUsd: number) {
  const ladder = side === "buy" ? book.asks : book.bids;
  let remaining = notionalUsd;
  let totalQty = 0;
  let cost = 0;
  for (const lvl of ladder) {
    const lvlNotional = lvl.price * lvl.size;
    const take = Math.min(remaining, lvlNotional);
    const qty = take / lvl.price;
    totalQty += qty;
    cost += qty * lvl.price;
    remaining -= take;
    if (remaining <= 0) break;
  }
  const avgPrice = totalQty > 0 ? cost / totalQty : book.midPrice;
  const slippageBps = Math.abs((avgPrice / book.midPrice - 1) * 10_000);
  return {
    avgPrice,
    slippageBps,
    filledNotional: notionalUsd - Math.max(0, remaining),
    unfilledNotional: Math.max(0, remaining),
  };
}

export interface PlaceOrderInput {
  market: string;
  side: "buy" | "sell";
  notionalUsd: number;
  /** "ioc" = immediate-or-cancel limit at slippage cap. We never use market orders. */
  type?: "limit-ioc";
  maxSlippageBps?: number;
}

export async function placeOrder(input: PlaceOrderInput) {
  // Hard rule: every place order requires an explicit confirm gate up the stack.
  if (authedOrMock()) {
    return {
      orderId: `mock-${Date.now()}`,
      status: "FILLED" as const,
      filledNotionalUsd: input.notionalUsd,
      avgPrice: 0,
      market: input.market,
      side: input.side,
      simulated: true as const,
    };
  }
  // Refuse mainnet unless explicitly opted in beyond the env flag.
  if (currentNetwork() === "mainnet" && process.env.MOSAIC_ALLOW_MAINNET_ORDERS !== "yes") {
    throw new Error(
      "Mainnet orders disabled. Set MOSAIC_ALLOW_MAINNET_ORDERS=yes to enable after depositing collateral.",
    );
  }
  return call("POST", "/v1/orders", {
    symbol: input.market,
    side: input.side.toUpperCase(),
    type: "LIMIT_IOC",
    quoteOrderQty: input.notionalUsd,
    maxSlippageBps: input.maxSlippageBps ?? 50,
  });
}

export async function getPortfolioPositions(): Promise<PortfolioPosition[]> {
  if (authedOrMock()) return MOCK_PORTFOLIO.positions;
  try {
    const raw = await call<{ data: any[] }>("GET", "/v1/account/positions");
    return raw.data.map((p: any) => ({
      symbol: p.symbol,
      name: p.name ?? p.symbol,
      weight: Number(p.weight ?? 0),
      qty: Number(p.qty),
      costBasisUsd: Number(p.costBasis),
      marketValueUsd: Number(p.marketValue),
      pnlUsd: Number(p.pnl),
      pnlPct: Number(p.pnlPct),
    }));
  } catch (e) {
    console.warn("[sodex] positions fell back to mocks:", (e as Error).message);
    return MOCK_PORTFOLIO.positions;
  }
}

/** Builds a multi-leg execution plan for a basket using live orderbook data. */
export async function buildExecutionPlan(args: {
  basketId: string;
  notionalUsd: number;
  legs: Array<{ symbol: string; weight: number; side?: "buy" | "sell" }>;
}): Promise<ExecutionPlan> {
  const planLegs: ExecutionPlan["legs"] = [];
  let totalSlippageWeighted = 0;

  for (const leg of args.legs) {
    const market = `${leg.symbol}/USDC`;
    const book = await getOrderbook(market);
    const side = leg.side ?? "buy";
    const notional = args.notionalUsd * leg.weight;
    const fill = estimateFill(book, side, notional);
    planLegs.push({
      market,
      side,
      notionalUsd: notional,
      estPrice: fill.avgPrice,
      estSlippageBps: Math.round(fill.slippageBps),
    });
    totalSlippageWeighted += fill.slippageBps * leg.weight;
  }

  return {
    basketId: args.basketId,
    legs: planLegs,
    totalNotionalUsd: args.notionalUsd,
    estTotalSlippageBps: Math.round(totalSlippageWeighted),
    venue: "SoDEX",
  };
}
