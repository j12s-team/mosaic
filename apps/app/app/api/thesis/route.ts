import { NextRequest, NextResponse } from "next/server";
import { buildBasket } from "@mosaic/core/agent";
import { buildExecutionPlan } from "@mosaic/core/sodex";

import { ThesisRequestSchema as Body } from "@mosaic/core/schemas";

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid input", detail: (err as Error).message },
      { status: 400 }
    );
  }

  const basket = await buildBasket({
    prompt: parsed.prompt,
    amountUsd: parsed.amountUsd,
    risk: parsed.risk,
  });

  // Build execution plan against current SoDEX orderbook (or mock).
  const plan = await buildExecutionPlan({
    basketId: basket.id,
    notionalUsd: parsed.amountUsd,
    legs: basket.constituents.map((c) => ({ symbol: c.symbol, weight: c.weight, side: "buy" })),
  });

  return NextResponse.json({ basket, plan });
}
