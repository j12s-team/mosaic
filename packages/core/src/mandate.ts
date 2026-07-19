// Investment mandates — bounded autonomy for the Mosaic agent.
//
// A mandate is a human-readable EIP-712 message the user signs ONCE per
// basket. It is the sole source of execution authority on mainnet: the
// server-side policy gate (validatePlanAgainstMandate) checks every plan
// against it before any order is placed, for interactive AND (Wave 4)
// autonomous execution. Trust model, stated plainly: SoDEX execution is
// API-key based, so the mandate bounds *Mosaic's server* authority — it is
// enforced policy with an audit trail, not on-chain custody.

import {
  typedDataDigest,
  recoverAddress,
  type Eip712Field,
  type Eip712Domain,
  type Eip712Value,
} from "./eip712";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MandateTerms {
  wallet: string;
  basketId: string;
  /** Lifetime cap on FILLED notional, whole USD. */
  maxNotionalUsd: number;
  /** Token symbols the agent may trade under this mandate. */
  allowedSymbols: string[];
  /** Per-plan estimated slippage cap. */
  maxSlippageBps: number;
  /** Minimum weight drift (bps) before a rebalance is allowed. */
  maxDriftBps: number;
  /** Minimum hours between executions. */
  cooldownHours: number;
  /** Hours a proposal must sit before autonomous execution. */
  vetoWindowHours: number;
  /** Unix seconds. */
  expiry: number;
  nonce: number;
}

export interface Mandate extends MandateTerms {
  id: string;
  signature: string;
  status: "active" | "revoked";
  createdAt: string;
}

export const MANDATE_DOMAIN: Eip712Domain = {
  name: "Mosaic Mandates",
  version: "1",
};

export const MANDATE_FIELDS: Eip712Field[] = [
  { name: "wallet", type: "address" },
  { name: "basketId", type: "string" },
  { name: "maxNotionalUsd", type: "uint256" },
  { name: "allowedSymbols", type: "string[]" },
  { name: "maxSlippageBps", type: "uint256" },
  { name: "maxDriftBps", type: "uint256" },
  { name: "cooldownHours", type: "uint256" },
  { name: "vetoWindowHours", type: "uint256" },
  { name: "expiry", type: "uint256" },
  { name: "nonce", type: "uint256" },
];

function termsToMessage(terms: MandateTerms): Record<string, Eip712Value> {
  return {
    wallet: terms.wallet,
    basketId: terms.basketId,
    maxNotionalUsd: Math.round(terms.maxNotionalUsd),
    allowedSymbols: terms.allowedSymbols.map((s) => s.toUpperCase()),
    maxSlippageBps: terms.maxSlippageBps,
    maxDriftBps: terms.maxDriftBps,
    cooldownHours: terms.cooldownHours,
    vetoWindowHours: terms.vetoWindowHours,
    expiry: terms.expiry,
    nonce: terms.nonce,
  };
}

/** Full JSON payload for eth_signTypedData_v4 (client) — matches the server digest. */
export function mandateTypedData(terms: MandateTerms) {
  return {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
      ],
      Mandate: MANDATE_FIELDS,
    },
    domain: MANDATE_DOMAIN,
    primaryType: "Mandate" as const,
    message: termsToMessage(terms),
  };
}

export function mandateDigest(terms: MandateTerms): Uint8Array {
  return typedDataDigest(MANDATE_DOMAIN, "Mandate", MANDATE_FIELDS, termsToMessage(terms));
}

