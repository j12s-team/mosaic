import { describe, it, expect } from "vitest";
import {
  mandateDigest,
  verifyMandateSignature,
  validatePlanAgainstMandate,
  weightDriftBps,
  proposalStateAt,
  type Mandate,
  type MandateTerms,
  type GateContext,
} from "../mandate";
import { signDigest, privateKeyToAddress, recoverAddress } from "../eip712";

const PRIV = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const WALLET = privateKeyToAddress(PRIV);

const NOW = Date.UTC(2026, 6, 9, 12, 0, 0); // fixed clock for determinism

function terms(overrides: Partial<MandateTerms> = {}): MandateTerms {
  return {
    wallet: WALLET,
    basketId: "basket-1",
    maxNotionalUsd: 500,
    allowedSymbols: ["TAO", "RNDR", "FET"],
    maxSlippageBps: 50,
    maxDriftBps: 100,
    cooldownHours: 24,
    vetoWindowHours: 24,
    expiry: Math.floor(NOW / 1000) + 30 * 86400,
    nonce: 1,
    ...overrides,
  };
}

function mandate(overrides: Partial<Mandate> = {}): Mandate {
  return {
    ...terms(),
    id: "m1",
    signature: "0x",
    status: "active",
    createdAt: new Date(NOW - 86400_000).toISOString(),
    ...overrides,
  };
}

function ctx(overrides: Partial<GateContext> = {}): GateContext {
  return { utilisedNotionalUsd: 0, killSwitch: false, nowMs: NOW, ...overrides };
}

const okPlan = {
  legs: [
    { symbol: "TAO", notionalUsd: 60, estSlippageBps: 12 },
    { symbol: "RNDR", notionalUsd: 40, estSlippageBps: 9 },
  ],
  totalNotionalUsd: 100,
};

describe("EIP-712 mandate signatures", () => {
  it("round-trips: sign digest → recover wallet → verify", () => {
    const t = terms();
    const sig = signDigest(mandateDigest(t), PRIV);
    expect(recoverAddress(mandateDigest(t), sig).toLowerCase()).toBe(WALLET.toLowerCase());
    expect(verifyMandateSignature(t, sig)).toBe(true);
  });

  it("rejects a signature after any term is altered", () => {
    const t = terms();
    const sig = signDigest(mandateDigest(t), PRIV);
    expect(verifyMandateSignature({ ...t, maxNotionalUsd: 50_000 }, sig)).toBe(false);
    expect(verifyMandateSignature({ ...t, allowedSymbols: ["TAO", "PEPE"] }, sig)).toBe(false);
  });

  it("rejects a signature from a different key", () => {
    const t = terms();
    const otherPriv = "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba";
    const sig = signDigest(mandateDigest(t), otherPriv);
    expect(verifyMandateSignature(t, sig)).toBe(false);
  });
});

