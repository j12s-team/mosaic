import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { placeOrder } from "@/lib/sodex";

const Leg = z.object({
  market: z.string(),
  side: z.enum(["buy", "sell"]),
  // Allow 0 here so legs that rounded down to a zero weight don't blow up the
  // whole batch — we filter them out below before placing orders.
  notionalUsd: z.number().nonnegative(),
  maxSlippageBps: z.number().int().min(1).max(500).optional(),
});

const Body = z.object({
  basketId: z.string(),
  confirm: z.literal(true),
  legs: z.array(Leg).min(1).max(20),
});

export async function POST(req: NextRequest) {
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    const detail =
      err instanceof z.ZodError
        ? err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ")
        : (err as Error).message;
    return NextResponse.json(
      { error: "Invalid input — explicit confirm flag required", detail },
      { status: 400 }
    );
  }

  const placeable = parsed.legs.filter((l) => l.notionalUsd > 0.01);
  const fills = [] as Array<Awaited<ReturnType<typeof placeOrder>>>;
  for (const leg of placeable) {
    const fill = await placeOrder({
      market: leg.market,
      side: leg.side,
      notionalUsd: leg.notionalUsd,
      type: "limit-ioc",
      maxSlippageBps: leg.maxSlippageBps ?? 50,
    });
    fills.push(fill);
  }

  return NextResponse.json({
    basketId: parsed.basketId,
    fills,
    executedAt: new Date().toISOString(),
  });
}