/** True when `signature` over the mandate digest recovers to `terms.wallet`. */
export function verifyMandateSignature(terms: MandateTerms, signature: string): boolean {
  try {
    const recovered = recoverAddress(mandateDigest(terms), signature);
    return recovered.toLowerCase() === terms.wallet.toLowerCase();
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// The policy gate — one pure function, one code path for every execution.
// ---------------------------------------------------------------------------

export interface PlanLegInput {
  symbol: string;
  notionalUsd: number;
  estSlippageBps: number;
}

export interface PlanInput {
  legs: PlanLegInput[];
  totalNotionalUsd: number;
}

export interface GateContext {
  /** Cumulative FILLED notional already executed under this mandate. */
  utilisedNotionalUsd: number;
  /** ISO timestamp of the last execution under this mandate, if any. */
  lastExecutionAt?: string;
  /** Global kill switch state. */
  killSwitch: boolean;
  /** Evaluation time (ms epoch) — injected for testability. */
  nowMs: number;
  /** Current vs target weights (fractions summing to 1) for drift checks.
   *  Omit both for initial executions (no drift rule applies). */
  currentWeights?: Record<string, number>;
  targetWeights?: Record<string, number>;
}

export type DenyReason =
  | { rule: "revoked"; detail: string }
  | { rule: "expired"; detail: string }
  | { rule: "kill-switch"; detail: string }
  | { rule: "allowlist"; detail: string }
  | { rule: "notional-cap"; detail: string }
  | { rule: "slippage"; detail: string }
  | { rule: "cooldown"; detail: string }
  | { rule: "drift"; detail: string };

export interface GateVerdict {
  allowed: boolean;
  reasons: DenyReason[];
  remainingNotionalUsd: number;
}

/** Max per-symbol drift between current and target weights, in bps. */
export function weightDriftBps(
  current: Record<string, number>,
  target: Record<string, number>,
): number {
  const symbols = new Set([...Object.keys(current), ...Object.keys(target)]);
  let max = 0;
  for (const s of symbols) {
    const d = Math.abs((current[s] ?? 0) - (target[s] ?? 0)) * 10_000;
    if (d > max) max = d;
  }
  return Math.round(max);
}

export function validatePlanAgainstMandate(
  plan: PlanInput,
  mandate: Mandate,
  ctx: GateContext,
): GateVerdict {
  const reasons: DenyReason[] = [];
  const remaining = Math.max(0, mandate.maxNotionalUsd - ctx.utilisedNotionalUsd);

  if (mandate.status === "revoked") {
    reasons.push({ rule: "revoked", detail: "mandate has been revoked by its owner" });
  }
  if (ctx.nowMs / 1000 > mandate.expiry) {
    reasons.push({
      rule: "expired",
      detail: `mandate expired at ${new Date(mandate.expiry * 1000).toISOString()}`,
    });
  }
  if (ctx.killSwitch) {
    reasons.push({ rule: "kill-switch", detail: "global kill switch is engaged" });
  }

  const allowed = new Set(mandate.allowedSymbols.map((s) => s.toUpperCase()));
  const outside = plan.legs
    .map((l) => l.symbol.toUpperCase())
    .filter((s) => !allowed.has(s));
  if (outside.length) {
    reasons.push({
      rule: "allowlist",
      detail: `symbols not in mandate allowlist: ${[...new Set(outside)].join(", ")}`,
    });
  }

  if (plan.totalNotionalUsd > remaining) {
    reasons.push({
      rule: "notional-cap",
      detail: `plan needs $${plan.totalNotionalUsd.toFixed(2)} but only $${remaining.toFixed(2)} of the $${mandate.maxNotionalUsd} cap remains (filled: $${ctx.utilisedNotionalUsd.toFixed(2)})`,
    });
  }

  const worstSlip = Math.max(0, ...plan.legs.map((l) => l.estSlippageBps));
  if (worstSlip > mandate.maxSlippageBps) {
    reasons.push({
      rule: "slippage",
      detail: `estimated slippage ${worstSlip} bps exceeds mandate cap ${mandate.maxSlippageBps} bps`,
    });
  }

  if (ctx.lastExecutionAt) {
    const elapsedH = (ctx.nowMs - new Date(ctx.lastExecutionAt).getTime()) / 3_600_000;
    if (elapsedH < mandate.cooldownHours) {
      reasons.push({
        rule: "cooldown",
        detail: `cooldown ${mandate.cooldownHours}h not elapsed (last execution ${elapsedH.toFixed(1)}h ago)`,
      });
    }
  }

  if (ctx.currentWeights && ctx.targetWeights) {
    const drift = weightDriftBps(ctx.currentWeights, ctx.targetWeights);
    if (drift < mandate.maxDriftBps) {
      reasons.push({
        rule: "drift",
        detail: `max weight drift ${drift} bps is below the ${mandate.maxDriftBps} bps rebalance threshold`,
      });
    }
  }

  return { allowed: reasons.length === 0, reasons, remainingNotionalUsd: remaining };
}

// ---------------------------------------------------------------------------
// Proposal lifecycle — proposed → executable → executed | vetoed | expired
// ---------------------------------------------------------------------------

export interface ProposalTiming {
  proposedAt: string;
  vetoWindowHours: number;
  /** Terminal state already recorded, if any. */
  status?: "executed" | "vetoed";
}

/** Proposals stay executable for 72h after the veto window opens. */
export const PROPOSAL_EXECUTABLE_HOURS = 72;

export type ProposalState = "proposed" | "executable" | "executed" | "vetoed" | "expired";

export function proposalStateAt(p: ProposalTiming, nowMs: number): ProposalState {
  if (p.status) return p.status;
  const openMs = new Date(p.proposedAt).getTime() + p.vetoWindowHours * 3_600_000;
  if (nowMs < openMs) return "proposed";
  if (nowMs < openMs + PROPOSAL_EXECUTABLE_HOURS * 3_600_000) return "executable";
  return "expired";
}
