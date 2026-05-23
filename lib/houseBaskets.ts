// Pre-seeded house baskets — three Mosaic-built demo baskets with 7 days of
// backdated snapshot history. They populate the MyBaskets panel on first
// visit so judges see a *realised return* chart immediately instead of
// waiting a week for the snapshotter to fill in.
//
// Re-running the seeder is idempotent: we keep the same basketIds and
// upsert. The user's *own* connected-wallet baskets are untouched.

import type { Basket } from "./types";
import {
  HOUSE_OWNER,
  appendSnapshot,
  listBaskets,
  saveBasket,
  type SavedBasket,
} from "./storage";

const SEED_FLAG = "mosaic.house.seeded.v2";

interface HouseSpec {
  basket: Basket;
  notionalUsd: number;
  /** Daily return path (length = 7) used to generate the 7-day snapshot trail. */
  dailyReturns: number[];
}

const SEED_PROMPTS: HouseSpec[] = [
  {
    notionalUsd: 1000,
    dailyReturns: [0.011, -0.004, 0.022, 0.008, -0.006, 0.014, 0.009],
    basket: {
      id: "house-ai-infra",
      createdAt: new Date(Date.now() - 7 * 86400_000).toISOString(),
      thesis: {
        prompt: "AI infrastructure exposure with moderate risk and decent liquidity.",
        amountUsd: 1000,
        risk: "balanced",
      },
      riskScore: 58,
      expectedAnnualVol: 0.72,
      reasoning:
        "Thesis decomposed into 80% ai-infra + 20% depin. Picked 6 constituents by theme fit, momentum, sentiment and SoDEX liquidity. Cap applied: max single weight 35% (balanced). Benchmarked against SoSoValue AI.ssi.",
      benchmark: { symbol: "AI.ssi", name: "AI Infrastructure SSI" },
      constituents: [
        { symbol: "TAO", name: "Bittensor", weight: 0.32, rationale: "80% theme fit • +18.0% 30d momentum • bullish sentiment • adequate liquidity", metrics: { momentum30d: 0.18, sentiment: 0.62, volatility: 0.85, liquidityScore: 0.7 } },
        { symbol: "RNDR", name: "Render", weight: 0.22, rationale: "100% theme fit • +12.0% 30d momentum • bullish sentiment • deep SoDEX liquidity", metrics: { momentum30d: 0.12, sentiment: 0.41, volatility: 0.7, liquidityScore: 0.8 } },
        { symbol: "IO", name: "IO.net", weight: 0.18, rationale: "100% theme fit • +34.0% 30d momentum • bullish sentiment • adequate liquidity", metrics: { momentum30d: 0.34, sentiment: 0.7, volatility: 0.95, liquidityScore: 0.45 } },
        { symbol: "FET", name: "Fetch.ai", weight: 0.14, rationale: "80% theme fit • +9.0% 30d momentum • bullish sentiment • adequate liquidity", metrics: { momentum30d: 0.09, sentiment: 0.33, volatility: 0.78, liquidityScore: 0.65 } },
        { symbol: "AKT", name: "Akash", weight: 0.10, rationale: "100% theme fit • +21.0% 30d momentum • bullish sentiment • thin liquidity (sized down)", metrics: { momentum30d: 0.21, sentiment: 0.55, volatility: 0.75, liquidityScore: 0.5 } },
        { symbol: "HNT", name: "Helium", weight: 0.04, rationale: "20% theme fit • +5.0% 30d momentum • neutral sentiment • adequate liquidity", metrics: { momentum30d: 0.05, sentiment: 0.18, volatility: 0.66, liquidityScore: 0.6 } },
      ],
    },
  },
  {
    notionalUsd: 2500,
    dailyReturns: [0.005, 0.002, -0.008, 0.006, 0.011, -0.003, 0.004],
    basket: {
      id: "house-defi-bluechip",
      createdAt: new Date(Date.now() - 7 * 86400_000).toISOString(),
      thesis: {
        prompt: "DeFi blue chips only. Conservative. Five thousand dollars-ish.",
        amountUsd: 2500,
        risk: "conservative",
      },
      riskScore: 38,
      expectedAnnualVol: 0.55,
      reasoning:
        "Thesis decomposed into 100% defi-bluechip. Selected 4 constituents by theme fit, momentum, sentiment and SoDEX liquidity. Caps applied: max single weight 30% (conservative). Benchmarked against SoSoValue DEFI.ssi.",
      benchmark: { symbol: "DEFI.ssi", name: "DEFI SSI" },
      constituents: [
        { symbol: "ETH", name: "Ethereum", weight: 0.30, rationale: "60% theme fit • +4.0% 30d momentum • bullish sentiment • deep SoDEX liquidity", metrics: { momentum30d: 0.04, sentiment: 0.32, volatility: 0.5, liquidityScore: 1 } },
        { symbol: "UNI", name: "Uniswap", weight: 0.27, rationale: "100% theme fit • -4.0% 30d momentum • neutral sentiment • deep SoDEX liquidity", metrics: { momentum30d: -0.04, sentiment: 0.1, volatility: 0.55, liquidityScore: 0.95 } },
        { symbol: "AAVE", name: "Aave", weight: 0.24, rationale: "100% theme fit • +6.0% 30d momentum • bullish sentiment • deep SoDEX liquidity", metrics: { momentum30d: 0.06, sentiment: 0.25, volatility: 0.6, liquidityScore: 0.9 } },
        { symbol: "MKR", name: "Maker", weight: 0.19, rationale: "100% theme fit • +2.0% 30d momentum • neutral sentiment • deep SoDEX liquidity", metrics: { momentum30d: 0.02, sentiment: 0.15, volatility: 0.58, liquidityScore: 0.85 } },
      ],
    },
  },
  {
    notionalUsd: 1500,
    dailyReturns: [-0.012, 0.018, 0.006, -0.004, 0.025, 0.010, -0.005],
    basket: {
      id: "house-depin",
      createdAt: new Date(Date.now() - 7 * 86400_000).toISOString(),
      thesis: {
        prompt: "Build me a DePIN basket — about $1,500, balanced risk.",
        amountUsd: 1500,
        risk: "balanced",
      },
      riskScore: 67,
      expectedAnnualVol: 0.80,
      reasoning:
        "Thesis decomposed into 100% depin. Picked 4 constituents by theme fit, momentum, sentiment and SoDEX liquidity. Cap applied: max single weight 35% (balanced).",
      constituents: [
        { symbol: "RNDR", name: "Render", weight: 0.33, rationale: "100% theme fit • +12.0% 30d momentum • bullish sentiment • deep SoDEX liquidity", metrics: { momentum30d: 0.12, sentiment: 0.41, volatility: 0.7, liquidityScore: 0.8 } },
        { symbol: "AKT", name: "Akash", weight: 0.27, rationale: "100% theme fit • +21.0% 30d momentum • bullish sentiment • thin liquidity (sized down)", metrics: { momentum30d: 0.21, sentiment: 0.55, volatility: 0.75, liquidityScore: 0.5 } },
        { symbol: "IO", name: "IO.net", weight: 0.23, rationale: "100% theme fit • +34.0% 30d momentum • bullish sentiment • thin liquidity (sized down)", metrics: { momentum30d: 0.34, sentiment: 0.7, volatility: 0.95, liquidityScore: 0.45 } },
        { symbol: "HNT", name: "Helium", weight: 0.17, rationale: "100% theme fit • +5.0% 30d momentum • neutral sentiment • adequate liquidity", metrics: { momentum30d: 0.05, sentiment: 0.18, volatility: 0.66, liquidityScore: 0.6 } },
      ],
    },
  },
];

