import { NextRequest, NextResponse } from "next/server";
import { dbEnabled, dbGetBasket, dbVerifyChain } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/verify/[basketId]
 *
 * Recomputes the basket's snapshot hash chain and signature set and reports
 * either integrity (with the chain head hash) or the first broken link.
 * Public baskets are verifiable by anyone; private baskets require the
 * owner query param to match.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ basketId: string }> },
) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "persistence disabled" }, { status: 503 });
  }
  const { basketId } = await ctx.params;
  const row = await dbGetBasket(basketId);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const owner = new URL(req.url).searchParams.get("owner")?.toLowerCase();
  if (!row.isPublic && owner !== row.owner) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const verdict = await dbVerifyChain(basketId);
  return NextResponse.json({ basketId, ...verdict });
}
