import { describe, it, expect } from "vitest";
import { getClientIp } from "../rate-limit";
import type { NextRequest } from "next/server";

// getClientIp only ever calls req.headers.get(name); a tiny stub is enough.
function reqWith(headers: Record<string, string>): NextRequest {
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return {
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
  } as unknown as NextRequest;
}

describe("getClientIp", () => {
  it("prefers X-Real-IP (set by nginx to the direct peer)", () => {
    expect(
      getClientIp(reqWith({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1, 9.9.9.9" }))
    ).toBe("9.9.9.9");
  });

  it("takes the LAST X-Forwarded-For hop, not the spoofable left-most one", () => {
    // nginx appends the real peer to the right; the left value is attacker-set.
    expect(getClientIp(reqWith({ "x-forwarded-for": "1.1.1.1, 2.2.2.2, 3.3.3.3" }))).toBe(
      "3.3.3.3"
    );
  });

  it("does not return a client-spoofed left-most XFF value", () => {
    const spoofed = getClientIp(reqWith({ "x-forwarded-for": "6.6.6.6, 8.8.8.8" }));
    expect(spoofed).not.toBe("6.6.6.6");
    expect(spoofed).toBe("8.8.8.8");
  });

  it("falls back to 'unknown' when no forwarding headers are present", () => {
    expect(getClientIp(reqWith({}))).toBe("unknown");
  });
});
