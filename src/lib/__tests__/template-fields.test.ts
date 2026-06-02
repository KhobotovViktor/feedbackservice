import { describe, it, expect } from "vitest";
import { extractTemplateExtras } from "../template-fields";

describe("extractTemplateExtras", () => {
  it("trims slide-text fields and keeps only present keys", () => {
    const out = extractTemplateExtras({
      startTitle: "  Привет  ",
      successPositive: "Спасибо!",
      unrelated: "ignored",
    });
    expect(out.startTitle).toBe("Привет");
    expect(out.successPositive).toBe("Спасибо!");
    expect("lowTitle" in out).toBe(false);
    // @ts-expect-error — unrelated keys never leak through
    expect(out.unrelated).toBeUndefined();
  });

  it("maps blank strings to null", () => {
    const out = extractTemplateExtras({ startTitle: "   " });
    expect(out.startTitle).toBeNull();
  });

  it("coerces surveyFrequencyHours to a non-negative int", () => {
    expect(extractTemplateExtras({ surveyFrequencyHours: "168" }).surveyFrequencyHours).toBe(168);
    expect(extractTemplateExtras({ surveyFrequencyHours: -5 }).surveyFrequencyHours).toBe(0);
    expect(extractTemplateExtras({ surveyFrequencyHours: "abc" }).surveyFrequencyHours).toBe(0);
  });

  it("omits surveyFrequencyHours when absent", () => {
    const out = extractTemplateExtras({ startTitle: "x" });
    expect("surveyFrequencyHours" in out).toBe(false);
  });
});
