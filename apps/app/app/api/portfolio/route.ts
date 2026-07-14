import { NextResponse } from "next/server";
import { MOCK_PORTFOLIO, MOCK_PROPOSAL } from "@mosaic/core/mock";
import { getPortfolioPositions } from "@mosaic/core/sodex";

/**
 * Portfolio API.
 *
 *  - With ?address=0x...  → returns the wallet's real SoDEX balances valued
 *    in USD via /markets/tickers, plus the user's actual net value. No mock
 *    proposals are injected (those are computed client-side from saved
 *    baskets so they reflect what the user actually built).
 *
 *  - Without an address    → returns the canned demo portfolio + MOCK_PROPOSAL
 *    so unconnected visitors still see a populated rebalance flow.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userAddress = searchParams.get("address") ?? undefined;

  try {
    const result = await getPortfolioPositions(userAddress);

    if (result.source === "live") {
      // Real wallet — return live values; don't fabricate PnL or proposals.
      return NextResponse.json({
        basketId: "live-wallet",
        thesisPrompt: "Live SoDEX wallet balances",
        netValueUsd: result.netValueUsd,
        netPnlUsd: 0,
        netPnlPct: 0,
        positions: result.positions,
        history: MOCK_PORTFOLIO.history, // we don't track wallet history yet
        pendingProposals: [],
        source: "live",
        walletAddress: result.walletAddress,
      });
    }

    // No wallet (or live fetch returned nothing useful) — fall back to demo
    // portfolio so the rebalance card always demonstrates the agent flow.
    return NextResponse.json({
      ...MOCK_PORTFOLIO,
      pendingProposals: [MOCK_PROPOSAL],
      source: result.source,
      walletAddress: result.walletAddress,
    });
  } catch (e) {
    console.error("[api/portfolio] failed:", e);
    return NextResponse.json({
      ...MOCK_PORTFOLIO,
      pendingProposals: [MOCK_PROPOSAL],
      source: "mock",
      error: (e as Error).message,
    });
  }
}
