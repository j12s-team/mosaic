// Execution-fee scaffold (PLAN.md 5b groundwork). DISABLED by default:
// MOSAIC_FEE_BPS unset/0 means every fee computes to $0. Charging only
// begins once the SoDEX delegation spike and the legal/ToS review clear —
// this exists so fee accounting is in the audit trail from day one.

export interface ExecutionFee {
  bps: number;
  usd: number;
}

export function feeBps(): number {
  const raw = Number(process.env.MOSAIC_FEE_BPS ?? 0);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  // Hard ceiling: a mistyped env var must not create a 10% fee.
  return Math.min(raw, 100);
}

export function executionFee(totalNotionalUsd: number, bps = feeBps()): ExecutionFee {
  if (bps <= 0 || !Number.isFinite(totalNotionalUsd) || totalNotionalUsd <= 0) {
    return { bps: 0, usd: 0 };
  }
  return { bps, usd: Math.round(totalNotionalUsd * bps) / 10_000 };
}
