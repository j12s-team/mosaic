import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbEnabled, dbGetPublicBasketBySlug } from "@/lib/db";
import { buildExecutionPlan } from "@/lib/sodex";
import type { Basket } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  slug: z.string().min(1).max(80),
  amountUsd: z.number().min(10).max(10_000_000),
});

/**
 * POST /api/mirror
 *
 * One-click follow-trading: takes a public basket's slug and the visitor's
 * notional, and returns a fresh Basket with IDENTICAL weights scaled to that
 * notional plus a standard SoDEX execution plan — the normal proposal →
 * analysis → confirm-gated execution pipeline takes over from there.
 */
export async function POST(req: NextRequest) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "persistence disabled" }, { status: 503 });
  }
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid input", detail: (err as Error).message },
      { status: 400 },
    );
  }

  const row = await dbGetPublicBasketBySlug(parsed.slug);
  if (!row) {
    return NextResponse.json({ error: "public basket not found" }, { status: 404 });
  }

  const src = row.record.basket;
  const basket: Basket = {
    ...src,
    id: `mirror-${parsed.slug}-${Date.now()}`,
    createdAt: new Date().toISOString(),
    mirroredFrom: src.id,
    thesis: {
      ...src.thesis,
      prompt: `Mirror public basket "${row.record.label ?? parsed.slug}"`,
      amountUsd: parsed.amountUsd,
    },
    reasoning:
      `Mirrored from the public basket "${row.record.label ?? parsed.slug}" ` +
      `(${src.constituents.length} constituents, identical weights, scaled to ` +
      `$${parsed.amountUsd.toLocaleString()}). Original thesis: "${src.thesis.prompt}"`,
  };

  const plan = await buildExecutionPlan({
    basketId: basket.id,
    notionalUsd: parsed.amountUsd,
    legs: basket.constituents.map((c) => ({
      symbol: c.symbol,
      weight: c.weight,
      side: "buy" as const,
    })),
  });

  return NextResponse.json({ basket, plan, mirroredFrom: { id: src.id, slug: parsed.slug } });
}
