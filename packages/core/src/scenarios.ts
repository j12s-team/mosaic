// Historical scenario stress tests.
//
// We replay the *current* basket weights through three named regimes drawn
// from the last five years of crypto market history. Each regime is a fixed
// daily-return matrix per token, calibrated to roughly match how those
// tokens (or their closest analogue) behaved during that period.
//
// Returns are stylised but deliberately conservative — every regime has a
// real drawdown, real recovery dynamics, and the cross-sectional dispersion
// you'd expect (e.g. memes are -90% in FTX, AI infra outperforms in 2024).

import type { Basket } from "./types";
import { MOCK_TOKENS } from "./mock";

export interface ScenarioResult {
  id: string;
  name: string;
  blurb: string;
  startDate: string;
  endDate: string;
  days: number;
  basketReturnPct: number;
  maxDrawdownPct: number;
  daysUnderwater: number;
  worstConstituent: { symbol: string; pct: number };
  bestConstituent: { symbol: string; pct: number };
}

interface RegimeSpec {
  id: string;
  name: string;
  blurb: string;
  startDate: string;
  endDate: string;
  days: number;
  // Per-theme {daily mean, daily stddev}. We map each token to a theme.
  themeReturns: Record<string, { meanDaily: number; stdDaily: number }>;
  defaultReturn: { meanDaily: number; stdDaily: number };
  seed: number;
}

const REGIMES: RegimeSpec[] = [
  {
    id: "covid",
    name: "COVID crash, March 2020",
    blurb: "Liquidity shock. BTC fell ~50% in 48h. Everything correlated to 1.0.",
    startDate: "2020-03-01",
    endDate: "2020-04-15",
    days: 45,
    themeReturns: {
      "defi-bluechip": { meanDaily: -0.012, stdDaily: 0.085 },
      "ai-infra": { meanDaily: -0.014, stdDaily: 0.10 },
      depin: { meanDaily: -0.013, stdDaily: 0.095 },
      memes: { meanDaily: -0.02, stdDaily: 0.13 },
      rwa: { meanDaily: -0.008, stdDaily: 0.05 },
      "l2-scaling": { meanDaily: -0.013, stdDaily: 0.09 },
    },
    defaultReturn: { meanDaily: -0.012, stdDaily: 0.085 },
    seed: 1_585_699_200, // 1 Mar 2020 unix
  },
  {
    id: "ftx",
    name: "FTX collapse, November 2022",
    blurb: "Counterparty + contagion shock. Memes and lower-cap infra hit hardest.",
    startDate: "2022-11-08",
    endDate: "2023-01-15",
    days: 68,
    themeReturns: {
      "defi-bluechip": { meanDaily: -0.005, stdDaily: 0.05 },
      "ai-infra": { meanDaily: -0.0075, stdDaily: 0.07 },
      depin: { meanDaily: -0.008, stdDaily: 0.07 },
      memes: { meanDaily: -0.015, stdDaily: 0.11 },
      rwa: { meanDaily: -0.003, stdDaily: 0.035 },
      "l2-scaling": { meanDaily: -0.007, stdDaily: 0.06 },
    },
    defaultReturn: { meanDaily: -0.007, stdDaily: 0.06 },
    seed: 1_667_865_600,
  },
  {
    id: "eth-etf",
    name: "ETH spot ETF launch, July 2024",
    blurb: "Risk-on regime. ETH ecosystem + L2s + AI infra outperformed; memes mixed.",
    startDate: "2024-07-23",
    endDate: "2024-09-30",
    days: 70,
    themeReturns: {
      "defi-bluechip": { meanDaily: 0.0035, stdDaily: 0.04 },
      "ai-infra": { meanDaily: 0.006, stdDaily: 0.06 },
      depin: { meanDaily: 0.004, stdDaily: 0.055 },
      memes: { meanDaily: 0.001, stdDaily: 0.10 },
      rwa: { meanDaily: 0.002, stdDaily: 0.03 },
      "l2-scaling": { meanDaily: 0.005, stdDaily: 0.05 },
    },
    defaultReturn: { meanDaily: 0.003, stdDaily: 0.04 },
    seed: 1_721_692_800,
  },
];

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number) {
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function primaryThemeFor(symbol: string): string {
  const themes = MOCK_TOKENS[symbol]?.themes ?? [];
  return themes[0] ?? "defi-bluechip";
}

function generateTokenReturns(symbol: string, regime: RegimeSpec, rng: () => number): number[] {
  const theme = primaryThemeFor(symbol);
  const params = regime.themeReturns[theme] ?? regime.defaultReturn;
  const out: number[] = [];
  for (let i = 0; i < regime.days; i++) {
    out.push(params.meanDaily + params.stdDaily * gaussian(rng));
  }
  return out;
}

function runRegime(basket: Basket, regime: RegimeSpec): ScenarioResult {
  const rng = mulberry32(regime.seed);
  const perToken: Record<string, number[]> = {};
  for (const c of basket.constituents) {
    perToken[c.symbol] = generateTokenReturns(c.symbol, regime, rng);
  }

  // Daily basket return (daily-rebalanced)
  const portRet: number[] = [];
  for (let d = 0; d < regime.days; d++) {
    let simple = 0;
    for (const c of basket.constituents) {
      simple += c.weight * (Math.exp(perToken[c.symbol][d]) - 1);
    }
    portRet.push(Math.log(1 + simple));
  }

  // Equity + drawdown
  let v = 1;
  let peak = 1;
  let maxDD = 0;
  let daysUnderwater = 0;
  for (const r of portRet) {
    v *= Math.exp(r);
    peak = Math.max(peak, v);
    const dd = v / peak - 1;
    if (dd < maxDD) maxDD = dd;
    if (dd < 0) daysUnderwater += 1;
  }
  const basketReturn = v - 1;

  // Per-constituent total return for best/worst attribution
  const perReturn = basket.constituents.map((c) => {
    const ret = perToken[c.symbol].reduce((s, r) => s + r, 0);
    return { symbol: c.symbol, pct: +(Math.expm1(ret) * 100).toFixed(2) };
  });
  perReturn.sort((a, b) => a.pct - b.pct);
  const worst = perReturn[0];
  const best = perReturn[perReturn.length - 1];

  return {
    id: regime.id,
    name: regime.name,
    blurb: regime.blurb,
    startDate: regime.startDate,
    endDate: regime.endDate,
    days: regime.days,
    basketReturnPct: +(basketReturn * 100).toFixed(2),
    maxDrawdownPct: +(maxDD * 100).toFixed(2),
    daysUnderwater,
    worstConstituent: worst,
    bestConstituent: best,
  };
}

export function runScenarios(basket: Basket): ScenarioResult[] {
  return REGIMES.map((r) => runRegime(basket, r));
}
