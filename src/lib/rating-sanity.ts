import { prisma } from "./prisma";

export interface SanityResult {
  ok: boolean;
  reason?: string;
  previous?: { rating: number; reviewCount: number; createdAt: Date };
}

// Thresholds: any incoming sync that drifts from the last successful one by
// more than these is treated as "almost certainly the wrong business".
// Tuned to be generous enough that real growth (a new burst of reviews after
// a campaign) still passes, while obvious mis-matches (a Tutaev shop with 96
// reviews suddenly reporting 694) are blocked.
const REVIEW_COUNT_RATIO = 3; // >3× or <1/3× = reject
const RATING_DELTA = 1.5; // >1.5★ swing = reject

/**
 * Reject obviously-bogus rating syncs.
 *
 * The Apps Script side does a Serper text search ("Аллея Мебели, Тутаев") and
 * blindly takes the first knowledge-panel result. When the query is ambiguous
 * Google returns a *different* business with vastly more reviews, and the
 * value lands in our DB — polluting branch history and the dashboard chart.
 *
 * We compare each incoming sync against the latest RatingHistory row for
 * (branchId, service): if the review-count ratio is >3× / <1/3×, or the
 * rating moved by more than 1.5★, the write is refused with 422 and an
 * explanation. The Apps Script logs the rejection so the admin can fix the
 * underlying search query.
 *
 * Edge cases: the first-ever sync for a (branch, service) pair has no
 * baseline → we always accept it. If a legitimate big jump *did* happen, the
 * caller can pass `force: true` to bypass the check.
 */
export async function checkRatingSanity(
  branchId: string,
  service: string,
  rating: number,
  reviewCount: number
): Promise<SanityResult> {
  const last = await prisma.ratingHistory.findFirst({
    where: { branchId, service },
    orderBy: { createdAt: "desc" },
    select: { rating: true, reviewCount: true, createdAt: true },
  });
  if (!last || last.reviewCount <= 0) return { ok: true };

  const ratio = reviewCount / last.reviewCount;
  const ratingDelta = Math.abs(rating - last.rating);

  if (ratio > REVIEW_COUNT_RATIO || ratio < 1 / REVIEW_COUNT_RATIO) {
    return {
      ok: false,
      reason: `reviewCount ${last.reviewCount} → ${reviewCount} (×${ratio.toFixed(1)}) — likely wrong place`,
      previous: last,
    };
  }
  if (ratingDelta > RATING_DELTA) {
    return {
      ok: false,
      reason: `rating ${last.rating} → ${rating} (Δ${ratingDelta.toFixed(1)}★) — likely wrong place`,
      previous: last,
    };
  }
  return { ok: true };
}
