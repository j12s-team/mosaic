// SoDEX API client.
// Docs: https://sodex.com/documentation/api/api
//       https://sodex.com/documentation/api/rest-v1/sodex-rest-spot-api
//
// Spot REST gateway:
//   - Testnet: https://testnet-gw.sodex.dev/api/v1/spot
//   - Mainnet: https://mainnet-gw.sodex.dev/api/v1/spot
//
// Symbol convention: SoDEX trades v-asset pairs joined with underscore,
// e.g. "vBTC_vUSDC". Internal Mosaic symbols are bare ("BTC", "ETH", ...),
// so we go through `toSodexSymbol()` at the API boundary.
//
// Authentication:
//   - Public read endpoints (markets, orderbook, balances) are unsigned.
//   - Authenticated writes (place/cancel order) use EIP-712 typed signatures.
//     That signing pipeline is a Wave 3 deliverable — until it's wired the
//     `placeOrder()` path short-circuits to a simulated fill so the demo
//     flow remains complete end-to-end without risking funds.
//
// Response envelope (every endpoint):
//   { code: number, timestamp: number, data: T, error?: string }

import type { ExecutionPlan, OrderbookSnapshot, PortfolioPosition } from "./types";
import { MOCK_PORTFOLIO, MOCK_TOKENS, mockOrderbook } from "./mock";

// ---------------------------------------------------------------------------
// Network + base URL
// ---------------------------------------------------------------------------

function baseUrl() {
  if (process.env.SODEX_BASE_URL) return process.env.SODEX_BASE_URL;
  if (process.env.MOSAIC_NETWORK === "mainnet") {
    return "https://mainnet-gw.sodex.dev/api/v1/spot";
  }
  return "https://testnet-gw.sodex.dev/api/v1/spot";
}

export function currentNetwork(): "testnet" | "mainnet" {
  return process.env.MOSAIC_NETWORK === "mainnet" ? "mainnet" : "testnet";
}

function useMocks() {
  return process.env.MOSAIC_USE_MOCKS === "true";
}

// ---------------------------------------------------------------------------
// Symbol helpers — internal "BTC/USDC" <-> SoDEX "vBTC_vUSDC"
// ---------------------------------------------------------------------------

/** "BTC/USDC" or "BTC" → "vBTC_vUSDC". Already-prefixed inputs pass through. */
export function toSodexSymbol(market: string): string {
  const cleaned = market.replace(/\s+/g, "");
  if (cleaned.includes("_")) return cleaned; // already "vBTC_vUSDC"
  const [base, quote = "USDC"] = cleaned.split("/");
  const b = base.startsWith("v") ? base : `v${base}`;
  const q = quote.startsWith("v") ? quote : `v${quote}`;
  return `${b}_${q}`;
}

/** "vBTC_vUSDC" → "BTC/USDC" for display. */
export function fromSodexSymbol(symbol: string): string {
  if (!symbol.includes("_")) return symbol;
  const [b, q] = symbol.split("_");
  const base = b.startsWith("v") ? b.slice(1) : b;
  const quote = q.startsWith("v") ? q.slice(1) : q;
  return `${base}/${quote}`;
}

// ---------------------------------------------------------------------------
// HTTP transport — unwraps the SoDEX response envelope and surfaces errors
// ---------------------------------------------------------------------------

interface SodexEnvelope<T> {
  code: number;
  timestamp: number;
  data: T;
  error?: string;
}

async function publicGet<T>(path: string): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`SoDEX HTTP ${res.status}: ${await res.text()}`);
  const env = (await res.json()) as SodexEnvelope<T>;
  if (env.code !== 0) {
    throw new Error(`SoDEX code ${env.code}: ${env.error ?? "unknown error"}`);
  }
  return env.data;
}

// ---------------------------------------------------------------------------
// Health ping — used by the dashboard banner
// ---------------------------------------------------------------------------

