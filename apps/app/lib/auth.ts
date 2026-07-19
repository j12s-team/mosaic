// Server-side session access (PLAN.md 5a). With no SESSION_SECRET configured,
// sessions are disabled and every check degrades to the legacy behavior so
// the zero-config demo keeps working. Set SESSION_SECRET in any deployment
// that persists wallet-owned data.
import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@mosaic/core/session";

export function sessionsEnforced(): boolean {
  return Boolean(process.env.SESSION_SECRET);
}

export async function getSessionAddress(): Promise<string | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token, secret);
}

/**
 * Wallet-owned rows (owner = 0x…) require a matching verified session.
 * Non-wallet owners (house baskets, device-local pseudo-ids) are unchanged.
 */
export async function ownerAllowed(owner: string): Promise<boolean> {
  if (!sessionsEnforced()) return true;
  if (!owner.toLowerCase().startsWith("0x")) return true;
  const addr = await getSessionAddress();
  return addr !== null && addr.toLowerCase() === owner.toLowerCase();
}

export const FORBIDDEN = { error: "owner does not match the signed-in wallet" };
