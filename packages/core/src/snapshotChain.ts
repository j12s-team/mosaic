// Tamper-evident snapshot chain — pure functions, no I/O.
//
// Each snapshot's hash commits to its contents AND the previous snapshot's
// hash, so rewriting any historical value breaks every later link. The server
// additionally signs each hash with SNAPSHOT_SIGNING_KEY (HMAC-SHA256).
// This is honest tamper-EVIDENCE, not trustlessness: anyone who saved an
// earlier chain head can detect a rewrite; publishing the head on-chain later
// upgrades the guarantee without changing this format.

import { createHash, createHmac, timingSafeEqual } from "crypto";

export const GENESIS = "genesis";

export interface ChainedSnapshotInput {
  basketId: string;
  takenAt: string; // ISO
  marketValueUsd: number;
  prices?: Record<string, number>;
  prevHash: string;
}

/** Canonical, key-sorted serialization so hashes are reproducible. */
function canonicalPrices(prices?: Record<string, number>): string {
  if (!prices) return "";
  return Object.keys(prices)
    .sort()
    .map((k) => `${k}:${prices[k]}`)
    .join(",");
}

export function computeSnapshotHash(input: ChainedSnapshotInput): string {
  const payload = [
    input.basketId,
    input.takenAt,
    input.marketValueUsd.toFixed(2),
    canonicalPrices(input.prices),
    input.prevHash,
  ].join("|");
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

export function signHash(hash: string, key = process.env.SNAPSHOT_SIGNING_KEY): string {
  if (!key) return "";
  return createHmac("sha256", key).update(hash, "utf8").digest("hex");
}

export function verifySignature(
  hash: string,
  signature: string,
  key = process.env.SNAPSHOT_SIGNING_KEY,
): boolean {
  if (!key) return signature === "";
  const expected = signHash(hash, key);
  try {
    return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
  } catch {
    return false;
  }
}

export interface ChainRow {
  basketId: string;
  takenAt: string;
  marketValueUsd: number;
  prices?: Record<string, number>;
  prevHash: string;
  hash: string;
  signature: string;
}

export interface ChainVerdict {
  ok: boolean;
  count: number;
  headHash: string | null;
  signed: boolean;
  firstBreak?: { index: number; takenAt: string; reason: string };
}

/** Recompute the whole chain (rows must be in ascending takenAt order). */
export function verifyChain(rows: ChainRow[], key = process.env.SNAPSHOT_SIGNING_KEY): ChainVerdict {
  let prev = GENESIS;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r.prevHash !== prev) {
      return {
        ok: false,
        count: rows.length,
        headHash: null,
        signed: Boolean(key),
        firstBreak: { index: i, takenAt: r.takenAt, reason: "prev-hash mismatch (chain re-linked or row removed)" },
      };
    }
    const expected = computeSnapshotHash({
      basketId: r.basketId,
      takenAt: r.takenAt,
      marketValueUsd: r.marketValueUsd,
      prices: r.prices,
      prevHash: r.prevHash,
    });
    if (expected !== r.hash) {
      return {
        ok: false,
        count: rows.length,
        headHash: null,
        signed: Boolean(key),
        firstBreak: { index: i, takenAt: r.takenAt, reason: "content hash mismatch (values altered)" },
      };
    }
    if (key && !verifySignature(r.hash, r.signature, key)) {
      return {
        ok: false,
        count: rows.length,
        headHash: null,
        signed: true,
        firstBreak: { index: i, takenAt: r.takenAt, reason: "signature invalid" },
      };
    }
    prev = r.hash;
  }
  return { ok: true, count: rows.length, headHash: prev === GENESIS ? null : prev, signed: Boolean(key) };
}
