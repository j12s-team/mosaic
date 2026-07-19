// Minimal EIP-712 typed-data hashing + secp256k1 sign/recover.
//
// Pure JS (@noble/*) so it runs identically in the browser (mandate signing
// UI), API routes (verification), and tests. Supports the flat struct shapes
// Mosaic uses: atomic types (address, uintN, bytes32, bool) plus string and
// string[] — deliberately NOT a general nested-struct implementation.

import { keccak_256 } from "@noble/hashes/sha3.js";
import { utf8ToBytes, hexToBytes, bytesToHex, concatBytes } from "@noble/hashes/utils.js";
import { secp256k1 } from "@noble/curves/secp256k1.js";

// noble v2 types its APIs with Uint8Array<ArrayBuffer>; normalize locally.
const cat = (...arrs: Uint8Array[]) =>
  concatBytes(...(arrs as unknown as Uint8Array<ArrayBuffer>[]));
const kec = (data: Uint8Array) => keccak_256(data as unknown as Uint8Array<ArrayBuffer>);

export type Eip712Value = string | number | bigint | boolean | string[];

export interface Eip712Field {
  name: string;
  type: string;
}

export interface Eip712Domain {
  name: string;
  version: string;
  chainId?: number;
  verifyingContract?: string;
}

function pad32(bytes: Uint8Array): Uint8Array {
  if (bytes.length > 32) throw new Error("value exceeds 32 bytes");
  const out = new Uint8Array(32);
  out.set(bytes, 32 - bytes.length);
  return out;
}

function uintTo32(value: number | bigint): Uint8Array {
  let v = BigInt(value);
  if (v < 0n) throw new Error("negative uint");
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0 && v > 0n; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

function addressTo32(addr: string): Uint8Array {
  const clean = addr.toLowerCase().replace(/^0x/, "");
  if (clean.length !== 40) throw new Error(`bad address: ${addr}`);
  return pad32(hexToBytes(clean));
}

function encodeValue(type: string, value: Eip712Value): Uint8Array {
  if (type === "string") return kec(utf8ToBytes(String(value)));
  if (type === "string[]") {
    const items = (value as string[]).map((s) => kec(utf8ToBytes(s)));
    return kec(cat(...items));
  }
  if (type === "address") return addressTo32(String(value));
  if (type === "bool") return uintTo32(value ? 1 : 0);
  if (/^uint\d*$/.test(type)) return uintTo32(value as number | bigint);
  if (type === "bytes32") {
    return pad32(hexToBytes(String(value).replace(/^0x/, "")));
  }
  throw new Error(`unsupported EIP-712 type: ${type}`);
}

export function encodeType(primaryType: string, fields: Eip712Field[]): string {
  return `${primaryType}(${fields.map((f) => `${f.type} ${f.name}`).join(",")})`;
}

export function hashStruct(
  primaryType: string,
  fields: Eip712Field[],
  message: Record<string, Eip712Value>,
): Uint8Array {
  const typeHash = kec(utf8ToBytes(encodeType(primaryType, fields)));
  const encoded: Uint8Array[] = [typeHash];
  for (const f of fields) {
    if (!(f.name in message)) throw new Error(`missing field ${f.name}`);
    encoded.push(encodeValue(f.type, message[f.name]));
  }
  return kec(cat(...encoded));
}

export function domainFields(domain: Eip712Domain): Eip712Field[] {
  const fields: Eip712Field[] = [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
  ];
  if (domain.chainId !== undefined) fields.push({ name: "chainId", type: "uint256" });
  if (domain.verifyingContract !== undefined)
    fields.push({ name: "verifyingContract", type: "address" });
  return fields;
}

export function hashDomain(domain: Eip712Domain): Uint8Array {
  return hashStruct(
    "EIP712Domain",
    domainFields(domain),
    domain as unknown as Record<string, Eip712Value>,
  );
}

/** The 32-byte digest a wallet signs for eth_signTypedData_v4. */
export function typedDataDigest(
  domain: Eip712Domain,
  primaryType: string,
  fields: Eip712Field[],
  message: Record<string, Eip712Value>,
): Uint8Array {
  return kec(
    cat(
      new Uint8Array([0x19, 0x01]),
      hashDomain(domain),
      hashStruct(primaryType, fields, message),
    ),
  );
}

/**
 * Recover the 0x address that signed `digest`. Accepts the Ethereum wire
 * format r||s||v (v = 27/28 or 0/1), which is what eth_signTypedData_v4
 * returns.
 */
export function recoverAddress(digest: Uint8Array, signature: string): string {
  const sigHex = signature.replace(/^0x/, "");
  if (sigHex.length !== 130) throw new Error("expected 65-byte signature");
  const rs = hexToBytes(sigHex.slice(0, 128));
  let v = parseInt(sigHex.slice(128, 130), 16);
  if (v >= 27) v -= 27;
  const sig = secp256k1.Signature.fromBytes(rs as unknown as Uint8Array<ArrayBuffer>, "compact").addRecoveryBit(v);
  const pub = sig.recoverPublicKey(digest as unknown as Uint8Array<ArrayBuffer>).toBytes(false);
  const hash = kec(pub.slice(1));
  return `0x${bytesToHex(hash.slice(12))}`;
}

/** Sign a raw 32-byte digest → Ethereum wire format r||s||v hex (v = 27/28). */
export function signDigest(digest: Uint8Array, privateKeyHex: string): string {
  const priv = hexToBytes(privateKeyHex.replace(/^0x/, ""));
  // noble v2: 'recovered' = recovery-first (rec||r||s); prehash:false because
  // the digest is already the EIP-712 hash.
  const sig = secp256k1.sign(digest as unknown as Uint8Array<ArrayBuffer>, priv, { format: "recovered", prehash: false });
  const rec = sig[0];
  const rs = bytesToHex(sig.slice(1));
  return `0x${rs}${(rec + 27).toString(16).padStart(2, "0")}`;
}

export function privateKeyToAddress(privateKeyHex: string): string {
  const priv = hexToBytes(privateKeyHex.replace(/^0x/, ""));
  const pub = secp256k1.getPublicKey(priv, false);
  return `0x${bytesToHex(kec(pub.slice(1)).slice(12))}`;
}

export function keccakHex(data: string | Uint8Array): string {
  const bytes = typeof data === "string" ? utf8ToBytes(data) : data;
  return `0x${bytesToHex(kec(bytes))}`;
}
