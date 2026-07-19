import { NextResponse } from "next/server";
import { getSessionAddress, sessionsEnforced } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/session — current verified wallet (or null). */
export async function GET() {
  return NextResponse.json({
    enforced: sessionsEnforced(),
    address: await getSessionAddress(),
  });
}
