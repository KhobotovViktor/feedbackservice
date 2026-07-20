import { beforeAll, describe, expect, it } from "vitest";

// The module reads JWT_SECRET lazily (first sign/verify call), but set it
// before import anyway so the test stays correct if that ever changes.
beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-0123456789-0123456789-ok";
});

describe("createCityLinkToken", () => {
  it("round-trips with the citySelect flag and a QR_CITY_ dealId", async () => {
    const { createCityLinkToken, verifySurveyToken } = await import("../auth-utils");
    const token = await createCityLinkToken();
    const payload = await verifySurveyToken(token);
    expect(payload).not.toBeNull();
    expect(payload!.citySelect).toBe(true);
    // QR_ prefix keeps B24 writeback + CRM deep-links suppressed downstream;
    // QR_CITY_ specifically labels the response as stories-originated.
    expect(payload!.dealId.startsWith("QR_CITY_")).toBe(true);
    expect(payload!.clientId).toBe(payload!.dealId);
  });

  it("mints a unique dealId per call (each visit = fresh submission)", async () => {
    const { createCityLinkToken, verifySurveyToken } = await import("../auth-utils");
    const [a, b] = await Promise.all([createCityLinkToken(), createCityLinkToken()]);
    const [pa, pb] = [await verifySurveyToken(a), await verifySurveyToken(b)];
    expect(pa!.dealId).not.toBe(pb!.dealId);
  });

  it("ordinary QR tokens are unaffected (no citySelect)", async () => {
    const { createQRToken, verifySurveyToken } = await import("../auth-utils");
    const payload = await verifySurveyToken(await createQRToken("branch-1"));
    expect(payload).not.toBeNull();
    expect(payload!.citySelect).toBeUndefined();
    expect(payload!.branchId).toBe("branch-1");
  });
});
