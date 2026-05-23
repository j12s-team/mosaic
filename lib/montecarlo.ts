// Monte Carlo simulator.
//
// Bootstrap N paths × horizonDays days from the *observed* daily-return
// distribution of the basket (which we get by running the same portfolio-
// return computation as backtest.ts over a longer sample window). Bootstrap
// is preferred over a Normal/Gaussian fit because crypto return distributions
// are heavy-tailed — Normal underestimates tail risk badly.

import type { Basket } from "./types";
import { getDailyReturns } from "./historical";

export interface MonteCarloPath {
  step: number; // 0..horizonDays
  p10: number;
  p50: number;
  p90: number;
}

export interface MonteCarloResult {
  basketId: string;
  paths: number;
  horizonDays: number;
  fan: MonteCarloPath[];
  terminalDistribution: number[]; // terminal values (multiples of 1)
  histogram: Array<{ x: number; count: number }>; // binned terminal values
  varPct95: number;       // 95% VaR — return at the 5th percentile (negative)
  cvarPct95: number;      // 95% CVaR / expected shortfall
  probLossPct: number;    // chance terminal < 1
  expectedTerminal: number;
  medianTerminal: number;
}

function sampleObservedReturns(basket: Basket, sampleSize: number): number[] {
  // Same daily-rebalance composite-return calc as backtest.ts but inlined to
  // avoid a circular import.
  const weights = basket.constituents.map((c) => ({ symbol: c.symbol, weight: c.weight }));
  const series: number[][] = weights.map((w) => getDailyReturns(w.symbol, sampleSize));
  const out: number[] = [];
  for (let t = 0; t < sampleSize; t++) {
    let simple = 0;
    for (let i = 0; i < weights.length; i++) {
      simple += weights[i].weight * (Math.exp(series[i][t]) - 1);
    }
    out.push(Math.log(1 + simple));
  }
  return out;
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function monteCarlo(
  basket: Basket,
  opts: { paths?: number; horizonDays?: number; seedSampleDays?: number } = {},
): MonteCarloResult {
  const paths = opts.paths ?? 1000;
  const horizon = opts.horizonDays ?? 30;
  const sample = sampleObservedReturns(basket, opts.seedSampleDays ?? 180);

  // Generate paths. We use a Lehmer-style PRNG with a fixed seed for reproducibility.
  let s = 0xdeadbeef ^ paths ^ horizon;
  const rand = () => {
    s = Math.imul(s ^ (s >>> 15), 2246822507);
    s = Math.imul(s ^ (s >>> 13), 3266489909);
    return ((s ^= s >>> 16) >>> 0) / 4294967296;
  };

  // Each path is an array of equity multiples per step (length = horizon + 1, starts at 1)
  const equityMatrix: number[][] = Array.from({ length: paths }, () => [1]);
  const terminal: number[] = [];

  for (let p = 0; p < paths; p++) {
    let v = 1;
    for (let d = 0; d < horizon; d++) {
      const r = sample[Math.floor(rand() * sample.length)];
      v *= Math.exp(r);
      equityMatrix[p].push(v);
    }
    terminal.push(v);
  }

  // Build fan chart — at each step, percentiles across paths
  const fan: MonteCarloPath[] = [];
  for (let d = 0; d <= horizon; d++) {
    const col = equityMatrix.map((path) => path[d]).sort((a, b) => a - b);
    fan.push({
      step: d,
      p10: +percentile(col, 10).toFixed(4),
      p50: +percentile(col, 50).toFixed(4),
      p90: +percentile(col, 90).toFixed(4),
    });
  }

  // Sort terminals once for percentile calcs
  const sortedTerminal = [...terminal].sort((a, b) => a - b);

  // VaR(95%) = 5th-percentile terminal value (in return %)
  const var95Terminal = percentile(sortedTerminal, 5);
  const varPct95 = +((var95Terminal - 1) * 100).toFixed(2);

  // CVaR = mean of returns ≤ VaR threshold
  const tail = sortedTerminal.filter((v) => v <= var95Terminal);
  const cvarTerminal = tail.length ? tail.reduce((a, b) => a + b, 0) / tail.length : var95Terminal;
  const cvarPct95 = +((cvarTerminal - 1) * 100).toFixed(2);

  const probLoss = sortedTerminal.filter((v) => v < 1).length / sortedTerminal.length;
  const expectedTerminal = sortedTerminal.reduce((a, b) => a + b, 0) / sortedTerminal.length;
  const medianTerminal = percentile(sortedTerminal, 50);

  // Build histogram — 20 bins between min and max terminal
  const minT = sortedTerminal[0];
  const maxT = sortedTerminal[sortedTerminal.length - 1];
  const bins = 20;
  const width = (maxT - minT) / bins || 1e-6;
  const histogram = Array.from({ length: bins }, (_, i) => ({
    x: +(minT + width * (i + 0.5)).toFixed(4),
    count: 0,
  }));
  for (const v of sortedTerminal) {
    const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - minT) / width)));
    histogram[idx].count += 1;
  }

  return {
    basketId: basket.id,
    paths,
    horizonDays: horizon,
    fan,
    terminalDistribution: sortedTerminal.map((v) => +v.toFixed(4)),
    histogram,
    varPct95,
    cvarPct95,
    probLossPct: +(probLoss * 100).toFixed(1),
    expectedTerminal: +expectedTerminal.toFixed(4),
    medianTerminal: +medianTerminal.toFixed(4),
  };
}
