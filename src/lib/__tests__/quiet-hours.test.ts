import { describe, expect, it } from "vitest";
import { isQuietHoursMsk, mskHour, nextSendTimeMsk } from "../quiet-hours";

// Helper: build a Date at a given MSK wall-clock time (MSK = UTC+3).
const msk = (iso: string) => new Date(`${iso}+03:00`);

describe("mskHour", () => {
  it("converts UTC to Moscow hours across the day boundary", () => {
    expect(mskHour(new Date("2026-07-28T21:15:00Z"))).toBe(0); // 00:15 МСК
    expect(mskHour(new Date("2026-07-28T06:00:00Z"))).toBe(9);
    expect(mskHour(new Date("2026-07-28T23:59:00Z"))).toBe(2);
  });
});

describe("isQuietHoursMsk", () => {
  it("is quiet from 20:00 through 08:59 MSK", () => {
    expect(isQuietHoursMsk(msk("2026-07-28T20:00:00"))).toBe(true);
    expect(isQuietHoursMsk(msk("2026-07-28T23:59:59"))).toBe(true);
    expect(isQuietHoursMsk(msk("2026-07-29T00:15:00"))).toBe(true); // ночной крон-слот
    expect(isQuietHoursMsk(msk("2026-07-29T06:15:00"))).toBe(true);
    expect(isQuietHoursMsk(msk("2026-07-29T08:59:59"))).toBe(true);
  });

  it("is allowed from 09:00 through 19:59 MSK", () => {
    expect(isQuietHoursMsk(msk("2026-07-29T09:00:00"))).toBe(false);
    expect(isQuietHoursMsk(msk("2026-07-29T12:15:00"))).toBe(false);
    expect(isQuietHoursMsk(msk("2026-07-29T19:59:59"))).toBe(false);
  });
});

describe("nextSendTimeMsk", () => {
  it("returns the input unchanged during the daytime window", () => {
    const d = msk("2026-07-29T15:30:00");
    expect(nextSendTimeMsk(d).getTime()).toBe(d.getTime());
  });

  it("evening rolls to 09:00 MSK the next day", () => {
    expect(nextSendTimeMsk(msk("2026-07-28T21:40:00")).toISOString()).toBe(
      msk("2026-07-29T09:00:00").toISOString()
    );
  });

  it("early morning rolls to 09:00 MSK the same day", () => {
    expect(nextSendTimeMsk(msk("2026-07-29T00:15:00")).toISOString()).toBe(
      msk("2026-07-29T09:00:00").toISOString()
    );
    expect(nextSendTimeMsk(msk("2026-07-29T08:59:00")).toISOString()).toBe(
      msk("2026-07-29T09:00:00").toISOString()
    );
  });

  it("handles the MSK-vs-UTC date mismatch (00:30 MSK is still 21:30 UTC yesterday)", () => {
    // 2026-07-29 00:30 МСК == 2026-07-28 21:30 UTC: "today's" UTC 06:00 has
    // passed, so the rollover lands on 2026-07-29 06:00 UTC == 09:00 МСК —
    // the correct same-MSK-day morning.
    expect(nextSendTimeMsk(new Date("2026-07-28T21:30:00Z")).toISOString()).toBe(
      "2026-07-29T06:00:00.000Z"
    );
  });
});
