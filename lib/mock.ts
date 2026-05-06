// In-memory mock data so the demo runs end-to-end without live API keys.
// Real clients in `lib/sosovalue.ts` and `lib/sodex.ts` fall back to this when
// MOSAIC_USE_MOCKS=true or a key is missing.

import type {
  FlowDatum,
  NewsItem,
  OrderbookSnapshot,
  PortfolioSnapshot,
  RebalanceProposal,
} from "./types";

export const MOCK_TOKENS: Record<
  string,
  {
    name: string;
    price: number;
    marketCap: number;
    momentum30d: number;
    sentiment: number;
    volatility: number;
    liquidityScore: number;
    themes: string[];
  }
> = {
  TAO: { name: "Bittensor", price: 412, marketCap: 3_500_000_000, momentum30d: 0.18, sentiment: 0.62, volatility: 0.85, liquidityScore: 0.7, themes: ["ai-infra"] },
  RNDR: { name: "Render", price: 7.4, marketCap: 3_100_000_000, momentum30d: 0.12, sentiment: 0.41, volatility: 0.7, liquidityScore: 0.8, themes: ["ai-infra", "depin"] },
  FET: { name: "Fetch.ai", price: 1.65, marketCap: 1_700_000_000, momentum30d: 0.09, sentiment: 0.33, volatility: 0.78, liquidityScore: 0.65, themes: ["ai-infra"] },
  AKT: { name: "Akash", price: 4.2, marketCap: 1_100_000_000, momentum30d: 0.21, sentiment: 0.55, volatility: 0.75, liquidityScore: 0.5, themes: ["ai-infra", "depin"] },
  HNT: { name: "Helium", price: 6.1, marketCap: 1_000_000_000, momentum30d: 0.05, sentiment: 0.18, volatility: 0.66, liquidityScore: 0.6, themes: ["depin"] },
  IO: { name: "IO.net", price: 2.3, marketCap: 600_000_000, momentum30d: 0.34, sentiment: 0.7, volatility: 0.95, liquidityScore: 0.45, themes: ["ai-infra", "depin"] },
  UNI: { name: "Uniswap", price: 9.4, marketCap: 5_600_000_000, momentum30d: -0.04, sentiment: 0.1, volatility: 0.55, liquidityScore: 0.95, themes: ["defi-bluechip"] },
  AAVE: { name: "Aave", price: 152, marketCap: 2_300_000_000, momentum30d: 0.06, sentiment: 0.25, volatility: 0.6, liquidityScore: 0.9, themes: ["defi-bluechip"] },
  MKR: { name: "Maker", price: 2_350, marketCap: 2_100_000_000, momentum30d: 0.02, sentiment: 0.15, volatility: 0.58, liquidityScore: 0.85, themes: ["defi-bluechip", "rwa"] },
  ARB: { name: "Arbitrum", price: 1.05, marketCap: 4_000_000_000, momentum30d: -0.07, sentiment: 0.05, volatility: 0.7, liquidityScore: 0.9, themes: ["l2-scaling"] },
  OP: { name: "Optimism", price: 2.4, marketCap: 2_700_000_000, momentum30d: -0.05, sentiment: 0.08, volatility: 0.7, liquidityScore: 0.88, themes: ["l2-scaling"] },
  ETH: { name: "Ethereum", price: 3_400, marketCap: 410_000_000_000, momentum30d: 0.04, sentiment: 0.32, volatility: 0.5, liquidityScore: 1, themes: ["l2-scaling", "defi-bluechip"] },
  ONDO: { name: "Ondo", price: 1.4, marketCap: 1_900_000_000, momentum30d: 0.22, sentiment: 0.5, volatility: 0.7, liquidityScore: 0.6, themes: ["rwa"] },
  PENDLE: { name: "Pendle", price: 5.6, marketCap: 850_000_000, momentum30d: 0.14, sentiment: 0.4, volatility: 0.75, liquidityScore: 0.55, themes: ["defi-bluechip", "rwa"] },
  WIF: { name: "dogwifhat", price: 2.8, marketCap: 2_800_000_000, momentum30d: -0.18, sentiment: -0.1, volatility: 1.2, liquidityScore: 0.75, themes: ["memes"] },
  PEPE: { name: "Pepe", price: 0.0000088, marketCap: 3_700_000_000, momentum30d: -0.1, sentiment: 0.2, volatility: 1.4, liquidityScore: 0.85, themes: ["memes"] },
};

