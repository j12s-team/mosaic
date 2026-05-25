import { NextResponse } from "next/server";
import { listSsiIndexes } from "@/lib/sosovalue";

/**
 * GET /api/ssi → list of available SoSoValue SSI indexes that users can use
 * as a starter basket or as a benchmark. Falls back to a curated mock library
 * when SOSOVALUE_API_KEY isn't set so the demo never breaks.
 */
export async function GET() {
  const indexes = await listSsiIndexes();
  return NextResponse.json({ indexes });
}
