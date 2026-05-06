import { NextResponse } from "next/server";
import { MOCK_PORTFOLIO, MOCK_PROPOSAL } from "@/lib/mock";
import { getPortfolioPositions } from "@/lib/sodex";

export async function GET() {
  // For Wave 1 we return the demo portfolio (mock fallback) so judges can see
  // the rebalance flow without depositing testnet collateral.
  const positions = await getPortfolioPositions().catch(() => MOCK_PORTFOLIO.positions);
  return NextResponse.json({
    ...MOCK_PORTFOLIO,
    positions,
    pendingProposals: [MOCK_PROPOSAL],
  });
}
