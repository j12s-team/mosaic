// Shared domain types for Mosaic.

export type Theme =
  | "ai-infra"
  | "depin"
  | "defi-bluechip"
  | "memes"
  | "rwa"
  | "l2-scaling"
  | "custom";

export type RiskLevel = "conservative" | "balanced" | "aggressive";

export interface Thesis {
  prompt: string;
  amountUsd: number;
  risk: RiskLevel;
  theme?: Theme;
}

export interface TokenScore {
  symbol: string;
  name: string;
  weight: number; // 0..1, basket sums to 1
  rationale: string;
  metrics: {
    marketCap?: number;
    momentum30d?: number; // -1..+inf
    flow7d?: number; // ETF/index flow USD
    sentiment?: number; // -1..+1
    volatility?: number;
    liquidityScore?: number; // 0..1, can we fill on SoDEX
  };
}

export interface Basket {
  id: string;
  thesis: Thesis;
  constituents: TokenScore[];
  riskScore: number; // 0..100, lower = safer
  expectedAnnualVol: number; // 0..1
  reasoning: string;
  createdAt: string;
  /** Reference SSI index that inspired construction, if any */
  benchmark?: { symbol: string; name: string };
  /** Set when this basket was mirrored from a public basket (its id). */
  mirroredFrom?: string;
}

export type RebalanceTrigger =
  | "news"
  | "flow-reversal"
  | "drift"
  | "risk-breach";

export interface RebalanceProposal {
  id: string;
  basketId: string;
  trigger: RebalanceTrigger;
  summary: string;
  detail: string;
  changes: Array<{
    symbol: string;
    fromWeight: number;
    toWeight: number;
    reason: string;
  }>;
  generatedAt: string;
  /** Source citations from SoSoValue news/flow data */
  citations: Array<{ kind: "news" | "flow" | "metric"; label: string; url?: string }>;
}

export interface OrderbookSnapshot {
  market: string; // e.g. "ETH/USDC"
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  midPrice: number;
  capturedAt: string;
}

export interface ExecutionPlan {
  basketId: string;
  legs: Array<{
    market: string;
    side: "buy" | "sell";
    notionalUsd: number;
    estPrice: number;
    estSlippageBps: number;
  }>;
  totalNotionalUsd: number;
  estTotalSlippageBps: number;
  venue: "SoDEX";
}

export interface PortfolioPosition {
  symbol: string;
  name: string;
  weight: number;
  qty: number;
  costBasisUsd: number;
  marketValueUsd: number;
  pnlUsd: number;
  pnlPct: number;
}

export interface PortfolioSnapshot {
  basketId: string;
  thesisPrompt: string;
  netValueUsd: number;
  netPnlUsd: number;
  netPnlPct: number;
  positions: PortfolioPosition[];
  history: Array<{ t: string; v: number }>;
  /** Pending rebalance proposals awaiting user confirmation */
  pendingProposals: RebalanceProposal[];
}

export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  sentiment?: number;
  tickers?: string[];
  url?: string;
}

export interface FlowDatum {
  symbol: string;
  date: string;
  netInflowUsd: number;
  cumulativeUsd: number;
}
