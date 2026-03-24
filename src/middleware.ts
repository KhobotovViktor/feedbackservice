import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secretKey = "admin_secret_key_change_me_in_prod";
const key = new TextEncoder().encode(process.env.AUTH_SECRET || secretKey);

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 1. Dynamic check for static assets (fallback for matcher)
  if (
    path.includes(".") || 
    path.startsWith("/_next") || 
    path.startsWith("/icons/") ||
    path === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2. Define public paths and bypasses
  const isPublicPath = 
    path === "/login" || 
    path === "/privacy" || 
    path.startsWith("/survey") || 
    path.startsWith("/s/") || 
    path.startsWith("/api/auth") ||
    path.startsWith("/api/surveys") ||
    path.startsWith("/api/rating-bridge") ||
    path.includes("rating-bridge") ||
    path.startsWith("/api/b24/webhook") ||
    path.startsWith("/api/test-b24-notification") ||
    // Robust Sync Bypass: If it has an API Key in query or headers, it's a sync request
    req.nextUrl.searchParams.has("apiKey") ||
    req.headers.has("x-api-key");

  if (isPublicPath) {
    return NextResponse.next();
  }

  // 3. Session validation for protected paths
  const session = req.cookies.get("session")?.value;

  if (!session) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ 
        error: "Unauthorized", 
        path 
      }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(session, key);
    return NextResponse.next();
  } catch (error) {
    console.error("Middleware Auth Error:", error);
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
