import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildBasket } from "@/lib/agent";
import { buildExecutionPlan } from "@/lib/sodex";

const Body = z.object({
  prompt: z.string().min(8).max(500),
  amountUsd: z.number().min(10).max(10_000_000),
  risk: z.enum(["conservative", "balanced", "aggressive"]),
});

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