export async function pingPublic(): Promise<{
  ok: boolean;
  latencyMs: number;
  status?: number;
  error?: string;
}> {
  // The lightest public endpoint we can hit; returns an array of all symbols.
  const url = `${baseUrl()}/markets/symbols`;
  const start = Date.now();
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    return { ok: res.ok, latencyMs: Date.now() - start, status: res.status };
  } catch (e) {
    return { ok: false, latencyMs: Date.now() - start, error: (e as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Public market data
// ---------------------------------------------------------------------------

export interface Market {
  symbol: string;         // Internal display, e.g. "BTC/USDC"
  sodexSymbol: string;    // Wire-format, e.g. "vBTC_vUSDC"
  base: string;           // "BTC"
  quote: string;          // "USDC"
  minNotionalUsd: number;
  tickSize: number;
}

/** SoDEX SpotSymbol — we parse defensively in case the schema evolves. */
interface RawSpotSymbol {
  symbol: string;
  baseAsset?: string;
  quoteAsset?: string;
  base?: string;
  quote?: string;
  minNotional?: string | number;
  tickSize?: string | number;
  status?: string;
}

export async function listMarkets(): Promise<Market[]> {
  if (useMocks()) {
    return Object.keys(MOCK_TOKENS).map((b) => ({
      symbol: `${b}/USDC`,
      sodexSymbol: toSodexSymbol(b),
      base: b,
      quote: "USDC",
      minNotionalUsd: 5,
      tickSize: 0.0001,
    }));
  }
  try {
    const raw = await publicGet<RawSpotSymbol[]>("/markets/symbols");
    return raw
      .filter((m) => !m.status || m.status === "TRADING")
      .map((m) => {
        const sodexSymbol = m.symbol;
        const baseAsset = m.baseAsset ?? m.base ?? "";
        const quoteAsset = m.quoteAsset ?? m.quote ?? "vUSDC";
        const display = fromSodexSymbol(sodexSymbol);
        const [base, quote = "USDC"] = display.split("/");
        return {
          symbol: display,
          sodexSymbol,
          base,
          quote,
          minNotionalUsd: Number(m.minNotional ?? 5),
          tickSize: Number(m.tickSize ?? 0.0001),
        };
      });
  } catch (e) {
    console.warn("[sodex] listMarkets fell back to mocks:", (e as Error).message);
    return Object.keys(MOCK_TOKENS).map((b) => ({
      symbol: `${b}/USDC`,
      sodexSymbol: toSodexSymbol(b),
      base: b,
      quote: "USDC",
      minNotionalUsd: 5,
      tickSize: 0.0001,
    }));
  }
}

/** SoDEX OrderBook — `bids` / `asks` are `[price, size]` string tuples. */
interface RawOrderBook {
  bids: Array<[string, string]>;
  asks: Array<[string, string]>;
}

export async function getOrderbook(market: string): Promise<OrderbookSnapshot> {
  const sodexSymbol = toSodexSymbol(market);
  if (useMocks()) {
    const base = market.split("/")[0].replace(/^v/, "");
    const t = MOCK_TOKENS[base];
    return mockOrderbook(market, t?.price ?? 1);
  }
  try {
    const raw = await publicGet<RawOrderBook>(
      `/markets/${encodeURIComponent(sodexSymbol)}/orderbook?limit=8`,
    );
    const bids = raw.bids.map(([p, s]) => ({ price: +p, size: +s }));
    const asks = raw.asks.map(([p, s]) => ({ price: +p, size: +s }));
    if (!bids.length || !asks.length) throw new Error("empty orderbook");
    const mid = (bids[0].price + asks[0].price) / 2;
    return { market, bids, asks, midPrice: mid, capturedAt: new Date().toISOString() };
  } catch (e) {
    console.warn(`[sodex] depth(${sodexSymbol}) fell back to mocks:`, (e as Error).message);
    const base = market.split("/")[0].replace(/^v/, "");
    const t = MOCK_TOKENS[base];
    return mockOrderbook(market, t?.price ?? 1);
  }
}

/** Walk the orderbook to estimate VWAP fill for a USD notional. */
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

// ---------------------------------------------------------------------------
// Authenticated writes — EIP-712 signing TODO (Wave 3)
// ---------------------------------------------------------------------------

export interface PlaceOrderInput {
  market: string;
  side: "buy" | "sell";
  notionalUsd: number;
  /** "ioc" = immediate-or-cancel limit at slippage cap. We never use market orders. */
  type?: "limit-ioc";
  maxSlippageBps?: number;
}

export async function placeOrder(input: PlaceOrderInput) {
  // Wave 3 TODO: build EIP-712 typed signature.
  //
  // 1. Build the BatchNewOrderRequest payload (compact JSON, struct-order
  //    matching sodex-go-sdk-public).
  // 2. payloadHash = keccak256(json.Marshal(payload)).
  // 3. EIP-712 sign ExchangeAction{payloadHash, nonce} under domain
  //    { name: "spot", version: "1", chainId: 138565 (testnet) or 286623 (mainnet),
  //      verifyingContract: 0x00...00 }.
  // 4. Prepend 0x01 to the 65-byte sig → X-API-Sign.
  // 5. POST ${SPOT_ENDPOINT}/trade/orders/batch with X-API-Key (key name),
  //    X-API-Sign, X-API-Nonce (Unix ms within (T-2d, T+1d)).
  //
  // For Wave 2, every placeOrder returns a simulated fill so the executor UI
  // can still demonstrate the full thesis→execution→portfolio loop without
  // requiring a registered API key + funded testnet wallet.
  return {
    orderId: `sim-${Date.now()}`,
    status: "FILLED" as const,
    filledNotionalUsd: input.notionalUsd,
    avgPrice: 0,
    market: input.market,
    side: input.side,
    simulated: true as const,
    note: "EIP-712 signing pipeline lands in Wave 3. This is a simulated fill.",
  };
}

// ---------------------------------------------------------------------------
// Account state — SoDEX balances are a public GET keyed by EVM address
// ---------------------------------------------------------------------------

interface RawBalanceItem {
  coin?: string;
  asset?: string;
  available?: string | number;
  free?: string | number;
  locked?: string | number;
  total?: string | number;
  valueUsd?: string | number;
}

interface RawSpotBalances {
  balances?: RawBalanceItem[];
  totalValueUsd?: string | number;
}

/**
 * Pulls real balances from SoDEX if a wallet address is provided, otherwise
 * returns the mock portfolio so the dashboard always renders for unconnected
 * visitors. Public endpoint — no signing required.
 */
export async function getPortfolioPositions(userAddress?: string): Promise<PortfolioPosition[]> {
  if (useMocks() || !userAddress) return MOCK_PORTFOLIO.positions;
  try {
    const raw = await publicGet<RawSpotBalances>(
      `/accounts/${encodeURIComponent(userAddress)}/balances`,
    );
    const items = raw.balances ?? [];
    if (!items.length) return MOCK_PORTFOLIO.positions;
    const total =
      Number(raw.totalValueUsd ?? 0) ||
      items.reduce((s, i) => s + Number(i.valueUsd ?? 0), 0) ||
      1;
    return items
      .filter((i) => Number(i.total ?? i.available ?? i.free ?? 0) > 0)
      .map((i) => {
        const symbol = (i.coin ?? i.asset ?? "v?").replace(/^v/, "");
        const qty = Number(i.total ?? i.available ?? i.free ?? 0);
        const marketValueUsd = Number(i.valueUsd ?? 0);
        return {
          symbol,
          name: symbol,
          weight: total > 0 ? marketValueUsd / total : 0,
          qty,
          costBasisUsd: marketValueUsd, // unknown — show flat for now
          marketValueUsd,
          pnlUsd: 0,
          pnlPct: 0,
        };
      });
  } catch (e) {
    console.warn("[sodex] balances fell back to mocks:", (e as Error).message);
    return MOCK_PORTFOLIO.positions;
  }
}

// ---------------------------------------------------------------------------
// Build a multi-leg execution plan using live orderbook data
// ---------------------------------------------------------------------------

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
