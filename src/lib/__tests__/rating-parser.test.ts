import { describe, it, expect } from "vitest";
import { parseRating } from "../rating-parser";

// Padding so the input clears the 200-char "blocked/empty" guard.
const PAD = "<!doctype html><html><head><title>x</title></head><body>" + "x".repeat(250);

describe("parseRating (yandex)", () => {
  it("reads rating + count from the current orgpage DOM", () => {
    const html =
      PAD +
      `<div class="business-rating-badge-view__rating-text">4,6</div>` +
      `<div class="business-header-rating-view__text" aria-label="856 оценок" role="button">856 оценок</div>` +
      `</body></html>`;
    const r = parseRating("yandex", html);
    expect(r.success).toBe(true);
    expect(r.rating).toBe(4.6);
    expect(r.reviewCount).toBe(856);
  });

  it("does NOT grab an unrelated counter elsewhere on the page", () => {
    // A stray "2279 оценок" sits before the real card node; the anchored
    // pattern must prefer the .business-header-rating-view__text count.
    const html =
      PAD +
      `<span aria-label="2279 оценок">2279 оценок</span>` +
      `<div class="business-rating-badge-view__rating-text">4,6</div>` +
      `<div class="business-header-rating-view__text" aria-label="909 оценок">909 оценок</div>` +
      `</body></html>`;
    const r = parseRating("yandex", html);
    expect(r.success).toBe(true);
    expect(r.reviewCount).toBe(909);
  });

  it("fails on empty or too-short content", () => {
    expect(parseRating("yandex", "").success).toBe(false);
    expect(parseRating("yandex", "<html>short</html>").success).toBe(false);
  });
});