describe("policy gate", () => {
  it("allows a compliant plan and reports remaining cap", () => {
    const v = validatePlanAgainstMandate(okPlan, mandate(), ctx({ utilisedNotionalUsd: 150 }));
    expect(v.allowed).toBe(true);
    expect(v.remainingNotionalUsd).toBe(350);
  });

  it("refuses symbols outside the allowlist", () => {
    const plan = { ...okPlan, legs: [...okPlan.legs, { symbol: "PEPE", notionalUsd: 10, estSlippageBps: 5 }] };
    const v = validatePlanAgainstMandate(plan, mandate(), ctx());
    expect(v.allowed).toBe(false);
    expect(v.reasons.map((r) => r.rule)).toContain("allowlist");
    expect(v.reasons.find((r) => r.rule === "allowlist")?.detail).toContain("PEPE");
  });

  it("enforces the notional cap cumulatively over filled utilisation", () => {
    const v = validatePlanAgainstMandate(okPlan, mandate(), ctx({ utilisedNotionalUsd: 450 }));
    expect(v.allowed).toBe(false);
    expect(v.reasons.map((r) => r.rule)).toContain("notional-cap");
    expect(v.remainingNotionalUsd).toBe(50);
  });

  it("refuses when estimated slippage exceeds the cap", () => {
    const plan = { ...okPlan, legs: [{ symbol: "TAO", notionalUsd: 100, estSlippageBps: 80 }] };
    const v = validatePlanAgainstMandate(plan, mandate(), ctx());
    expect(v.reasons.map((r) => r.rule)).toContain("slippage");
  });

  it("enforces cooldown from the last execution", () => {
    const v = validatePlanAgainstMandate(
      okPlan,
      mandate(),
      ctx({ lastExecutionAt: new Date(NOW - 2 * 3600_000).toISOString() }),
    );
    expect(v.reasons.map((r) => r.rule)).toContain("cooldown");
    const v2 = validatePlanAgainstMandate(
      okPlan,
      mandate(),
      ctx({ lastExecutionAt: new Date(NOW - 30 * 3600_000).toISOString() }),
    );
    expect(v2.allowed).toBe(true);
  });

  it("refuses expired, revoked, and kill-switched execution", () => {
    expect(
      validatePlanAgainstMandate(okPlan, mandate({ expiry: Math.floor(NOW / 1000) - 60 }), ctx())
        .reasons.map((r) => r.rule),
    ).toContain("expired");
    expect(
      validatePlanAgainstMandate(okPlan, mandate({ status: "revoked" }), ctx()).reasons.map(
        (r) => r.rule,
      ),
    ).toContain("revoked");
    expect(
      validatePlanAgainstMandate(okPlan, mandate(), ctx({ killSwitch: true })).reasons.map(
        (r) => r.rule,
      ),
    ).toContain("kill-switch");
  });

  it("blocks churn below the drift threshold, allows real drift", () => {
    const current = { TAO: 0.6, RNDR: 0.4 };
    const barelyMoved = { TAO: 0.605, RNDR: 0.395 }; // 50 bps < 100 bps threshold
    const moved = { TAO: 0.65, RNDR: 0.35 }; // 500 bps
    expect(weightDriftBps(current, barelyMoved)).toBe(50);
    expect(
      validatePlanAgainstMandate(okPlan, mandate(), ctx({ currentWeights: current, targetWeights: barelyMoved }))
        .reasons.map((r) => r.rule),
    ).toContain("drift");
    expect(
      validatePlanAgainstMandate(okPlan, mandate(), ctx({ currentWeights: current, targetWeights: moved }))
        .allowed,
    ).toBe(true);
  });

  it("collects multiple violations in one verdict", () => {
    const plan = { legs: [{ symbol: "PEPE", notionalUsd: 900, estSlippageBps: 200 }], totalNotionalUsd: 900 };
    const v = validatePlanAgainstMandate(plan, mandate(), ctx({ killSwitch: true }));
    const rules = v.reasons.map((r) => r.rule);
    expect(rules).toEqual(expect.arrayContaining(["allowlist", "notional-cap", "slippage", "kill-switch"]));
  });
});

describe("proposal lifecycle", () => {
  const proposedAt = new Date(NOW).toISOString();
  it("waits out the veto window before becoming executable", () => {
    const p = { proposedAt, vetoWindowHours: 24 };
    expect(proposalStateAt(p, NOW + 1 * 3600_000)).toBe("proposed");
    expect(proposalStateAt(p, NOW + 23.9 * 3600_000)).toBe("proposed");
    expect(proposalStateAt(p, NOW + 24.1 * 3600_000)).toBe("executable");
  });
  it("expires when never acted on, and terminal states stick", () => {
    const p = { proposedAt, vetoWindowHours: 24 };
    expect(proposalStateAt(p, NOW + (24 + 73) * 3600_000)).toBe("expired");
    expect(proposalStateAt({ ...p, status: "vetoed" as const }, NOW + 500 * 3600_000)).toBe("vetoed");
    expect(proposalStateAt({ ...p, status: "executed" as const }, NOW + 500 * 3600_000)).toBe("executed");
  });
});
