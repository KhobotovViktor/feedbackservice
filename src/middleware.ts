import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const AUTH_SECRET = process.env.AUTH_SECRET
  ? new TextEncoder().encode(process.env.AUTH_SECRET)
  : null;

const PROTECTED_PREFIXES = ["/admin", "/api/admin", "/api/branches", "/api/templates", "/api/questions", "/api/settings", "/api/analytics"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  if (!AUTH_SECRET) {
    console.error("AUTH_SECRET is not configured — blocking all protected routes.");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const session = req.cookies.get("session")?.value;
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    await jwtVerify(session, AUTH_SECRET, { algorithms: ["HS256"] });
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/admin/:path*",
    "/api/branches/:path*",
    "/api/templates/:path*",
    "/api/questions/:path*",
    "/api/settings/:path*",
    "/api/analytics/:path*",
  ],
};
