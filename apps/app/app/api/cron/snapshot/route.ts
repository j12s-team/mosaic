import { NextRequest, NextResponse } from "next/server";
import {
  dbEnabled,
  dbListActiveBaskets,
  dbGetSnapshots,
  dbAppendSnapshot,
  dbSaveBasket,
  dbSetPublic,
  dbAudit,
} from "@mosaic/core/db";
import { getLivePrices } from "@mosaic/core/sosovalue";
import { SEED_PROMPTS } from "@mosaic/core/houseBaskets";
import { HOUSE_OWNER, type SavedBasket } from "@mosaic/core/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/cron/snapshot — the server-side snapshotter.
 *
 * Triggered daily by Vercel Cron (which sends `Authorization: Bearer
 * $CRON_SECRET` automatically when the env var is set). Values every active
 * basket from live prices and appends one hash-chained snapshot per basket.
 * Per-basket failures are isolated: one bad basket never aborts the run.
 *
 * Valuation model: value_new = value_prev × Σ wᵢ · (pᵢ_now / pᵢ_prev), using
 * the price map stored on the previous snapshot as the baseline. The first
 * priced snapshot establishes the baseline without moving the value.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!dbEnabled()) {
    return NextResponse.json({ error: "persistence disabled" }, { status: 503 });
  }

  await seedHouseBasketsInDb();

  const baskets = await dbListActiveBaskets();
  const stats = { total: baskets.length, written: 0, skipped: 0, failed: [] as string[] };

  for (const row of baskets) {
    const basketId = row.record.basket.id;
    try {
      const snaps = await dbGetSnapshots(basketId);
      const last = snaps[snaps.length - 1];

      // At most one cron snapshot per ~20h (idempotent against double-fires).
      if (last && Date.now() - new Date(last.takenAt).getTime() < 20 * 3600 * 1000 && last.prices) {
        stats.skipped++;
        continue;
      }

      const weights = new Map(
        row.record.basket.constituents.map((c) => [c.symbol.toUpperCase(), c.weight]),
      );
      const live = await getLivePrices([...weights.keys()]);
      const prices: Record<string, number> = {};
      for (const p of live) prices[p.symbol] = p.price;

      const prevValue = last?.marketValueUsd ?? row.record.execution.notionalUsd;
      const prevPrices = last?.prices;

      let value = prevValue;
      if (prevPrices) {
        let growth = 0;
        let coveredWeight = 0;
        for (const [sym, w] of weights) {
          const p0 = prevPrices[sym];
          const p1 = prices[sym];
          if (p0 && p1) {
            growth += w * (p1 / p0);
            coveredWeight += w;
          }
        }
        // Hold un-priced weight flat; renormalise nothing.
        value = prevValue * (growth + (1 - coveredWeight));
      }

      const notional = row.record.execution.notionalUsd;
      await dbAppendSnapshot(row.owner, {
        basketId,
        takenAt: new Date().toISOString(),
        marketValueUsd: +value.toFixed(2),
        pnlUsd: +(value - notional).toFixed(2),
        pnlPct: +((value - notional) / notional).toFixed(4),
        prices,
      });
      stats.written++;
    } catch (err) {
      stats.failed.push(`${basketId}: ${(err as Error).message}`);
    }
  }

  await dbAudit("cron", "snapshot-run", stats);
  return NextResponse.json({ ok: true, ...stats });
}

/** Idempotent: inserts the three house baskets (public) with their 7-day
 *  backdated, hash-chained history on the first run against an empty DB. */
async function seedHouseBasketsInDb() {
  const existing = await dbListActiveBaskets();
  const have = new Set(existing.map((r) => r.record.basket.id));
  for (const spec of SEED_PROMPTS) {
    if (have.has(spec.basket.id)) continue;
    const record: SavedBasket = {
      basket: spec.basket,
      execution: {
        executedAt: spec.basket.createdAt,
        notionalUsd: spec.notionalUsd,
        fills: spec.basket.constituents.map((c) => ({
          symbol: c.symbol,
          price: 0,
          weight: c.weight,
        })),
      },
      savedAt: spec.basket.createdAt,
      status: "active",
      label: spec.basket.benchmark?.name ?? "House basket",
    };
    await dbSaveBasket(HOUSE_OWNER, record);
    let v = spec.notionalUsd;
    for (let i = 0; i < spec.dailyReturns.length; i++) {
      v *= 1 + spec.dailyReturns[i];
      await dbAppendSnapshot(HOUSE_OWNER, {
        basketId: spec.basket.id,
        takenAt: new Date(
          Date.now() - (spec.dailyReturns.length - 1 - i) * 86400_000,
        ).toISOString(),
        marketValueUsd: +v.toFixed(2),
        pnlUsd: +(v - spec.notionalUsd).toFixed(2),
        pnlPct: +((v - spec.notionalUsd) / spec.notionalUsd).toFixed(4),
      });
    }
    await dbSetPublic(HOUSE_OWNER, spec.basket.id, true);
  }
}
