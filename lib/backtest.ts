// Backtest engine + risk-metrics kernel.
//
// Pure-function: given a basket (constituents + weights) and the historical
// returns matrix, compute everything a judge would expect to see — equity
// curve, drawdown series, Sharpe, Sortino, max DD, beta, win-rate, etc.
//
// All math is log-return based. We rebalance daily back to target weights
// (the closest approximation to how Mosaic's agentic loop maintains the
// basket in production).

import type { Basket } from "./types";
import {
  getBenchmarkReturns,
  getDailyReturns,
  getReturnDates,
  logReturnsToEquity,
} from "./historical";

export interface BacktestPoint {
  date: string;
  equity: number;
  ret: number;
  drawdown: number;
}

export interface BacktestResult {
  basketId: string;
  horizonDays: number;
  totalReturnPct: number;
  annualizedReturnPct: number;
  annualizedVolPct: number;
  sharpe: number;
  sortino: number;
  maxDrawdownPct: number;
  maxDrawdownDate: string;
  beta: number;
  realisedVol30dPct: number;
  winRatePct: number;
  benchmarkTotalReturnPct: number;
  excessReturnPct: number;
  series: BacktestPoint[];
}

const DAYS_PER_YEAR = 365;
const TRADING_DAYS = 365; // crypto trades 7 days/week
const RISK_FREE_ANNUAL = 0.04; // 4% — short-rate proxy
const RISK_FREE_DAILY = RISK_FREE_ANNUAL / DAYS_PER_YEAR;

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function variance(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
}

function stddev(xs: number[]): number {
  return Math.sqrt(variance(xs));
}

function covariance(xs: number[], ys: number[]): number {
  const n = Math.min(xs.length, ys.length);
  if (n < 2) return 0;
  const mx = mean(xs.slice(-n));
  const my = mean(ys.slice(-n));
  let s = 0;
  for (let i = 0; i < n; i++) s += (xs[i] - mx) * (ys[i] - my);
  return s / (n - 1);
}

/** Daily portfolio log-return given target weights and per-token daily log-returns. */
function portfolioDailyReturns(
  weights: Array<{ symbol: string; weight: number }>,
  horizon: number,
): number[] {
  const series: number[][] = weights.map((w) => getDailyReturns(w.symbol, horizon));
  const out: number[] = [];
  for (let t = 0; t < horizon; t++) {
    // Convert each constituent's log return to simple, average with weights,
    // then convert back to log return. This is the correct daily-rebalanced
    // return for a basket where weights are reset each day.
    let simple = 0;
    for (let i = 0; i < weights.length; i++) {
      simple += weights[i].weight * (Math.exp(series[i][t]) - 1);
    }
    out.push(Math.log(1 + simple));
  }
  return out;
}

/**
 * Run a daily-rebalanced backtest over `horizonDays` (default 90).
 */
export function backtestBasket(basket: Basket, horizonDays = 90): BacktestResult {
  const weights = basket.constituents.map((c) => ({ symbol: c.symbol, weight: c.weight }));
  const portRet = portfolioDailyReturns(weights, horizonDays);
  const benchRet = getBenchmarkReturns(horizonDays);
  const dates = getReturnDates(horizonDays);

  const equity = logReturnsToEquity(portRet); // length = horizon + 1
  // Drawdown series
  let peak = equity[0];
  let maxDD = 0;
  let maxDDIdx = 0;
  const series: BacktestPoint[] = [];
  for (let i = 1; i < equity.length; i++) {
    peak = Math.max(peak, equity[i]);
    const dd = equity[i] / peak - 1;
    if (dd < maxDD) {
      maxDD = dd;
      maxDDIdx = i - 1;
    }
    series.push({
      date: dates[i - 1],
      equity: +equity[i].toFixed(6),
      ret: +portRet[i - 1].toFixed(6),
      drawdown: +dd.toFixed(6),
    });
  }

  const totalReturn = equity[equity.length - 1] - 1;
  const meanDaily = mean(portRet);
  const stdDaily = stddev(portRet);
  const annualizedReturn = Math.exp(meanDaily * TRADING_DAYS) - 1;
  const annualizedVol = stdDaily * Math.sqrt(TRADING_DAYS);

  // Sharpe = (annualised excess return) / annualised vol
  const sharpe =
    annualizedVol > 0
      ? (annualizedReturn - RISK_FREE_ANNUAL) / annualizedVol
      : 0;

  // Sortino — downside-only vol
  const downside = portRet.filter((r) => r < RISK_FREE_DAILY).map((r) => r - RISK_FREE_DAILY);
  const downsideStd =
    downside.length > 1
      ? Math.sqrt(downside.reduce((s, x) => s + x * x, 0) / (downside.length - 1)) *
        Math.sqrt(TRADING_DAYS)
      : 0;
  const sortino =
    downsideStd > 0 ? (annualizedReturn - RISK_FREE_ANNUAL) / downsideStd : 0;

  // Beta vs benchmark
  const benchVar = variance(benchRet);
  const beta = benchVar > 0 ? covariance(portRet, benchRet) / benchVar : 0;

  // Realised vol — trailing 30d
  const last30 = portRet.slice(-30);
  const realisedVol30d = stddev(last30) * Math.sqrt(TRADING_DAYS);

  const winRate = portRet.filter((r) => r > 0).length / portRet.length;

  // Benchmark total return over same window
  const benchEquity = logReturnsToEquity(benchRet);
  const benchTotal = benchEquity[benchEquity.length - 1] - 1;

  return {
    basketId: basket.id,
    horizonDays,
    totalReturnPct: +(totalReturn * 100).toFixed(2),
    annualizedReturnPct: +(annualizedReturn * 100).toFixed(2),
    annualizedVolPct: +(annualizedVol * 100).toFixed(2),
    sharpe: +sharpe.toFixed(2),
    sortino: +sortino.toFixed(2),
    maxDrawdownPct: +(maxDD * 100).toFixed(2),
    maxDrawdownDate: dates[maxDDIdx] ?? dates[0],
    beta: +beta.toFixed(2),
    realisedVol30dPct: +(realisedVol30d * 100).toFixed(2),
    winRatePct: +(winRate * 100).toFixed(1),
    benchmarkTotalReturnPct: +(benchTotal * 100).toFixed(2),
    excessReturnPct: +((totalReturn - benchTotal) * 100).toFixed(2),
    series,
  };
}
