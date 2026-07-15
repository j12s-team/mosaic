import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  NONCE_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SEC,
  createSessionToken,
  parseSiweMessage,
  recoverPersonalSigner,
  verifyNonceToken,
} from "@mosaic/core/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  message: z.string().min(1).max(2000),
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
});

/** POST /api/auth/verify — verify the signed SIWE message, mint the session. */
export async function POST(req: NextRequest) {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return NextResponse.json({ enabled: false }, { status: 503 });

  let body;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return NextResponse.json({ error: "Invalid input", detail: (err as Error).message }, { status: 400 });
  }

  const parsed = parseSiweMessage(body.message);
  if (!parsed) return NextResponse.json({ error: "unparseable SIWE message" }, { status: 400 });

  // Nonce must be the one we issued to this browser (replay protection).
  const nonceCookie = req.cookies.get(NONCE_COOKIE)?.value;
  const issued = nonceCookie ? verifyNonceToken(nonceCookie, secret) : null;
  if (!issued || issued !== parsed.nonce) {
    return NextResponse.json({ error: "nonce mismatch or expired — retry sign-in" }, { status: 401 });
  }

  // The message must bind to this host (mirrors what the client displayed).
  const host = req.headers.get("host");
  if (host && parsed.domain !== host) {
    return NextResponse.json({ error: `domain mismatch: message is for ${parsed.domain}` }, { status: 401 });
  }

  let signer: string;
  try {
    signer = recoverPersonalSigner(body.message, body.signature);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  if (signer.toLowerCase() !== parsed.address.toLowerCase()) {
    return NextResponse.json({ error: "signature does not match address" }, { status: 401 });
  }

  const res = NextResponse.json({ address: parsed.address.toLowerCase() });
  res.cookies.set(SESSION_COOKIE, createSessionToken(parsed.address, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SEC,
    path: "/",
  });
  res.cookies.delete(NONCE_COOKIE);
  return res;
}
