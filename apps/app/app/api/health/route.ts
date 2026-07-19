import { NextResponse } from "next/server";
import { currentNetwork, pingPublic } from "@mosaic/core/sodex";

// Live data — never serve a build-time snapshot (fix: app showed demo/mock
// while the site showed live). Re-runs per request with the current env.
export const dynamic = "force-dynamic";

/**
 * Health probe — pings SoDEX's public market list endpoint and reports
 * what credentials are configured. The dashboard uses this to render a
 * status banner so judges can verify we're actually wired into the live
 * testnet, not just running mocks.
 */
export async function GET() {
  const network = currentNetwork();
  const sodex = await pingPublic();

  const sosovalueConfigured = Boolean(process.env.SOSOVALUE_API_KEY);
  const sodexConfigured = Boolean(process.env.SODEX_API_KEY && process.env.SODEX_API_SECRET);
  const mocksForced = process.env.MOSAIC_USE_MOCKS === "true";

  return NextResponse.json({
    network,
    mode: mocksForced
      ? "mocks (forced)"
      : sodexConfigured
      ? "live"
      : "mocks (no SoDEX key)",
    sodex: {
      reachable: sodex.ok,
      latencyMs: sodex.latencyMs,
      status: sodex.status,
      error: sodex.error,
      apiKeyPresent: Boolean(process.env.SODEX_API_KEY),
      apiSecretPresent: Boolean(process.env.SODEX_API_SECRET),
    },
    sosovalue: {
      apiKeyPresent: sosovalueConfigured,
    },
    timestamp: new Date().toISOString(),
  });
}
