import { NextRequest, NextResponse } from "next/server";
import { FORBIDDEN, ownerAllowed } from "@/lib/auth";
import { z } from "zod";
import { verifyMandateSignature, type Mandate, type MandateTerms } from "@mosaic/core/mandate";
import {
  dbEnabled,
  dbSaveMandate,
  dbListMandates,
  dbRevokeMandate,
  dbMandateUtilisation,
  dbKillSwitch,
  dbSetKillSwitch,
  dbAudit,
} from "@mosaic/core/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TermsSchema = z.object({
  wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  basketId: z.string().min(1).max(120),
  maxNotionalUsd: z.number().min(1).max(10_000_000),
  allowedSymbols: z.array(z.string().min(1).max(20)).min(1).max(30),
  maxSlippageBps: z.number().int().min(1).max(500),
  maxDriftBps: z.number().int().min(0).max(10_000),
  cooldownHours: z.number().int().min(0).max(24 * 30),
  vetoWindowHours: z.number().int().min(0).max(24 * 14),
  expiry: z.number().int(),
  nonce: z.number().int().min(0),
});

/** GET /api/mandate?wallet=0x… — mandates + utilisation + kill switch. */
export async function GET(req: NextRequest) {
  if (!dbEnabled()) {
    return NextResponse.json({ enabled: false, mandates: [], killSwitch: false });
  }
  const wallet = new URL(req.url).searchParams.get("wallet");
  if (!wallet) return NextResponse.json({ error: "wallet required" }, { status: 400 });
  if (!(await ownerAllowed(wallet))) return NextResponse.json(FORBIDDEN, { status: 403 });

  const [mandates, killSwitch] = await Promise.all([dbListMandates(wallet), dbKillSwitch()]);
  const withUtilisation = await Promise.all(
    mandates.map(async (m) => ({ ...m, utilisation: await dbMandateUtilisation(m.id) })),
  );
  return NextResponse.json({ enabled: true, mandates: withUtilisation, killSwitch });
}

/** POST — store a signed mandate after verifying the EIP-712 signature. */
export async function POST(req: NextRequest) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "persistence disabled — mandates need DATABASE_URL" }, { status: 503 });
  }
  let body: { terms: MandateTerms; signature: string };
  try {
    const raw = await req.json();
    body = { terms: TermsSchema.parse(raw.terms), signature: String(raw.signature ?? "") };
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid input", detail: (err as Error).message },
      { status: 400 },
    );
  }
  if (!(await ownerAllowed(body.terms.wallet))) {
    return NextResponse.json(FORBIDDEN, { status: 403 });
  }

  if (body.terms.expiry <= Math.floor(Date.now() / 1000)) {
    return NextResponse.json({ error: "mandate expiry is in the past" }, { status: 400 });
  }
  if (!verifyMandateSignature(body.terms, body.signature)) {
    await dbAudit(body.terms.wallet, "mandate-rejected", { reason: "signature mismatch" });
    return NextResponse.json(
      { error: "signature does not match the mandate terms and wallet" },
      { status: 401 },
    );
  }

  const mandate: Mandate = {
    ...body.terms,
    wallet: body.terms.wallet.toLowerCase(),
    allowedSymbols: body.terms.allowedSymbols.map((s) => s.toUpperCase()),
    id: `mandate-${body.terms.basketId}-${body.terms.nonce}`,
    signature: body.signature,
    status: "active",
    createdAt: new Date().toISOString(),
  };
  await dbSaveMandate(mandate);
  await dbAudit(mandate.wallet, "mandate-created", {
    id: mandate.id,
    basketId: mandate.basketId,
    maxNotionalUsd: mandate.maxNotionalUsd,
    expiry: mandate.expiry,
  });
  return NextResponse.json({ ok: true, mandate });
}

const PatchSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("revoke"),
    wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    id: z.string().min(1),
  }),
  z.object({
    action: z.literal("killSwitch"),
    wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    on: z.boolean(),
  }),
]);

/** PATCH — revoke a mandate, or flip the global kill switch. */
export async function PATCH(req: NextRequest) {
  if (!dbEnabled()) {
    return NextResponse.json({ error: "persistence disabled" }, { status: 503 });
  }
  let parsed;
  try {
    parsed = PatchSchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid input", detail: (err as Error).message },
      { status: 400 },
    );
  }
  if (parsed.action === "revoke") {
    const ok = await dbRevokeMandate(parsed.wallet, parsed.id);
    await dbAudit(parsed.wallet, "mandate-revoked", { id: parsed.id, ok });
    return ok
      ? NextResponse.json({ ok: true })
      : NextResponse.json({ error: "mandate not found" }, { status: 404 });
  }
  await dbSetKillSwitch(parsed.on, parsed.wallet);
  return NextResponse.json({ ok: true, killSwitch: parsed.on });
}