/**
 * Seed the house namespace if it hasn't been seeded this version. Safe to
 * call from any client component — idempotent on the SEED_FLAG.
 */
export function seedHouseBasketsIfNeeded() {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  if (localStorage.getItem(SEED_FLAG)) return;

  for (const spec of SEED_PROMPTS) {
    const saved: SavedBasket = {
      basket: spec.basket,
      execution: {
        executedAt: spec.basket.createdAt,
        notionalUsd: spec.notionalUsd,
        fills: spec.basket.constituents.map((c) => ({ symbol: c.symbol, price: 0, weight: c.weight })),
      },
      savedAt: spec.basket.createdAt,
      status: "active",
      label: spec.basket.benchmark?.name ?? "House basket",
    };
    saveBasket(HOUSE_OWNER, saved);

    // Backfill 7 daily snapshots so the realised-return sparkline has data.
    let v = spec.notionalUsd;
    for (let i = 0; i < spec.dailyReturns.length; i++) {
      v *= 1 + spec.dailyReturns[i];
      const takenAt = new Date(
        Date.now() - (spec.dailyReturns.length - 1 - i) * 86400_000,
      ).toISOString();
      appendSnapshot(HOUSE_OWNER, {
        basketId: spec.basket.id,
        takenAt,
        marketValueUsd: +v.toFixed(2),
        pnlUsd: +(v - spec.notionalUsd).toFixed(2),
        pnlPct: +((v - spec.notionalUsd) / spec.notionalUsd).toFixed(4),
      });
    }
  }
  localStorage.setItem(SEED_FLAG, "1");
}

/** Re-export so other modules don't need to know the storage key. */
export function houseBasketsSeeded() {
  if (typeof localStorage === "undefined") return false;
  return Boolean(localStorage.getItem(SEED_FLAG));
}

/** For the share page: look up a house basket by id directly. */
export function getHouseBasketById(id: string) {
  return SEED_PROMPTS.find((s) => s.basket.id === id) ?? null;
}

export function getAllHouseBasketIds() {
  return SEED_PROMPTS.map((s) => s.basket.id);
}
