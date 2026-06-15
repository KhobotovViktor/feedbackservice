import { NextRequest } from "next/server";

// Lightweight in-memory rate limiting for the public endpoints. The app runs
// as a single PM2 fork, so a process-local Map is sufficient; counters reset
// on restart. (For a multi-instance setup this would need Redis.)

export function getClientIp(req: NextRequest): string {
  // Our nginx sets `X-Real-IP: $remote_addr` (the direct peer — the real
  // client) and APPENDS the peer to X-Forwarded-For via
  // `$proxy_add_x_forwarded_for`. So the trustworthy value is X-Real-IP, and
  // failing that the LAST hop of XFF — NEVER the left-most one. Taking
  // split(",")[0] would trust the client-supplied head of XFF, letting anyone
  // spoof a fresh IP per request and slip past the per-IP rate-limit and the
  // login lockout. (See .deploy/nginx_request.md.)
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const hops = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  return "unknown";
}

const hits = new Map<string, number[]>();
let lastSweep = Date.now();

/**
 * Sliding-window limiter. Returns true if the call is allowed (and records it),
 * false if `key` already reached `limit` within `windowMs`.
 */
export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();

  // Periodically drop stale keys so the Map can't grow unbounded. A 10-minute
  // ceiling comfortably covers every window we use.
  if (now - lastSweep > 60_000) {
    for (const [k, arr] of hits) {
      const fresh = arr.filter((t) => now - t < 600_000);
      if (fresh.length) hits.set(k, fresh);
      else hits.delete(k);
    }
    lastSweep = now;
  }

  const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  return true;
}
