import { NextRequest, NextResponse } from "next/server";
import { FORBIDDEN, ownerAllowed } from "@/lib/auth";
import { executionFee } from "@mosaic/core/fees";
import { z } from "zod";
import { placeOrder, currentNetwork, liveTradingEnabled, demoTradingReason, type OrderFill } from "@mosaic/core/sodex";
import { validatePlanAgainstMandate } from "@mosaic/core/mandate";
import {
  dbEnabled,
  dbGetMandate,
  dbMandateUtilisation,
  dbKillSwitch,
  dbRecordFill,
  dbCreateProposal,
  dbAudit,
} from "@mosaic/core/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Leg = z.object({
  market: z.string(),
  side: z.enum(["buy", "sell"]),
  // Allow 0 here so legs that rounded down to a zero weight don't blow up the
  // whole batch — we filter them out below before placing orders.
  notionalUsd: z.number().nonnegative(),
  maxSlippageBps: z.number().int().min(1).max(500).optional(),
  estSlippageBps: z.number().int().min(0).max(10_000).optional(),
});

const Body = z.object({
  basketId: z.string(),
  confirm: z.literal(true),
  legs: z.array(Leg).min(1).max(20),
  /** Required on mainnet: the signed mandate authorizing this execution. */
  mandateId: z.string().optional(),
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
  dryRun: z.boolean().optional(),
});

