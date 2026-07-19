import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { NONCE_COOKIE, NONCE_TTL_SEC, createNonceToken } from "@mosaic/core/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/auth/nonce — issue a SIWE nonce bound to an httpOnly cookie. */
export async function GET() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return NextResponse.json({ enabled: false });
  const nonce = randomBytes(16).toString("hex");
  const res = NextResponse.json({ enabled: true, nonce });
  res.cookies.set(NONCE_COOKIE, createNonceToken(nonce, secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: NONCE_TTL_SEC,
    path: "/",
  });
  return res;
}
