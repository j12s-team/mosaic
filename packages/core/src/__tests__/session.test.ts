import { describe, expect, it } from "vitest";
import {
  createNonceToken,
  createSessionToken,
  parseSiweMessage,
  personalMessageDigest,
  recoverPersonalSigner,
  verifyNonceToken,
  verifySessionToken,
} from "../session";
import { signDigest, privateKeyToAddress } from "../eip712";
import { executionFee } from "../fees";

const SECRET = "test-secret";

describe("session tokens", () => {
  it("round-trips an address", () => {
    const t = createSessionToken("0xAbC0000000000000000000000000000000000001", SECRET);
    expect(verifySessionToken(t, SECRET)).toBe("0xabc0000000000000000000000000000000000001");
  });
  it("rejects tampering and wrong secrets", () => {
    const t = createSessionToken("0xabc0000000000000000000000000000000000001", SECRET);
    expect(verifySessionToken(t + "x", SECRET)).toBeNull();
    expect(verifySessionToken(t, "other-secret")).toBeNull();
  });
  it("rejects expired tokens", () => {
    const t = createSessionToken("0xabc0000000000000000000000000000000000001", SECRET, -10);
    expect(verifySessionToken(t, SECRET)).toBeNull();
  });
  it("nonce tokens round-trip", () => {
    const t = createNonceToken("n0nc3", SECRET);
    expect(verifyNonceToken(t, SECRET)).toBe("n0nc3");
  });
});

describe("SIWE verification", () => {
  const priv = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
  const addr = privateKeyToAddress(priv);

  const message = [
    "app.mosaic.xyz wants you to sign in with your Ethereum account:",
    addr,
    "",
    "Sign in to Mosaic — your personal crypto hedge fund, run by an agent.",
    "",
    "URI: https://app.mosaic.xyz",
    "Version: 1",
    "Chain ID: 1",
    "Nonce: abc123",
    "Issued At: 2026-07-14T00:00:00.000Z",
  ].join("\n");

  it("parses the wallet.ts message shape", () => {
    const p = parseSiweMessage(message)!;
    expect(p.domain).toBe("app.mosaic.xyz");
    expect(p.address).toBe(addr);
    expect(p.chainId).toBe(1);
    expect(p.nonce).toBe("abc123");
  });

  it("recovers the personal_sign signer", () => {
    const sig = signDigest(personalMessageDigest(message), priv);
    expect(recoverPersonalSigner(message, sig).toLowerCase()).toBe(addr.toLowerCase());
  });

  it("rejects a forged signer", () => {
    const sig = signDigest(personalMessageDigest("different message"), priv);
    expect(recoverPersonalSigner(message, sig).toLowerCase()).not.toBe(addr.toLowerCase());
  });
});

describe("execution fee scaffold", () => {
  it("is disabled by default", () => {
    expect(executionFee(10_000).usd).toBe(0);
  });
  it("computes bps when explicitly passed", () => {
    expect(executionFee(10_000, 25)).toEqual({ bps: 25, usd: 25 });
  });
});
