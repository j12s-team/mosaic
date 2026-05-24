import { NextResponse } from "next/server";
import { MOCK_PORTFOLIO, MOCK_PROPOSAL } from "@/lib/mock";
import { getPortfolioPositions } from "@/lib/sodex";

export async function GET(req: Request) {
  // If the dashboard passes the connected wallet address, we ask SoDEX for
  // real balances. Otherwise we return the demo portfolio so unconnected
  // visitors still see a populated rebalance view.
  const { searchParams } = new URL(req.url);
  const userAddress = searchParams.get("address") ?? undefined;
  const positions = await getPortfolioPositions(userAddress).catch(
    () => MOCK_PORTFOLIO.positions,
  );
  return NextResponse.json({
    ...MOCK_PORTFOLIO,
    positions,
    pendingProposals: [MOCK_PROPOSAL],
  });
}
