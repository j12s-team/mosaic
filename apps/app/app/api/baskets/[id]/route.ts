import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbEnabled, dbCloseBasket, dbSetPublic, dbDeleteBasket } from "@mosaic/core/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  owner: z.string().min(1).max(64),
  action: z.enum(["close", "setPublic"]),
  public: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "persistence disabled" }, { status: 503 });
  }
  const { id } = await ctx.params;
  let parsed;
  try {
    parsed = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid input", detail: (err as Error).message },
      { status: 400 },
    );
  }
  try {
    if (parsed.action === "close") {
      await dbCloseBasket(parsed.owner, id);
      return NextResponse.json({ ok: true });
    }
    const { slug } = await dbSetPublic(parsed.owner, id, parsed.public ?? false);
    return NextResponse.json({ ok: true, slug });
  } catch (err) {
    return NextResponse.json(
      { error: "update failed", detail: (err as Error).message },
      { status: 503 },
    );
  }
}

/** DELETE /api/baskets/[id]?owner=… — permanent, owner-scoped, cascades. */
export async function DELETE(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "persistence disabled" }, { status: 503 });
  }
  const { id } = await ctx.params;
  const owner = new URL(req.url).searchParams.get("owner");
  if (!owner) return NextResponse.json({ error: "owner required" }, { status: 400 });
  try {
    const ok = await dbDeleteBasket(owner, id);
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "not found" }, { status: 404 });
  } catch (err) {
    return NextResponse.json(
      { error: "delete failed", detail: (err as Error).message },
      { status: 503 },
    );
  }
}
