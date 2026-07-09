import { describe, it, expect } from "vitest";
import {
  GENESIS,
  computeSnapshotHash,
  signHash,
  verifySignature,
  verifyChain,
  type ChainRow,
} from "../snapshotChain";

const KEY = "test-signing-key";

function buildChain(values: number[]): ChainRow[] {
  const rows: ChainRow[] = [];
  let prev = GENESIS;
  for (let i = 0; i < values.length; i++) {
    const input = {
      basketId: "b1",
      takenAt: `2026-07-0${i + 1}T00:00:00.000Z`,
      marketValueUsd: values[i],
      prices: { TAO: 400 + i, RNDR: 7 + i },
      prevHash: prev,
    };
    const hash = computeSnapshotHash(input);
    rows.push({ ...input, hash, signature: signHash(hash, KEY) });
    prev = hash;
  }
  return rows;
}

describe("snapshot chain", () => {
  it("hash is deterministic and key-order independent for prices", () => {
    const a = computeSnapshotHash({
      basketId: "b1",
      takenAt: "2026-07-01T00:00:00.000Z",
      marketValueUsd: 1000,
      prices: { TAO: 400, RNDR: 7 },
      prevHash: GENESIS,
    });
    const b = computeSnapshotHash({
      basketId: "b1",
      takenAt: "2026-07-01T00:00:00.000Z",
      marketValueUsd: 1000,
      prices: { RNDR: 7, TAO: 400 },
      prevHash: GENESIS,
    });
    expect(a).toBe(b);
  });

  it("verifies an intact signed chain", () => {
    const rows = buildChain([1000, 1010, 995, 1042]);
    const verdict = verifyChain(rows, KEY);
    expect(verdict.ok).toBe(true);
    expect(verdict.count).toBe(4);
    expect(verdict.headHash).toBe(rows[3].hash);
    expect(verdict.signed).toBe(true);
  });

  it("detects a rewritten value", () => {
    const rows = buildChain([1000, 1010, 995, 1042]);
    rows[1].marketValueUsd = 2010; // tamper
    const verdict = verifyChain(rows, KEY);
    expect(verdict.ok).toBe(false);
    expect(verdict.firstBreak?.index).toBe(1);
    expect(verdict.firstBreak?.reason).toContain("content hash");
  });

  it("detects a removed row (chain re-link)", () => {
    const rows = buildChain([1000, 1010, 995, 1042]);
    rows.splice(1, 1); // remove a middle snapshot
    const verdict = verifyChain(rows, KEY);
    expect(verdict.ok).toBe(false);
    expect(verdict.firstBreak?.reason).toContain("prev-hash");
  });

  it("detects a forged signature", () => {
    const rows = buildChain([1000, 1010]);
    rows[1].signature = rows[0].signature;
    const verdict = verifyChain(rows, KEY);
    expect(verdict.ok).toBe(false);
    expect(verdict.firstBreak?.reason).toContain("signature");
  });

  it("signature helpers round-trip", () => {
    const hash = computeSnapshotHash({
      basketId: "x",
      takenAt: "2026-07-01T00:00:00.000Z",
      marketValueUsd: 1,
      prevHash: GENESIS,
    });
    const sig = signHash(hash, KEY);
    expect(verifySignature(hash, sig, KEY)).toBe(true);
    expect(verifySignature(hash, sig, "other-key")).toBe(false);
  });

  it("unsigned mode (no key) verifies chains without signatures", () => {
    const rows = buildChain([1000, 1010]).map((r) => ({ ...r, signature: "" }));
    const verdict = verifyChain(rows, undefined);
    expect(verdict.ok).toBe(true);
    expect(verdict.signed).toBe(false);
  });
});
