import { NextRequest, NextResponse } from "next/server";
import { backtestBasket } from "@mosaic/core/backtest";
import { monteCarlo } from "@mosaic/core/montecarlo";
import { runScenarios } from "@mosaic/core/scenarios";
import { BacktestRequestSchema } from "@mosaic/core/schemas";
import type { Basket } from "@mosaic/core/types";

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = BacktestRequestSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid input", detail: (err as Error).message },
      { status: 400 }
    );
  }
  const basket = parsed.basket as unknown as Basket;
  const horizon = parsed.horizonDays ?? 90;

  const backtest = backtestBasket(basket, horizon);
  const mc = monteCarlo(basket, { paths: 1000, horizonDays: 30 });
  const scenarios = runScenarios(basket);

  return NextResponse.json({ backtest, monteCarlo: mc, scenarios });
}
