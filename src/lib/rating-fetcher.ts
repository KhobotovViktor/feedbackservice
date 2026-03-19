import { prisma } from "./prisma";

export interface RatingResult {
  rating: number;
  reviewCount: number;
  success: boolean;
  error?: string;
}

export async function fetchExternalRating(url: string, service: "yandex" | "2gis" | "google"): Promise<RatingResult> {
  const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  
  let cleanUrl = url.split("?")[0].replace(/\/$/, "");

  // Normalize URLs to canonical forms if possible
  if (service === "yandex") {
    const orgIdMatch = cleanUrl.match(/\/org\/(\d+)/);
    if (orgIdMatch) {
      cleanUrl = `https://yandex.ru/maps/org/${orgIdMatch[1]}`;
    }
  } else if (service === "2gis") {
    const firmIdMatch = cleanUrl.match(/\/firm\/(\d+)/);
    if (firmIdMatch) {
      cleanUrl = `https://2gis.ru/firm/${firmIdMatch[1]}`;
    }
  }

  try {
    console.log(`Fetching ${service} rating from: ${cleanUrl}`);
    const response = await fetch(cleanUrl, {
      headers: { 
        "User-Agent": userAgent,
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": "https://www.google.com/"
      }
    });

    if (!response.ok) {
        return { rating: 0, reviewCount: 0, success: false, error: `HTTP ${response.status}` };
    }
    
    const html = await response.text();

    if (service === "yandex") {
      // 1. Try JSON-LD (most robust)
      const ldMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if (ldMatch) {
        try {
          const data = JSON.parse(ldMatch[1]);
          const aggregate = Array.isArray(data) ? data.find((d: any) => d.aggregateRating)?.aggregateRating : data.aggregateRating;
          if (aggregate) {
            return {
              rating: parseFloat(aggregate.ratingValue),
              reviewCount: parseInt(aggregate.reviewCount),
              success: true
            };
          }
        } catch (e) {}
      }
      
      // 2. Fallback to rating components
      const ratingValue = html.match(/class="[^"]*rating-value[^"]*">([\d.]+)<\/span>/)?.[1];
      const countValue = html.match(/>(\d+)\s+оценок<\/span>/)?.[1] || html.match(/>(\d+)\s+отзыв/)?.[1];
      
      if (ratingValue) {
        return {
          rating: parseFloat(ratingValue),
          reviewCount: parseInt(countValue || "0"),
          success: true
        };
      }
    }

    if (service === "2gis") {
      // Look for OG:description: "Оценка 4.8, 56 фото, 249 отзывов."
      const ogMatch = html.match(/<meta property="og:description" content="[^"]*Оценка ([\d.]+)[^"]* ([\d\s]+) отзыв/);
      if (ogMatch) {
        return {
          rating: parseFloat(ogMatch[1]),
          reviewCount: parseInt(ogMatch[2].replace(/\s/g, "")),
          success: true
        };
      }
      
      // Fallback: look for generic ratings count
      const countMatch = html.match(/(\d+)\s+отзывов/);
      const ratingMatch = html.match(/"ratingValue":\s*([\d.]+)/) || html.match(/"rating":\s*([\d.]+)/);
      if (ratingMatch && countMatch) {
         return {
            rating: parseFloat(ratingMatch[1]),
            reviewCount: parseInt(countMatch[1]),
            success: true
         };
      }
    }

    if (service === "google") {
      // Google is extremely hard without a real browser. 
      // We might need to use a dedicated API or a more complex scraper.
      // For now, let's try to find a simple marker.
      const ratingMatch = html.match(/\[(\d\.\d),\s*(\d+),\s*"[^"]*",\s*null/);
      if (ratingMatch) {
        return {
          rating: parseFloat(ratingMatch[1]),
          reviewCount: parseInt(ratingMatch[2]),
          success: true
        };
      }
    }

    return { rating: 0, reviewCount: 0, success: false, error: "Data markers not found" };
  } catch (err: any) {
    return { rating: 0, reviewCount: 0, success: false, error: err.message };
  }
}

export async function syncBranchRatings(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId }
  });
  
  if (!branch) return;

  const results = [];

  if (branch.yandexUrl) {
    const res = await fetchExternalRating(branch.yandexUrl, "yandex");
    if (res.success) {
      await prisma.ratingHistory.create({
        data: { branchId, service: "yandex", rating: res.rating, reviewCount: res.reviewCount }
      });
      results.push({ service: "yandex", ...res });
    }
  }

  if (branch.dgisUrl) {
    const res = await fetchExternalRating(branch.dgisUrl, "2gis");
    if (res.success) {
      await prisma.ratingHistory.create({
        data: { branchId, service: "2gis", rating: res.rating, reviewCount: res.reviewCount }
      });
      results.push({ service: "2gis", ...res });
    }
  }

  if (branch.googleUrl) {
    const res = await fetchExternalRating(branch.googleUrl, "google");
    if (res.success) {
      await prisma.ratingHistory.create({
        data: { branchId, service: "google", rating: res.rating, reviewCount: res.reviewCount }
      });
      results.push({ service: "google", ...res });
    }
  }

  return results;
}
