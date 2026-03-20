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
      // 1. Metadata / Schema.org (Most robust)
      const ratingProp = html.match(/itemProp="ratingValue" content="([0-9,.]+)"/i);
      const reviewProp = html.match(/itemProp="reviewCount" content="(\d+)"/i);
      
      if (ratingProp && reviewProp) {
        return {
          rating: parseFloat(ratingProp[1].replace(',', '.')),
          reviewCount: parseInt(reviewProp[1].replace(/\s/g, '')),
          success: true
        };
      }

      // 2. OpenGraph Description (Very common)
      // Matches both "Рейтинг 4,6 из 5 — 877 отзывов" and "⭐️ Рейтинг 4,6. 877 отзывов"
      const ogMatch = html.match(/property="og:description" content="[^"]*Рейтинг ([0-9,.]+)[^"—.]*[\s—.]+([\d\s]+) отзыв/i);
      if (ogMatch) {
        return {
          rating: parseFloat(ogMatch[1].replace(',', '.')),
          reviewCount: parseInt(ogMatch[2].replace(/\s/g, '')),
          success: true
        };
      }

      // 3. JSON-LD Fallback
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
      
      // 3. Fallback to rating components
      const ratingValue = html.match(/class="[^"]*rating-value[^"]*">([\d.]+)<\/span>/)?.[1];
      const countValue = html.match(/>(\d+)\s+оценок<\/span>/)?.[1] || html.match(/>(\d+)\s+отзыв/)?.[1];
      
      if (ratingValue) {
        return {
          rating: parseFloat(ratingValue),
          reviewCount: parseInt(countValue || "0"),
          success: true
        };
      }
    } else if (service === "google") {
      // Google is highly dynamic. Try multiple strategies:
      const patterns = [
        // 1. Aria-label (often present even in simpler versions)
        /aria-label="([0-5][.,]\d)\s*звезд[^"]* ([\d\s]+)\s*отзыв/i,
        /aria-label="([0-5][.,]\d)\s*stars[^"]* ([\d\s]+)\s*reviews/i,
        
        // 2. Numerical array in initialization state [rating, reviews]
        /\[null,\s*([0-5][.,]\d+),\s*(\d+)\]/i,
        /\["([^"]*)",\s*\[([0-5][.,]\d+),\s*(\d+)\]/i,

        // 3. String literals (last resort)
        /(\d[.,]\d) звезда/i,
        /Рейтинг:\s*(\d[.,]\d)/i,
        /([\d\s]+)\s*отзывов/i
      ];

      let rating: number | null = null;
      let count: number | null = null;

      for (const p of patterns) {
        const m = html.match(p);
        if (m) {
          if (m[2]) { // Pattern matched both
            rating = parseFloat(m[1].replace(',', '.'));
            count = parseInt(m[2].replace(/\s/g, ''));
            break;
          } else if (p.source.includes('отзыв') && !count) {
             count = parseInt(m[1].replace(/\s/g, ''));
          } else if (!rating) {
             rating = parseFloat(m[1].replace(',', '.'));
          }
        }
      }

      if (rating && count) {
        return { rating, reviewCount: count, success: true };
      }
    } else if (service === "2gis") {
      // 2GIS OG description is usually reliable: "Оценка 4.8, 249 отзывов"
      const ratingMatch = html.match(/Оценка ([\d.]+)/i) || html.match(/Rating ([\d.]+)/i);
      const countMatch = html.match(/(\d+)\s+отзыв/i) || html.match(/(\d+)\s+review/i);
      
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
      // 1. Try a more flexible generic pattern for the data array
      const ratingMatch = html.match(/\[(\d\.\d),\s*(\d+),\s*"[^"]*",\s*null/) || 
                          html.match(/\[(\d\.\d),\s*(\d+),/);
      if (ratingMatch) {
        return {
          rating: parseFloat(ratingMatch[1]),
          reviewCount: parseInt(ratingMatch[2]),
          success: true
        };
      }

      // 2. Try to find rating in Russian/English display strings (if served)
      const displayMatch = html.match(/([\d,.]+)\s*звезды,.+?([\d\s]+)\s*отзыв/) ||
                           html.match(/([\d,.]+)\s*stars,.+?([\d\s]+)\s*review/);
      if (displayMatch) {
         return {
            rating: parseFloat(displayMatch[1].replace(",", ".")),
            reviewCount: parseInt(displayMatch[2].replace(/\s/g, "")),
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
