import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// ── Nonce helpers (Web Crypto — works in both Node and Edge runtime) ──────────

function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(Array.from(array, (b) => String.fromCharCode(b)).join(""));
}

function buildCSP(nonce: string): string {
  return [
    "default-src 'self'",
    // No unsafe-inline, no unsafe-eval — nonce covers Next.js hydration scripts
    `script-src 'self' 'nonce-${nonce}'`,
    // unsafe-inline required: framer-motion sets style="" attributes in SSR HTML
    // for animation initial states; removing it breaks all motion components.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join("; ");
}

// ── Auth key (lazy — never throws at build time) ──────────────────────────────

let _key: Uint8Array | null = null;
function getKey(): Uint8Array | null {
  if (_key) return _key;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  _key = new TextEncoder().encode(secret);
  return _key;
}

// ── Main proxy function ───────────────────────────────────────────────────────

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // 1. Static assets — skip CSP injection (browsers don't render them as HTML)
  if (
    path.includes(".") ||
    path.startsWith("/_next") ||
    path.startsWith("/icons/") ||
    path === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 2. Generate per-request nonce for CSP
  const nonce = generateNonce();
  const csp = buildCSP(nonce);

  // Helper: pass nonce to Next.js via request header + set CSP on response
  const nextWithNonce = () => {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-nonce", nonce);
    const res = NextResponse.next({ request: { headers: requestHeaders } });
    res.headers.set("Content-Security-Policy", csp);
    return res;
  };

  // 3. Public routes — no auth required
  const isPublicPath =
    path === "/" ||
    path === "/login" ||
    path === "/privacy" ||
    path === "/terms" ||
    path.startsWith("/survey") ||
    path.startsWith("/s/") ||
    path.startsWith("/api/auth") ||
    path.startsWith("/api/surveys") ||
    path.startsWith("/api/b24/webhook") ||
    // Sync-requests with API key (external integrations)
    path.startsWith("/api/rating-bridge") ||
    path.startsWith("/api/sync-manual") ||
    // Rating scrape trigger — exact match only (NOT the whole /api/admin/
    // tree). The handler enforces its own session-OR-API-key auth, so it's
    // safe to bypass the proxy session gate here for the VM cron job.
    path === "/api/admin/rating-sync" ||
    // Follow-up reminder job — same pattern (handler enforces its own auth).
    path === "/api/admin/followups" ||
    // Scheduled summary report — same pattern.
    path === "/api/admin/report" ||
    // Analytics recorded from the survey page (no session)
    path === "/api/analytics";

  if (isPublicPath) {
    return nextWithNonce();
  }

  // 4. AUTH_SECRET missing — server misconfiguration
  const key = getKey();
  if (!key) {
    if (path.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Server misconfiguration" },
        { status: 500 }
      );
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 5. Verify session JWT
  const session = req.cookies.get("session")?.value;

  if (!session) {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("from", path);
    return NextResponse.redirect(loginUrl);
  }

  try {
    const { payload } = await jwtVerify(session, key, { algorithms: ["HS256"] });

    // Role gate: MANAGER may only reach the dashboard and results. Admin-only
    // sections (config/management) redirect to the dashboard (pages) or 403
    // (their APIs). ADMIN — and legacy sessions without a role — pass.
    const role = (payload as { role?: string }).role;
    if (role === "MANAGER") {
      const adminOnly =
        path.startsWith("/admin/integration") ||
        path.startsWith("/admin/branches") ||
        path.startsWith("/admin/templates") ||
        path.startsWith("/admin/users") ||
        path.startsWith("/api/admin/users") ||
        path.startsWith("/api/admin/b24-webhooks") ||
        path.startsWith("/api/settings") ||
        path.startsWith("/api/branches") ||
        path.startsWith("/api/cities") ||
        path.startsWith("/api/templates") ||
        path.startsWith("/api/questions") ||
        path.startsWith("/api/admin/rating-manual") ||
        path.startsWith("/api/admin/test");
      if (adminOnly) {
        if (path.startsWith("/api/")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    }

    return nextWithNonce();
  } catch {
    if (path.startsWith("/api/")) {
      return NextResponse.json({ error: "Invalid session" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
