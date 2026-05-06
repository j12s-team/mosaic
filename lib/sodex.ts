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

function baseUrl() {
  return process.env.SODEX_BASE_URL ?? "https://api-testnet.sodex.com";
}

function useMocks() {
  return process.env.MOSAIC_USE_MOCKS === "true" || !process.env.SODEX_API_KEY;
}

function sign(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

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
  const raw = await call<{ data: any[] }>("GET", "/v1/public/markets");
  return raw.data.map((m: any) => ({
    symbol: m.symbol,
    base: m.baseAsset,
    quote: m.quoteAsset,
    minNotionalUsd: Number(m.minNotional ?? 5),
    tickSize: Number(m.tickSize ?? 0.0001),
  }));
}

export async function getOrderbook(market: string): Promise<OrderbookSnapshot> {
  if (useMocks()) {
    const base = market.split("/")[0];
    const t = MOCK_TOKENS[base];
    return mockOrderbook(market, t?.price ?? 1);
  }
  const raw = await call<{ data: any }>("GET", `/v1/public/depth?symbol=${encodeURIComponent(market)}&limit=8`);
  const bids = raw.data.bids.map(([p, s]: [string, string]) => ({ price: +p, size: +s }));
  const asks = raw.data.asks.map(([p, s]: [string, string]) => ({ price: +p, size: +s }));
  const mid = (bids[0].price + asks[0].price) / 2;
  return { market, bids, asks, midPrice: mid, capturedAt: new Date().toISOString() };
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
  if (useMocks()) {
    return {
      orderId: `mock-${Date.now()}`,
      status: "FILLED" as const,
      filledNotionalUsd: input.notionalUsd,
      avgPrice: 0,
      market: input.market,
      side: input.side,
    };
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
  if (useMocks()) return MOCK_PORTFOLIO.positions;
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
