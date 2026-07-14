import { NextResponse } from "next/server";
import { getAllTickers, getWalletBalances, currentNetwork } from "@mosaic/core/sodex";
import { getFeaturedNews, listSsiIndexes, getTokenMetrics } from "@mosaic/core/sosovalue";

/**
 * GET /api/diag?address=0x...
 *
 * Diagnostic endpoint — calls every live integration and reports what came
 * back. Lets you (or judges) verify the SoSoValue and SoDEX wiring without
 * digging through Vercel function logs.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address") ?? undefined;

  const sample = <T,>(arr: T[], n: number): T[] => arr.slice(0, n);

  const [tickers, news, ssi, btcMetrics, taoMetrics, balances] = await Promise.all([
    getAllTickers().then((r) => ({ count: r.length, sample: sample(r, 5) })).catch((e) => ({ error: (e as Error).message })),
    getFeaturedNews({ pageSize: 5 }).then((r) => ({ count: r.length, sample: sample(r, 3) })).catch((e) => ({ error: (e as Error).message })),
    listSsiIndexes().then((r) => ({ count: r.length, sample: r.map((idx) => ({ symbol: idx.symbol, constituents: idx.constituents.length, changePct: idx.changePct })) })).catch((e) => ({ error: (e as Error).message })),
    getTokenMetrics("BTC").catch((e) => ({ error: (e as Error).message })),
    getTokenMetrics("TAO").catch((e) => ({ error: (e as Error).message })),
    address ? getWalletBalances(address).then((r) => ({ count: r.length, rows: r })).catch((e) => ({ error: (e as Error).message })) : { skipped: "no ?address= param" },
  ]);

  return NextResponse.json({
    env: {
      network: currentNetwork(),
      sosoKey: Boolean(process.env.SOSOVALUE_API_KEY),
      sodexKey: Boolean(process.env.SODEX_API_KEY),
      sodexSecret: Boolean(process.env.SODEX_API_SECRET),
      useMocks: process.env.MOSAIC_USE_MOCKS === "true",
      anthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
    },
    sodex: {
      tickers,
      walletBalances: balances,
    },
    sosovalue: {
      news,
      ssiIndexes: ssi,
      btcMetrics,
      taoMetrics,
    },
    timestamp: new Date().toISOString(),
  });
}
