import { NextResponse } from "next/server";
import { listSsiIndexes } from "@mosaic/core/sosovalue";

// Live data — never serve a build-time snapshot (fix: app showed demo/mock
// while the site showed live). Re-runs per request with the current env.
export const dynamic = "force-dynamic";

/**
 * GET /api/ssi → list of available SoSoValue SSI indexes that users can use
 * as a starter basket or as a benchmark. Falls back to a curated mock library
 * when SOSOVALUE_API_KEY isn't set so the demo never breaks.
 */
export async function GET() {
  const indexes = await listSsiIndexes();
  return NextResponse.json({ indexes });
}
