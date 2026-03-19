import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const secretKey = "admin_secret_key_change_me_in_prod";
const key = new TextEncoder().encode(process.env.AUTH_SECRET || secretKey);

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // Define public paths
  const isPublicPath = 
    path === "/login" || 
    path === "/privacy" || 
    path.startsWith("/survey") || 
    path.startsWith("/s/") || 
    path.startsWith("/api/auth") ||
    path.startsWith("/api/surveys") ||
    path.startsWith("/api/b24/webhook") ||
    path.startsWith("/api/test-b24-notification") ||
    path === "/favicon.ico" ||
    path === "/icon.png" ||
    path === "/logoalleya.png" ||
    path.startsWith("/icons/") ||
    path.startsWith("/yandex_") ||
    path.startsWith("/google");

  if (isPublicPath) {
    return NextResponse.next();
  }

  const session = req.cookies.get("session")?.value;

  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  try {
    await jwtVerify(session, key);
    return NextResponse.next();
  } catch (error) {
    console.error("JWT verification failed:", error);
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.png|logoalleya.png|icons/|.*\\.jpg$|.*\\.png$|.*\\.ico$).*)",
  ],
};
