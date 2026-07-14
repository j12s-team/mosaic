import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  dbEnabled,
  dbListBaskets,
  dbSaveBasket,
  dbGetSnapshots,
} from "@mosaic/core/db";
import type { SavedBasket, BasketSnapshot } from "@mosaic/core/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// NOTE on auth: owner is the wallet address string, same trust level as the
// existing client-side SIWE session. Real signature-verified ownership lands
// with the mainnet-mandate-execution change.

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("probe")) {
    return NextResponse.json({ enabled: dbEnabled() });
  }
  if (!dbEnabled()) {
    return NextResponse.json({ enabled: false, baskets: [], snapshots: {} });
  }
  const owner = url.searchParams.get("owner");
  if (!owner) {
    return NextResponse.json({ error: "owner required" }, { status: 400 });
  }
  try {
    const rows = await dbListBaskets(owner);
    const snapshots: Record<string, BasketSnapshot[]> = {};
    if (url.searchParams.get("snapshots")) {
      await Promise.all(
        rows.map(async (r) => {
          snapshots[r.record.basket.id] = await dbGetSnapshots(r.record.basket.id);
        }),
      );
    }
    return NextResponse.json({
      enabled: true,
      baskets: rows.map((r) => ({
        record: r.record,
        isPublic: r.isPublic,
        slug: r.slug,
      })),
      snapshots,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "storage unavailable", detail: (err as Error).message },
      { status: 503 },
    );
  }
}

const PostBody = z.object({
  owner: z.string().min(1).max(64),
  record: z.any(),
});

export async function POST(req: NextRequest) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "persistence disabled" }, { status: 503 });
  }
  let parsed;
  try {
    parsed = PostBody.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid input", detail: (err as Error).message },
      { status: 400 },
    );
  }
  const record = parsed.record as SavedBasket;
  if (!record?.basket?.id || !record?.execution) {
    return NextResponse.json({ error: "malformed basket record" }, { status: 400 });
  }
  try {
    await dbSaveBasket(parsed.owner, record);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "save failed", detail: (err as Error).message },
      { status: 503 },
    );
  }
}
