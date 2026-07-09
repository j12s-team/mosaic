import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { dbEnabled, dbCloseBasket, dbSetPublic } from "@/lib/db";

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
