import { NextRequest, NextResponse } from "next/server";

// /status (the old /diag) and /api/diag are internal ops tooling.
// Access: open in development; in production requires STATUS_TOKEN via
// ?token=… once (sets a cookie) or the x-status-token header.
export const config = { matcher: ["/status", "/api/diag"] };

const COOKIE = "mosaic_status";

export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV !== "production") return NextResponse.next();

  const expected = process.env.STATUS_TOKEN;
  if (!expected) return new NextResponse("Not found", { status: 404 });

  const provided =
    req.nextUrl.searchParams.get("token") ??
    req.headers.get("x-status-token") ??
    req.cookies.get(COOKIE)?.value;

  if (provided !== expected) return new NextResponse("Not found", { status: 404 });

  const res = NextResponse.next();
  res.cookies.set(COOKIE, expected, { httpOnly: true, sameSite: "lax", path: "/" });
  return res;
}