/**
 * POST /api/execute
 *
 * Testnet: permissive (demo path), exactly as before.
 * Mainnet: requires MOSAIC_MAINNET_ENABLED=true AND a valid signed mandate;
 * every plan runs through the server-side policy gate before any order is
 * placed, every decision is audited, and a global env notional cap applies
 * as a second line of defense.
 */
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

  // 5a: a claimed wallet must belong to the verified session (when enforced).
  if (parsed.wallet && !(await ownerAllowed(parsed.wallet))) {
    return NextResponse.json(FORBIDDEN, { status: 403 });
  }

  const placeable = parsed.legs.filter((l) => l.notionalUsd > 0.01);
  const totalNotionalUsd = +placeable.reduce((s, l) => s + l.notionalUsd, 0).toFixed(2);
  const network = currentNetwork();
  const isMainnet = network === "mainnet";
  let mandateId: string | undefined;

  if (isMainnet) {
    // --- Mainnet guardrails -------------------------------------------------
    if (process.env.MOSAIC_MAINNET_ENABLED !== "true") {
      return NextResponse.json(
        { error: "Mainnet execution is not enabled on this deployment (MOSAIC_MAINNET_ENABLED)." },
        { status: 403 },
      );
    }
    if (!dbEnabled()) {
      return NextResponse.json(
        { error: "Mainnet execution requires durable persistence (DATABASE_URL) for mandates and audit." },
        { status: 503 },
      );
    }
    if (!parsed.mandateId || !parsed.wallet) {
      return NextResponse.json(
        { error: "Mainnet execution requires a signed investment mandate. Sign one in the dashboard, then retry with mandateId + wallet." },
        { status: 401 },
      );
    }

    const mandate = await dbGetMandate(parsed.mandateId);
    if (!mandate || mandate.wallet !== parsed.wallet.toLowerCase()) {
      return NextResponse.json({ error: "mandate not found for this wallet" }, { status: 404 });
    }

    const [utilisation, killSwitch] = await Promise.all([
      dbMandateUtilisation(mandate.id),
      dbKillSwitch(),
    ]);

    const verdict = validatePlanAgainstMandate(
      {
        totalNotionalUsd,
        legs: placeable.map((l) => ({
          symbol: l.market.split("/")[0],
          notionalUsd: l.notionalUsd,
          estSlippageBps: l.estSlippageBps ?? l.maxSlippageBps ?? 50,
        })),
      },
      mandate,
      {
        utilisedNotionalUsd: utilisation.filledNotionalUsd,
        lastExecutionAt: utilisation.lastExecutionAt,
        killSwitch,
        nowMs: Date.now(),
      },
    );

    await dbAudit(mandate.wallet, verdict.allowed ? "gate-allow" : "gate-deny", {
      mandateId: mandate.id,
      basketId: parsed.basketId,
      totalNotionalUsd,
      reasons: verdict.reasons,
    });

    if (!verdict.allowed) {
      return NextResponse.json(
        {
          error: "Plan refused by mandate policy gate",
          reasons: verdict.reasons,
          remainingNotionalUsd: verdict.remainingNotionalUsd,
        },
        { status: 403 },
      );
    }

    // Second line of defense, independent of any mandate.
    const globalCap = Number(process.env.MOSAIC_GLOBAL_MAX_NOTIONAL ?? 1000);
    if (totalNotionalUsd > globalCap) {
      await dbAudit(mandate.wallet, "gate-deny", {
        mandateId: mandate.id,
        reasons: [{ rule: "global-cap", detail: `plan $${totalNotionalUsd} exceeds server cap $${globalCap}` }],
      });
      return NextResponse.json(
        { error: `Plan exceeds the server-wide cap of $${globalCap} (MOSAIC_GLOBAL_MAX_NOTIONAL).` },
        { status: 403 },
      );
    }
    mandateId = mandate.id;
  }

  // --- Place orders (per-leg isolation; failures recorded, never retried) ---
  const fills: OrderFill[] = [];
  const legErrors: Array<{ market: string; error: string }> = [];
  for (const leg of placeable) {
    try {
      const fill = await placeOrder({
        market: leg.market,
        side: leg.side,
        notionalUsd: leg.notionalUsd,
        type: "limit-ioc",
        maxSlippageBps: leg.maxSlippageBps ?? 50,
        dryRun: parsed.dryRun,
        ownerAddress: parsed.wallet,
      });
      fills.push(fill);
      if (dbEnabled()) {
        await dbRecordFill({
          basketId: parsed.basketId,
          mandateId,
          orderId: fill.orderId,
          leg: {
            market: fill.market,
            side: fill.side,
            requestedNotionalUsd: leg.notionalUsd,
            filledNotionalUsd: fill.filledNotionalUsd,
            estPrice: fill.estPrice,
            avgPrice: fill.avgPrice,
            estSlippageBps: fill.estSlippageBps,
            realisedSlippageBps: fill.realisedSlippageBps,
            simulated: fill.simulated,
            dryRun: fill.dryRun,
          },
        });
      }
      // Partial IOC fill → record the residual as a fresh proposal, never a
      // silent retry.
      const residual = leg.notionalUsd - fill.filledNotionalUsd;
      if (!fill.simulated && !fill.dryRun && residual > 1 && dbEnabled()) {
        await dbCreateProposal({
          id: `residual-${fill.orderId}`,
          basketId: parsed.basketId,
          mandateId,
          changes: { market: leg.market, side: leg.side, notionalUsd: +residual.toFixed(2), reason: "partial IOC fill residual" },
          vetoWindowHours: 0,
          proposedAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn(`[execute] leg ${leg.market} failed:`, (err as Error).message);
      legErrors.push({ market: leg.market, error: (err as Error).message });
    }
  }

  // Live trading with zero fills is a FAILURE, not a success (fix:
  // simulated-as-real bug). Surface every leg error; never fake a receipt.
  if (liveTradingEnabled() && fills.length === 0 && legErrors.length > 0) {
    return NextResponse.json(
      { error: "No orders were placed — every leg failed at SoDEX.", legErrors, mode: "live" },
      { status: 502 },
    );
  }

  // Fee accounting scaffold (5b groundwork): computes to $0 unless
  // MOSAIC_FEE_BPS is set. Recorded in the audit trail + response so the
  // books exist from day one; no fee is collected anywhere yet.
  const fee = executionFee(totalNotionalUsd);

  if (dbEnabled()) {
    await dbAudit(parsed.wallet ?? "anonymous", "execute", {
      basketId: parsed.basketId,
      network,
      mandateId,
      fills: fills.length,
      errors: legErrors.length,
      dryRun: Boolean(parsed.dryRun),
      feeBps: fee.bps,
      feeUsd: fee.usd,
    });
  }

  return NextResponse.json({
    basketId: parsed.basketId,
    network,
    mode: liveTradingEnabled() ? "live" : "demo",
    demoReason: demoTradingReason(),
    mandateId,
    fills,
    legErrors,
    fee,
    executedAt: new Date().toISOString(),
  });
}