export const MOCK_NEWS: NewsItem[] = [
  {
    id: "n1",
    title: "Bittensor mainnet upgrade boosts subnet emissions schedule",
    summary:
      "TAO holders approved a tweak that front-loads subnet rewards for the next two epochs. Subnet 8 (price oracles) saw the largest re-stake.",
    source: "SoSoValue Featured",
    publishedAt: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
    sentiment: 0.6,
    tickers: ["TAO"],
  },
  {
    id: "n2",
    title: "US spot ETH ETFs net +$214M, third straight day of inflows",
    summary:
      "BlackRock's ETHA captured 71% of net flow. Cumulative since launch: +$3.1B.",
    source: "SoSoValue ETF Dashboard",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 1.5).toISOString(),
    sentiment: 0.45,
    tickers: ["ETH"],
  },
  {
    id: "n3",
    title: "IO.net partners with major LLM lab for inference burst capacity",
    summary:
      "Network utilization on H100 nodes jumped 38% week-over-week. IO token momentum decoupling from broader DePIN basket.",
    source: "SoSoValue Insights",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    sentiment: 0.7,
    tickers: ["IO"],
  },
  {
    id: "n4",
    title: "Uniswap fee switch back on the agenda",
    summary:
      "Foundation governance forum reignited the proposal. Historically a +10–15% one-week catalyst.",
    source: "SoSoValue Macro",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    sentiment: 0.3,
    tickers: ["UNI"],
  },
  {
    id: "n5",
    title: "Memecoin sector underperforms, WIF -18% over 30 days",
    summary:
      "Liquidity rotating out of Solana memes into AI infra. Sector beta tightening.",
    source: "SoSoValue Research",
    publishedAt: new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString(),
    sentiment: -0.4,
    tickers: ["WIF", "PEPE"],
  },
];

export const MOCK_FLOWS: FlowDatum[] = (() => {
  const out: FlowDatum[] = [];
  let cum = 0;
  for (let i = 6; i >= 0; i--) {
    const inflow = Math.round((Math.random() - 0.3) * 250_000_000);
    cum += inflow;
    out.push({
      symbol: "ETH",
      date: new Date(Date.now() - 1000 * 60 * 60 * 24 * i).toISOString().slice(0, 10),
      netInflowUsd: inflow,
      cumulativeUsd: cum,
    });
  }
  return out;
})();

export function mockOrderbook(market: string, mid: number): OrderbookSnapshot {
  const levels = 8;
  const bids: { price: number; size: number }[] = [];
  const asks: { price: number; size: number }[] = [];
  for (let i = 1; i <= levels; i++) {
    const step = mid * 0.0008 * i;
    bids.push({ price: +(mid - step).toFixed(4), size: +(Math.random() * 30 + 5).toFixed(2) });
    asks.push({ price: +(mid + step).toFixed(4), size: +(Math.random() * 30 + 5).toFixed(2) });
  }
  return { market, bids, asks, midPrice: mid, capturedAt: new Date().toISOString() };
}

export const MOCK_PORTFOLIO: PortfolioSnapshot = {
  basketId: "demo-basket-1",
  thesisPrompt: "I want exposure to AI x crypto infrastructure with moderate risk.",
  netValueUsd: 1_087.5,
  netPnlUsd: 87.5,
  netPnlPct: 0.0875,
  positions: [
    { symbol: "TAO", name: "Bittensor", weight: 0.32, qty: 0.84, costBasisUsd: 320, marketValueUsd: 346.08, pnlUsd: 26.08, pnlPct: 0.0815 },
    { symbol: "RNDR", name: "Render", weight: 0.22, qty: 29.7, costBasisUsd: 220, marketValueUsd: 219.78, pnlUsd: -0.22, pnlPct: -0.001 },
    { symbol: "IO", name: "IO.net", weight: 0.18, qty: 78.3, costBasisUsd: 180, marketValueUsd: 180.09, pnlUsd: 0.09, pnlPct: 0.0005 },
    { symbol: "FET", name: "Fetch.ai", weight: 0.16, qty: 96.97, costBasisUsd: 160, marketValueUsd: 160, pnlUsd: 0, pnlPct: 0 },
    { symbol: "AKT", name: "Akash", weight: 0.12, qty: 28.5, costBasisUsd: 120, marketValueUsd: 119.7, pnlUsd: -0.3, pnlPct: -0.0025 },
  ],
  history: (() => {
    const arr: { t: string; v: number }[] = [];
    let v = 1000;
    for (let i = 30; i >= 0; i--) {
      v = v * (1 + (Math.random() - 0.45) * 0.02);
      arr.push({ t: new Date(Date.now() - 1000 * 60 * 60 * 24 * i).toISOString(), v: +v.toFixed(2) });
    }
    return arr;
  })(),
  pendingProposals: [],
};

export const MOCK_PROPOSAL: RebalanceProposal = {
  id: "p1",
  basketId: "demo-basket-1",
  trigger: "news",
  summary: "Increase TAO weight, trim RNDR — Bittensor emissions catalyst, Render momentum stalling",
  detail:
    "SoSoValue news flagged a TAO subnet emissions upgrade (+0.6 sentiment, 22m ago). Render 30d momentum has decayed from +0.18 to +0.04 with neutral flows. Drift on TAO is +3.1pp above target.",
  changes: [
    { symbol: "TAO", fromWeight: 0.32, toWeight: 0.38, reason: "Catalyst + positive sentiment, lift to 38%" },
    { symbol: "RNDR", fromWeight: 0.22, toWeight: 0.16, reason: "Momentum decay, trim 6pp" },
  ],
  generatedAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  citations: [
    { kind: "news", label: "Bittensor mainnet upgrade boosts subnet emissions" },
    { kind: "metric", label: "RNDR 30d momentum: +0.04 (trailing avg +0.18)" },
    { kind: "flow", label: "AI-infra basket flow +$42M wk-on-wk" },
  ],
};
