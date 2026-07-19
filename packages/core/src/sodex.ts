// SoDEX API client.
// Docs: https://sodex.com/documentation/api/api
//       https://sodex.com/documentation/api/rest-v1/sodex-rest-spot-api
//       https://sodex.com/documentation/api/rest-v1/schema
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
//   - Public read endpoints (markets, orderbook, balances, tickers) are unsigned.
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

// Stablecoin set — these always price at $1 regardless of any ticker.
const STABLES = new Set(["USDC", "USDT", "DAI", "USDE", "USDD", "FDUSD"]);

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

/** "vUSDC" → "USDC", "vBTC" → "BTC". Pass-through if no prefix. */
export function stripV(coin: string): string {
  return coin.startsWith("v") ? coin.slice(1) : coin;
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
  const url = `${baseUrl()}${path}`;
  if (process.env.MOSAIC_DEBUG_SODEX === "1") {
    console.info(`[sodex] GET ${url}`);
  }
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`SoDEX HTTP ${res.status} on ${path}: ${body.slice(0, 200)}`);
  }
  const env = (await res.json()) as SodexEnvelope<T>;
  if (env.code !== 0) {
    throw new Error(`SoDEX code ${env.code} on ${path}: ${env.error ?? "unknown error"}`);
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

/**
 * Base symbols with a LIVE SoDEX market on the current network, derived from
 * the cached tickers (one free call — no SoSoValue quota). Used to keep the
 * agent from proposing unlisted markets (e.g. MKR on mainnet). Returns an
 * empty set on failure or in mock mode so callers stay permissive.
 */
export async function listedBaseSymbols(): Promise<Set<string>> {
  if (useMocks()) return new Set();
  try {
    const rows = await getAllTickers();
    return new Set(
      rows
        .filter((r) => r.lastPrice > 0 && (r.quote ?? "USDC").toUpperCase() === "USDC")
        .map((r) => r.base.toUpperCase()),
    );
  } catch {
    return new Set();
  }
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

// ---------------------------------------------------------------------------
// Tickers — used for USD valuation of balances
// ---------------------------------------------------------------------------

/** SoDEX SpotTicker — 24h rolling window stats. */
interface RawSpotTicker {
  symbol: string;
  lastPx: string;
  openPx?: string;
  highPx?: string;
  lowPx?: string;
  changePct?: number;
  bidPx?: string;
  askPx?: string;
  volume?: string;
}

export interface TickerSummary {
  /** SoDEX wire symbol, e.g. "vBTC_vUSDC" */
  symbol: string;
  /** Display, e.g. "BTC/USDC" */
  display: string;
  base: string;
  quote: string;
  lastPrice: number;
  changePct: number;
}

let TICKER_CACHE: { fetchedAt: number; rows: TickerSummary[] } | null = null;
const TICKER_TTL_MS = 15_000;

/** Pulls all tickers in one round-trip. Cached for 15s server-side. */
export async function getAllTickers(): Promise<TickerSummary[]> {
  if (useMocks()) return mockTickerRows();
  if (TICKER_CACHE && Date.now() - TICKER_CACHE.fetchedAt < TICKER_TTL_MS) {
    return TICKER_CACHE.rows;
  }
  try {
    const raw = await publicGet<RawSpotTicker[]>("/markets/tickers");
    const rows: TickerSummary[] = raw.map((t) => {
      const display = fromSodexSymbol(t.symbol);
      const [base, quote = "USDC"] = display.split("/");
      const lastPrice = Number(t.lastPx) || 0;
      const openPrice = Number(t.openPx) || 0;
      // SoDEX `changePct` units vary between testnet builds — compute the 24h
      // change ourselves from openPx/lastPx so we always know it's a fraction
      // (e.g. 0.0247 = +2.47%). Falls back to the API field only if open is
      // missing or zero.
      let changePct = 0;
      if (openPrice > 0 && lastPrice > 0) {
        changePct = (lastPrice - openPrice) / openPrice;
      } else if (typeof t.changePct === "number" && Math.abs(t.changePct) < 5) {
        // Trust the API field only when it looks like a reasonable fraction.
        changePct = t.changePct;
      }
      return {
        symbol: t.symbol,
        display,
        base,
        quote,
        lastPrice,
        changePct,
      };
    });
    TICKER_CACHE = { fetchedAt: Date.now(), rows };
    return rows;
  } catch (e) {
    console.warn("[sodex] tickers fell back to mocks:", (e as Error).message);
    return mockTickerRows();
  }
}

function mockTickerRows(): TickerSummary[] {
  return Object.entries(MOCK_TOKENS).map(([base, t]) => ({
    symbol: toSodexSymbol(base),
    display: `${base}/USDC`,
    base,
    quote: "USDC",
    lastPrice: t.price,
    changePct: t.momentum30d / 30, // crude daily approx
  }));
}

/** Best USDC-denominated price for a base coin. USDC = 1. */
export function priceOf(base: string, tickers: TickerSummary[]): number {
  const u = base.toUpperCase();
  if (STABLES.has(u)) return 1;
  const exact = tickers.find((t) => t.base.toUpperCase() === u && t.quote.toUpperCase() === "USDC");
  if (exact) return exact.lastPrice;
  // Fallback: anything quoted in USDC
  const any = tickers.find((t) => t.base.toUpperCase() === u);
  return any?.lastPrice ?? 0;
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
// Authenticated writes — EIP-712-signed SoDEX orders (Wave 3)
// ---------------------------------------------------------------------------

export interface PlaceOrderInput {
  market: string;
  side: "buy" | "sell";
  notionalUsd: number;
  /** "ioc" = immediate-or-cancel limit at slippage cap. We never use market orders. */
  type?: "limit-ioc";
  maxSlippageBps?: number;
  /** Build + sign the order but do NOT send it — logs the would-be request. */
  dryRun?: boolean;
  /** Wallet that owns the SoDEX account — used to auto-resolve the numeric
   *  account id via /accounts/{address}/state. */
  ownerAddress?: string;
}

// SoDEX account ids are numeric (uint64). Resolution order: SODEX_ACCOUNT_ID
// env → /accounts/{owner}/state .aid for the connected wallet → same lookup
// for the signing key's own address. Cached per address.
const aidCache = new Map<string, number>();

async function getAccountId(owner?: string): Promise<number> {
  const envId = process.env.SODEX_ACCOUNT_ID;
  if (envId && /^\d+$/.test(envId.trim())) return Number(envId.trim());

  const candidates: string[] = [];
  if (owner) candidates.push(owner);
  if (process.env.SODEX_API_SECRET) {
    const { privateKeyToAddress } = await import("./eip712");
    candidates.push(privateKeyToAddress(process.env.SODEX_API_SECRET));
  }
  for (const addr of candidates) {
    const key = addr.toLowerCase();
    const cached = aidCache.get(key);
    if (cached !== undefined) return cached;
    try {
      const data = await publicGet<Record<string, unknown>>(`/accounts/${addr}/state`);
      const aid = Number(
        (data as { aid?: unknown; accountID?: unknown; account_id?: unknown }).aid ??
          (data as { accountID?: unknown }).accountID ??
          (data as { account_id?: unknown }).account_id,
      );
      if (Number.isFinite(aid) && aid > 0) {
        aidCache.set(key, aid);
        console.info(`[sodex] resolved account id ${aid} for ${addr}`);
        return aid;
      }
    } catch (e) {
      console.warn(`[sodex] account state lookup failed for ${addr}:`, (e as Error).message);
    }
  }
  throw new Error(
    "cannot resolve SoDEX account id — set SODEX_ACCOUNT_ID (numeric) or connect the wallet that owns the SoDEX account",
  );
}

export interface OrderFill {
  orderId: string;
  status: "FILLED" | "PARTIAL" | "REJECTED" | "SIMULATED" | "DRY_RUN" | "SUBMITTED";
  filledNotionalUsd: number;
  avgPrice: number;
  market: string;
  side: "buy" | "sell";
  estPrice?: number;
  estSlippageBps?: number;
  realisedSlippageBps?: number;
  simulated: boolean;
  dryRun?: boolean;
  note?: string;
}

/**
 * Demo mode — the ONLY condition under which fills may be simulated:
 * mocks explicitly forced, or no SoDEX credentials configured (zero-config
 * demo). With credentials present and mocks off, trading is LIVE on the
 * configured network; there is no arming flag and no silent fallback.
 * Returns the human-readable reason, or null when trading is live.
 */
export function demoTradingReason(): string | null {
  if (useMocks()) return "MOSAIC_USE_MOCKS is forcing the mock layer";
  if (!process.env.SODEX_API_KEY || !process.env.SODEX_API_SECRET)
    return "SODEX_API_KEY / SODEX_API_SECRET not configured";
  return null;
}

/** True when confirmed trades place real SoDEX orders. */
export function liveTradingEnabled(): boolean {
  return demoTradingReason() === null;
}

/** @deprecated MOSAIC_REAL_ORDERS no longer gates transport (fix: simulated-
 * as-real bug). Live trading is on whenever credentials exist and mocks are
 * off; MOSAIC_DRY_RUN remains the explicit safety valve. */
export function realOrdersEnabled(): boolean {
  return liveTradingEnabled();
}

/**
 * Sign a SoDEX payload per the documented scheme: EIP-712
 * ExchangeAction{payloadHash, nonce} under domain
 * { name: "spot", version: "1", chainId, verifyingContract: 0x0 },
 * with 0x01 prepended to the 65-byte signature (X-API-Sign).
 * chainId: 286623 mainnet · 138565 testnet (SoDEX API docs).
 */
async function signSodexPayload(payloadJson: string, nonce: number): Promise<string> {
  const { typedDataDigest, signDigest, keccakHex } = await import("./eip712");
  const payloadHash = keccakHex(payloadJson);
  const digest = typedDataDigest(
    {
      name: "spot",
      version: "1",
      chainId: currentNetwork() === "mainnet" ? 286623 : 138565,
      verifyingContract: "0x0000000000000000000000000000000000000000",
    },
    "ExchangeAction",
    [
      { name: "payloadHash", type: "bytes32" },
      { name: "nonce", type: "uint64" },
    ],
    { payloadHash, nonce },
  );
  const sig = signDigest(digest, process.env.SODEX_API_SECRET!);
  return `0x01${sig.slice(2)}`;
}

// Numeric symbol ids + trading filters: /markets/symbols returns SpotSymbol
// rows { id, name, ...precision/filter fields }. Cached 1h; the full row is
// kept so orders can round price/quantity to the market's tick and step.
type SymbolRow = Record<string, unknown> & { id?: number; name?: string; displayName?: string };
let symbolCache: { at: number; map: Map<string, SymbolRow> } | null = null;

async function resolveSymbol(market: string): Promise<SymbolRow> {
  if (!symbolCache || Date.now() - symbolCache.at > 3_600_000) {
    const rows = await publicGet<SymbolRow[]>("/markets/symbols");
    const map = new Map<string, SymbolRow>();
    for (const r of rows ?? []) {
      if (typeof r?.id !== "number") continue;
      if (r.name) map.set(String(r.name).toUpperCase(), r);
      if (r.displayName) map.set(String(r.displayName).toUpperCase(), r);
    }
    symbolCache = { at: Date.now(), map };
  }
  const wire = toSodexSymbol(market).toUpperCase();
  const row = symbolCache.map.get(wire) ?? symbolCache.map.get(market.toUpperCase());
  if (!row) {
    throw new Error(`SoDEX symbol id not found for ${market} (${wire}) — market not listed on ${currentNetwork()}`);
  }
  return row;
}

/** First finite number among row[keys] (accepts numeric strings). */
function pickNum(row: SymbolRow, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = row[k];
    const n = typeof v === "string" || typeof v === "number" ? Number(v) : NaN;
    if (Number.isFinite(n) && n > 0) return n;
  }
  return undefined;
}

/** Price tick + quantity step from symbol metadata (several naming schemes). */
function symbolFilters(row: SymbolRow): { tick: number; step: number } {
  const tick =
    pickNum(row, ["tickSize", "priceTick", "priceStep", "minPriceIncrement"]) ??
    (() => {
      const prec = pickNum(row, ["pricePrecision", "priceScale", "priceDecimals"]);
      return prec !== undefined ? 10 ** -prec : undefined;
    })() ??
    0.01;
  const step =
    pickNum(row, ["stepSize", "qtyStep", "lotSize", "quantityStep", "minQtyIncrement", "baseIncrement"]) ??
    (() => {
      const prec = pickNum(row, ["quantityPrecision", "qtyScale", "qtyPrecision", "quantityDecimals", "baseScale"]);
      return prec !== undefined ? 10 ** -prec : undefined;
    })() ??
    0.0001;
  return { tick, step };
}

function decimalsOf(increment: number): number {
  const s = increment.toExponential();
  const [mant, exp] = s.split("e");
  const mantDecimals = (mant.split(".")[1] ?? "").length;
  return Math.max(0, mantDecimals - Number(exp));
}

/** Snap a value to an increment (floor) and render as a decimal string. */
function snap(value: number, increment: number): string {
  const snapped = Math.floor(value / increment + 1e-9) * increment;
  return snapped.toFixed(decimalsOf(increment));
}

/**
 * Spot batch-order payload — schema per the SoDEX whitepaper
 * (BatchNewOrderRequest / BatchNewOrderItem), confirmed field-by-field by
 * the live validator: accountID + symbolID are uint64, side/type/
 * timeInForce are integer enums (BUY=1 SELL=2 · LIMIT=1 · IOC=3), and
 * price/quantity are decimal strings.
 */
async function buildSpotOrderPayload(args: {
  market: string;
  side: "buy" | "sell";
  quantity: number;
  price: number;
  ownerAddress?: string;
}) {
  const accountID = await getAccountId(args.ownerAddress);
  const row = await resolveSymbol(args.market);
  const { tick, step } = symbolFilters(row);
  const price = snap(args.price, tick);
  const quantity = snap(args.quantity, step);
  if (process.env.MOSAIC_DEBUG_SODEX === "1") {
    console.info(
      `[sodex] ${args.market} meta id=${row.id} tick=${tick} step=${step} → price ${price}, qty ${quantity} | row: ${JSON.stringify(row).slice(0, 400)}`,
    );
  }
  return {
    accountID,
    orders: [
      {
        symbolID: row.id as number,
        clOrdID: `mosaic-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
        side: args.side === "buy" ? 1 : 2, // OrderSideEnum
        type: 1, // OrderTypeEnum.LIMIT
        timeInForce: 3, // TimeInForceEnum.IOC
        quantity,
        price,
      },
    ],
  };
}

/**
 * Diagnostic: is SODEX_API_KEY a trading key registered under `address` on the
 * current network? Hits GET /accounts/{addr}/api-keys?name=… (public read).
 * Returns { registered, count, error? } — used by /api/diag and surfaced in
 * the UI so a key/network mismatch is obvious BEFORE a trade fails.
 */
export async function checkApiKeyRegistered(
  address: string,
): Promise<{ registered: boolean; count: number; keyName: string | null; error?: string }> {
  const keyName = process.env.SODEX_API_KEY ?? null;
  if (!keyName) return { registered: false, count: 0, keyName: null, error: "SODEX_API_KEY not set" };
  try {
    const data = await publicGet<unknown>(
      `/accounts/${address}/api-keys?name=${encodeURIComponent(keyName)}`,
    );
    const list = Array.isArray(data) ? data : Array.isArray((data as { keys?: unknown[] })?.keys) ? (data as { keys: unknown[] }).keys : [];
    const match = list.some(
      (k) => typeof k === "object" && k !== null && String((k as { name?: unknown }).name ?? "") === keyName,
    );
    return { registered: match, count: list.length, keyName };
  } catch (e) {
    return { registered: false, count: 0, keyName, error: (e as Error).message };
  }
}

export async function placeOrder(input: PlaceOrderInput): Promise<OrderFill> {
  // Pre-trade estimate from the live orderbook — also the reconciliation
  // baseline for realised-slippage reporting.
  let estPrice = 0;
  let estSlippageBps = 0;
  try {
    const book = await getOrderbook(input.market);
    const est = estimateFill(book, input.side, input.notionalUsd);
    estPrice = est.avgPrice;
    estSlippageBps = Math.round(est.slippageBps);
  } catch {
    // estimate unavailable — proceed; realised comparison will be partial
  }

  const cap = input.maxSlippageBps ?? 50;

  // DEMO path — explicitly labeled; never reached when credentials exist
  // and mocks are off (see demoTradingReason()).
  if (!liveTradingEnabled()) {
    return {
      orderId: `sim-${Date.now()}`,
      status: "SIMULATED",
      filledNotionalUsd: input.notionalUsd,
      avgPrice: estPrice,
      market: input.market,
      side: input.side,
      estPrice,
      estSlippageBps,
      realisedSlippageBps: estSlippageBps,
      simulated: true,
      note: `DEMO MODE (${demoTradingReason()}) — simulated fill, no real order placed.`,
    };
  }

  // Live path: IOC limit priced at the estimate bumped by the slippage cap.
  const direction = input.side === "buy" ? 1 : -1;
  const limitPrice = +(estPrice * (1 + (direction * cap) / 10_000)).toPrecision(8);
  const quantity = +(input.notionalUsd / limitPrice).toPrecision(8);
  const payload = await buildSpotOrderPayload({
    market: input.market,
    side: input.side,
    quantity,
    price: limitPrice,
    ownerAddress: input.ownerAddress,
  });
  const payloadJson = JSON.stringify(payload);
  const nonce = Date.now();
  const sign = await signSodexPayload(payloadJson, nonce);

  // Surface the auth identity up front so key-name / key-pairing mistakes are
  // obvious in the log: X-API-Key must be the REGISTERED KEY NAME (not a hex
  // public key), and the signer derived from SODEX_API_SECRET must match the
  // public key registered under that name on THIS network.
  {
    const { privateKeyToAddress } = await import("./eip712");
    const signer = process.env.SODEX_API_SECRET
      ? privateKeyToAddress(process.env.SODEX_API_SECRET)
      : "(no SODEX_API_SECRET)";
    console.info(
      `[sodex] auth: network=${currentNetwork()} keyName="${process.env.SODEX_API_KEY}" signer=${signer}`,
    );
  }

  if (input.dryRun || process.env.MOSAIC_DRY_RUN === "1") {
    console.info(`[sodex] DRY RUN — would POST /trade/orders/batch: ${payloadJson}`);
    return {
      orderId: `dry-${nonce}`,
      status: "DRY_RUN",
      filledNotionalUsd: 0,
      avgPrice: 0,
      market: input.market,
      side: input.side,
      estPrice,
      estSlippageBps,
      simulated: false,
      dryRun: true,
      note: "Dry run — order built and EIP-712-signed but not sent.",
    };
  }

  console.info(`[sodex] LIVE ORDER → POST ${baseUrl()}/trade/orders/batch ${payloadJson}`);
  const res = await fetch(`${baseUrl()}/trade/orders/batch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": process.env.SODEX_API_KEY!,
      "X-API-Sign": sign,
      "X-API-Nonce": String(nonce),
    },
    body: payloadJson,
    cache: "no-store",
  });
  const bodyText = await res.text();
  console.info(`[sodex] LIVE ORDER ← HTTP ${res.status}: ${bodyText.slice(0, 300)}`);
  if (!res.ok) {
    throw new Error(`SoDEX order HTTP ${res.status}: ${bodyText.slice(0, 300)}`);
  }
  let env: SodexEnvelope<Record<string, unknown>>;
  try {
    env = JSON.parse(bodyText);
  } catch {
    throw new Error(`SoDEX order: unparseable response: ${bodyText.slice(0, 200)}`);
  }
  if (env.code !== 0) {
    const msg = String(env.error ?? "unknown error");
    // "API key not found" (code -1) is a CREDENTIAL/REGISTRATION problem, not
    // a signing one — the gateway rejects the X-API-Key value before checking
    // the signature. Give the operator the exact remedy (SoDEX docs:
    // /accounts/{addr}/api-keys). The SoDEX *trading* key is created in the
    // SoDEX app under your wallet on THIS network — it is NOT the SoSoValue
    // market-data key that powers the read side.
    if (env.code === -1 || /api key not found|key not found|invalid api key/i.test(msg)) {
      throw new Error(
        `SoDEX order code ${env.code}: ${msg}. ` +
          `SODEX_API_KEY must be the NAME of a trading API key registered under your ` +
          `wallet on SoDEX ${currentNetwork()} (create it in the SoDEX app → API keys, ` +
          `not the SoSoValue market-data key). Verify with GET ` +
          `${baseUrl()}/accounts/{yourWallet}/api-keys?name=${process.env.SODEX_API_KEY}`,
      );
    }
    throw new Error(`SoDEX order code ${env.code}: ${msg}`);
  }

  // Parse fill info defensively — exact response shape verified at live-run.
  const d = (env.data ?? {}) as Record<string, unknown>;
  const first = Array.isArray((d as { orders?: unknown[] }).orders)
    ? ((d as { orders: Record<string, unknown>[] }).orders[0] ?? {})
    : d;
  const avgPrice = Number(first.avgPrice ?? first.price ?? 0) || 0;
  const filledQty = Number(first.cumQty ?? first.filledQuantity ?? first.quantity ?? 0) || 0;
  const filledNotionalUsd = avgPrice > 0 ? +(avgPrice * filledQty).toFixed(2) : 0;
  const realisedSlippageBps =
    avgPrice > 0 && estPrice > 0
      ? Math.round(Math.abs(avgPrice / estPrice - 1) * 10_000) + estSlippageBps * 0
      : undefined;
  const fullyFilled = filledNotionalUsd >= input.notionalUsd * 0.99;

  const orderId = String(first.orderID ?? first.orderId ?? first.clOrdID ?? `sodex-${nonce}`);
  const explicitlyRejected = /reject/i.test(String(first.status ?? first.ordStatus ?? ""));
  return {
    orderId,
    status: explicitlyRejected
      ? "REJECTED"
      : filledNotionalUsd <= 0
        ? "SUBMITTED" // accepted by SoDEX; fill not in immediate response — verify on the venue by orderId
        : fullyFilled
          ? "FILLED"
          : "PARTIAL",
    filledNotionalUsd,
    avgPrice,
    market: input.market,
    side: input.side,
    estPrice,
    estSlippageBps,
    realisedSlippageBps,
    simulated: false,
  };
}

// ---------------------------------------------------------------------------
// Account state — SoDEX balances are a public GET keyed by EVM address
// ---------------------------------------------------------------------------

/** SoDEX SpotBalance per schema: { id, coin, total, locked } */
interface RawSpotBalance {
  id?: number;
  coin: string;     // "vUSDC"
  total: string;    // total balance incl. locked
  locked?: string;
}

interface RawSpotAccountBalances {
  blockTime?: number;
  blockHeight?: number;
  balances: RawSpotBalance[];
}

export interface BalanceRow {
  symbol: string;        // "USDC"
  qty: number;
  lockedQty: number;
  freeQty: number;
  priceUsd: number;
  marketValueUsd: number;
}

/**
 * Fetch raw balances for a wallet, valued in USD via the tickers endpoint.
 * Returns [] if the request fails. USDC priced as $1; others priced via the
 * /markets/tickers feed.
 */
export async function getWalletBalances(userAddress: string): Promise<BalanceRow[]> {
  if (!userAddress) return [];
  if (useMocks()) {
    return MOCK_PORTFOLIO.positions.map((p) => ({
      symbol: p.symbol,
      qty: p.qty,
      lockedQty: 0,
      freeQty: p.qty,
      priceUsd: p.marketValueUsd / Math.max(p.qty, 1e-9),
      marketValueUsd: p.marketValueUsd,
    }));
  }
  try {
    const env = await publicGet<RawSpotAccountBalances>(
      `/accounts/${encodeURIComponent(userAddress)}/balances`,
    );
    const tickers = await getAllTickers();
    const rows: BalanceRow[] = (env.balances ?? []).map((b) => {
      const symbol = stripV(b.coin);
      const total = Number(b.total ?? 0);
      const locked = Number(b.locked ?? 0);
      const priceUsd = priceOf(symbol, tickers);
      return {
        symbol,
        qty: total,
        lockedQty: locked,
        freeQty: Math.max(0, total - locked),
        priceUsd,
        marketValueUsd: total * priceUsd,
      };
    });
    if (process.env.MOSAIC_DEBUG_SODEX === "1") {
      console.info(
        `[sodex] balances(${userAddress}) →`,
        rows.map((r) => `${r.symbol}: ${r.qty} × $${r.priceUsd} = $${r.marketValueUsd.toFixed(2)}`).join(", "),
      );
    }
    return rows;
  } catch (e) {
    console.warn("[sodex] getWalletBalances failed:", (e as Error).message);
    return [];
  }
}

/**
 * Convert wallet balances into PortfolioPosition rows ready for the
 * dashboard. When no wallet is connected we return the mock portfolio so
 * unconnected visitors still see something populated.
 */
export async function getPortfolioPositions(userAddress?: string): Promise<{
  positions: PortfolioPosition[];
  netValueUsd: number;
  source: "mock" | "live";
  walletAddress?: string;
}> {
  if (useMocks() || !userAddress) {
    return {
      positions: MOCK_PORTFOLIO.positions,
      netValueUsd: MOCK_PORTFOLIO.netValueUsd,
      source: "mock",
    };
  }
  const rows = await getWalletBalances(userAddress);
  if (!rows.length) {
    return {
      positions: MOCK_PORTFOLIO.positions,
      netValueUsd: MOCK_PORTFOLIO.netValueUsd,
      source: "mock",
      walletAddress: userAddress,
    };
  }
  const netValueUsd = rows.reduce((s, r) => s + r.marketValueUsd, 0);
  const positions: PortfolioPosition[] = rows
    .map((r) => ({
      symbol: r.symbol,
      name: r.symbol,
      weight: netValueUsd > 0 ? r.marketValueUsd / netValueUsd : 0,
      qty: r.qty,
      costBasisUsd: r.marketValueUsd, // unknown without fill history
      marketValueUsd: r.marketValueUsd,
      pnlUsd: 0,
      pnlPct: 0,
    }))
    // Hide pure-dust positions but keep stable coins even at low values.
    .filter((p) => p.marketValueUsd >= 0.01 || STABLES.has(p.symbol.toUpperCase()))
    .sort((a, b) => b.marketValueUsd - a.marketValueUsd);
  return { positions, netValueUsd, source: "live", walletAddress: userAddress };
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
