import { NextRequest, NextResponse } from "next/server";
import { backtestBasket } from "@mosaic/core/backtest";
import { monteCarlo } from "@mosaic/core/montecarlo";
import { runScenarios } from "@mosaic/core/scenarios";
import type { Basket } from "@mosaic/core/types";

export async function POST(req: NextRequest) {
  let body: { basket?: Basket; horizonDays?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.basket || !body.basket.constituents?.length) {
    return NextResponse.json({ error: "basket required" }, { status: 400 });
  }
  const horizon = body.horizonDays ?? 90;

  const backtest = backtestBasket(body.basket, horizon);
  const mc = monteCarlo(body.basket, { paths: 1000, horizonDays: 30 });
  const scenarios = runScenarios(body.basket);

  return NextResponse.json({ backtest, monteCarlo: mc, scenarios });
}
