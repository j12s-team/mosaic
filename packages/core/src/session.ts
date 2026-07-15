// Server-verified SIWE sessions — pure primitives, no I/O (PLAN.md 5a).
//
// Design: the client signs the same EIP-4361 message it always has, but the
// nonce now comes from the server and the signature is verified server-side
// (EIP-191 personal_sign recovery). Success mints an HMAC-signed, httpOnly
// session cookie. Wallet-owned rows (0x… owners) are only readable/writable
// when the verified session matches. With no SESSION_SECRET configured the
// whole layer degrades to the legacy client-asserted behavior so the
// zero-config demo keeps working.

import { createHmac, timingSafeEqual } from "crypto";
import { keccak_256 } from "@noble/hashes/sha3.js";
import { utf8ToBytes } from "@noble/hashes/utils.js";
import { recoverAddress } from "./eip712";

const b64url = (s: string | Buffer) =>
  Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
const fromB64url = (s: string) =>
  Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");

function hmacHex(secret: string, data: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/** Generic signed token: `payloadB64url.hmacHex`. */
function mintToken(payload: Record<string, unknown>, secret: string): string {
  const p = b64url(JSON.stringify(payload));
  return `${p}.${hmacHex(secret, p)}`;
}

function readToken<T>(token: string, secret: string): T | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const p = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!safeEqualHex(hmacHex(secret, p), sig)) return null;
  try {
    return JSON.parse(fromB64url(p)) as T;
  } catch {
    return null;
  }
}

const now = () => Math.floor(Date.now() / 1000);

// --- session tokens ---------------------------------------------------------

export const SESSION_COOKIE = "mosaic_session";
export const NONCE_COOKIE = "mosaic_nonce";
export const SESSION_TTL_SEC = 7 * 24 * 3600;
export const NONCE_TTL_SEC = 600;

export function createSessionToken(address: string, secret: string, ttlSec = SESSION_TTL_SEC): string {
  return mintToken({ a: address.toLowerCase(), e: now() + ttlSec }, secret);
}

export function verifySessionToken(token: string, secret: string): string | null {
  const t = readToken<{ a?: string; e?: number }>(token, secret);
  if (!t || typeof t.a !== "string" || typeof t.e !== "number") return null;
  if (t.e < now()) return null;
  return t.a;
}

export function createNonceToken(nonce: string, secret: string, ttlSec = NONCE_TTL_SEC): string {
  return mintToken({ n: nonce, e: now() + ttlSec }, secret);
}

export function verifyNonceToken(token: string, secret: string): string | null {
  const t = readToken<{ n?: string; e?: number }>(token, secret);
  if (!t || typeof t.n !== "string" || typeof t.e !== "number") return null;
  if (t.e < now()) return null;
  return t.n;
}

// --- EIP-191 / SIWE verification --------------------------------------------

/** keccak256("\x19Ethereum Signed Message:\n" + len + message) — personal_sign digest. */
export function personalMessageDigest(message: string): Uint8Array {
  const msg = utf8ToBytes(message);
  const prefix = utf8ToBytes(`Ethereum Signed Message:\n${msg.length}`);
  const joined = new Uint8Array(prefix.length + msg.length);
  joined.set(prefix);
  joined.set(msg, prefix.length);
  return keccak_256(joined as unknown as Uint8Array<ArrayBuffer>);
}

/** Recover the signer of a personal_sign message. */
export function recoverPersonalSigner(message: string, signature: string): string {
  return recoverAddress(personalMessageDigest(message), signature);
}

export interface ParsedSiwe {
  domain: string;
  address: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
}

/** Parse the exact EIP-4361 message shape produced by wallet.ts. */
export function parseSiweMessage(message: string): ParsedSiwe | null {
  const lines = message.split("\n");
  const m0 = lines[0]?.match(/^(.+) wants you to sign in with your Ethereum account:$/);
  const address = lines[1];
  if (!m0 || !address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return null;
  const grab = (label: string) => {
    const line = lines.find((l) => l.startsWith(`${label}: `));
    return line ? line.slice(label.length + 2) : null;
  };
  const chainId = Number(grab("Chain ID"));
  const nonce = grab("Nonce");
  const issuedAt = grab("Issued At");
  if (!Number.isFinite(chainId) || !nonce || !issuedAt) return null;
  return { domain: m0[1], address, chainId, nonce, issuedAt };
}
