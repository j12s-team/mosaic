// Historical price / return seeds for the candidate universe.
//
// We generate deterministic 180d daily returns per token using a seeded PRNG
// so the demo is reproducible (judges who run `npm run dev` twice see the
// same backtest numbers). Each token's return generator is parameterised by
// its annualised vol and a long-run drift consistent with its MOCK metrics.
//
// Production drop-in: replace `getDailyReturns` with a call to SoSoValue's
// `/api/v1/token/{symbol}/history` (when the endpoint exposes 180d daily
// closes) and convert to log returns. The downstream backtest / montecarlo
// / scenario kernels consume the same shape and don't need to change.

import { MOCK_TOKENS } from "./mock";

const HISTORY_LEN = 180;

/** Deterministic seedable PRNG (mulberry32). */
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Box-Muller standard normal from a uniform RNG. */
function gaussian(rng: () => number) {
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Hash a symbol to a stable 32-bit seed. */
function seedFor(symbol: string): number {
  let h = 2166136261;
  for (let i = 0; i < symbol.length; i++) {
    h ^= symbol.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const ANNUAL_DRIFT = {
  bull: 0.55,
  neutral: 0.05,
  bear: -0.35,
} as const;

function regimeForMomentum(m: number): keyof typeof ANNUAL_DRIFT {
  if (m >= 0.1) return "bull";
  if (m <= -0.05) return "bear";
  return "neutral";
}

/**
 * Returns a `length`-long array of daily log returns for `symbol`, generated
 * with a seeded normal-distribution sampler whose mean/vol are anchored to
 * the token's MOCK metrics.
 */
export function getDailyReturns(symbol: string, length = HISTORY_LEN): number[] {
  const t = MOCK_TOKENS[symbol];
  const sigma = (t?.volatility ?? 0.7) / Math.sqrt(365);
  const regime = t ? regimeForMomentum(t.momentum30d) : "neutral";
  const drift = ANNUAL_DRIFT[regime] / 365;
  const rng = mulberry32(seedFor(symbol));
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    out.push(drift + sigma * gaussian(rng));
  }
  return out;
}

/** Daily *log* returns for the benchmark — MAG7.ssi proxy = 0.6·BTC + 0.25·ETH-like + 0.15 large-caps. */
export function getBenchmarkReturns(length = HISTORY_LEN): number[] {
  // We don't have BTC in the universe; use ETH as proxy and assume slightly
  // lower vol than the average altcoin.
  const eth = getDailyReturns("ETH", length);
  const sigmaScale = 0.6;
  return eth.map((r) => r * sigmaScale + 0.0002);
}

/** Daily ISO dates aligned to the returns arrays (most recent last). */
export function getReturnDates(length = HISTORY_LEN): string[] {
  const out: string[] = [];
  const today = new Date();
  for (let i = length - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** Helper: convert log returns to a normalised equity curve starting at 1.0. */
export function logReturnsToEquity(returns: number[]): number[] {
  let v = 1;
  const out: number[] = [1];
  for (const r of returns) {
    v *= Math.exp(r);
    out.push(v);
  }
  return out;
}
