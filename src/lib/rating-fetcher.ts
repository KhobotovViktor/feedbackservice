import { prisma } from "./prisma";

export interface RatingResult {
  rating: number;
  reviewCount: number;
  success: boolean;
  error?: string;
}

export async function fetchExternalRating(url: string, service: "yandex" | "2gis" | "google"): Promise<RatingResult> {
  const desktopUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
  const mobileUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
  
  let cleanUrl = url.split("?")[0].replace(/\/$/, "");

  // Normalize URLs to canonical forms if possible
  if (service === "yandex") {
    const orgIdMatch = cleanUrl.match(/\/org\/(\d+)/);
    if (orgIdMatch) {
      cleanUrl = `https://yandex.ru/maps/org/${orgIdMatch[1]}`;
    }
  } else if (service === "2gis") {
    const firmIdMatch = cleanUrl.match(/\/firm\/(\d+)/);
    const cityMatch = cleanUrl.match(/2gis\.ru\/([^/]+)/);
    if (firmIdMatch) {
      const city = cityMatch && cityMatch[1] !== 'firm' ? cityMatch[1] : 'russia';
      cleanUrl = `https://2gis.ru/${city}/firm/${firmIdMatch[1]}`;
    }
  }

  try {
    console.log(`Fetching ${service} rating from: ${cleanUrl}`);
    const response = await fetch(cleanUrl, {
      headers: { 
        "User-Agent": service === "google" ? mobileUA : desktopUA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
        "Referer": service === "google" ? "https://www.google.com/" : `https://www.${service}.ru/`,
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
      },
      cache: 'no-store'
    });

    if (!response.ok) {
        console.error(`${service} fetch error: HTTP ${response.status}`);
        return { rating: 0, reviewCount: 0, success: false, error: `HTTP ${response.status}` };
    }
    
    const html = await response.text();

    if (html.includes("captcha") || html.includes("check_robot") || html.includes("checkbox-captcha")) {
       return { rating: 0, reviewCount: 0, success: false, error: "Bot detection (CAPTCHA) triggered" };
    }

    if (service === "yandex") {
      // Try Yandex Widget first (extremely reliable on Vercel)
      const orgId = cleanUrl.match(/\/org\/(\d+)/)?.[1];
      if (orgId) {
        const widgetUrl = `https://yandex.ru/maps-reviews-widget/${orgId}?comments`;
        try {
          const widgetRes = await fetch(widgetUrl, { headers: { "User-Agent": desktopUA } });
          if (widgetRes.ok) {
            const wHtml = await widgetRes.text();
            const wRating = wHtml.match(/class=\"Rating-Value\">([\d,.]+)<\/div>/)?.[1] || 
                            wHtml.match(/\"ratingValue\":\s*\"([\d,.]+)\"/)?.[1];
            const wCount = wHtml.match(/class=\"Rating-Count\">[^<]*?(\d+)[^<]*?<\/div>/)?.[1] || 
                           wHtml.match(/\"reviewCount\":\s*\"(\d+)\"/)?.[1];
            
            if (wRating && wCount) {
              return {
                rating: Math.round(parseFloat(wRating.replace(',', '.')) * 10) / 10,
                reviewCount: parseInt(wCount.replace(/\s/g, '')),
                success: true
              };
            }
          }
        } catch (e) {
          console.warn("Yandex Widget fetch failed, falling back to main page...");
        }
      }

      // Metadata / Schema.org (Main page fallback)
      const ratingProp = html.match(/itemProp="ratingValue" content="([0-9,.]+)"/i);
      const reviewProp = html.match(/itemProp="reviewCount" content="(\d+)"/i);
      
      if (ratingProp && reviewProp) {
        return {
          rating: Math.round(parseFloat(ratingProp[1].replace(',', '.')) * 10) / 10,
          reviewCount: parseInt(reviewProp[1].replace(/\s/g, '')),
          success: true
        };
      }

      // 2. OpenGraph Description (Very common)
      // Matches: "⭐️ Рейтинг 4,6. 877 отзывов"
      const ogMatch = html.match(/property="og:description" content="[^"]*Рейтинг\s*([\d,.]+)[^"]*?([\d\s]+)\s*отзыв/i) ||
                      html.match(/content="[^"]*Рейтинг\s*([\d,.]+)[^"]*?([\d\s]+)\s*отзыв/i) ||
                      html.match(/Рейтинг\s*([\d,.]+)[^"]*?([\d\s]+)\s*отзыв/i);
      if (ogMatch) {
        return {
          rating: Math.round(parseFloat(ogMatch[1].replace(',', '.')) * 10) / 10,
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
        // 1. High-precision array [ "Business Name", [4.21855, 458] ]
        /\[\s*"[^"]*"\s*,\s*\[\s*([0-5]\.\d+)\s*,\s*(\d+)\s*\]/i,
        
        // 2. Aria-label (often present even in simpler versions)
        /aria-label="([0-5][.,]\d)\s*звезд[^"]* ([\d\s]+)\s*отзыв/i,
        /aria-label="([0-5][.,]\d)\s*stars[^"]* ([\d\s]+)\s*reviews/i,
        
        // 3. Numerical array in initialization state [rating, reviews]
        /\[null,\s*([0-5][.,]\d+),\s*(\d+)\]/i,

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
            rating = Math.round(parseFloat(m[1].replace(',', '.')) * 10) / 10;
            count = parseInt(m[2].replace(/\s/g, ''));
            break;
          } else if (p.source.includes('отзыв') && !count) {
             count = parseInt(m[1].replace(/\s/g, ''));
          } else if (!rating) {
             rating = Math.round(parseFloat(m[1].replace(',', '.')) * 10) / 10;
          }
        }
      }

      if (rating && count) {
        return { rating, reviewCount: count, success: true };
      }
    } else if (service === "2gis") {
      // 2GIS OG description is usually reliable: "Оценка 4.8, 249 отзывов"
      const ogMatch = html.match(/property="og:description" content="[^"]*Оценка ([\d.]+)[^"]*?([\d\s]+) отзыв/i) ||
                      html.match(/Оценка ([\d.]+)[^,]*,\s*([\d\s]+) отзыв/i);
      
      if (ogMatch) {
         return {
            rating: Math.round(parseFloat(ogMatch[1]) * 10) / 10,
            reviewCount: parseInt(ogMatch[2].replace(/\s/g, "")),
            success: true
         };
      }

      const ratingMatch = html.match(/Оценка ([\d.]+)/i) || html.match(/Rating ([\d.]+)/i);
      const countMatch = html.match(/(\d+)\s+отзыв/i) || html.match(/(\d+)\s+review/i);
      
      if (ratingMatch && countMatch) {
         return {
            rating: Math.round(parseFloat(ratingMatch[1]) * 10) / 10,
            reviewCount: parseInt(countMatch[1].replace(/\s/g, "")),
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

    console.log(`${service} extraction failed. HTML length: ${html.length}. Snippet: ${html.substring(0, 300).replace(/\s+/g, ' ')}`);
    return { rating: 0, reviewCount: 0, success: false, error: "Data markers not found" };
  } catch (err: any) {
    console.error(`${service} sync exception:`, err);
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
    console.log(`Syncing Yandex for branch ${branch.name}...`);
    const res = await fetchExternalRating(branch.yandexUrl, "yandex");
    if (res.success) {
      await prisma.ratingHistory.create({
        data: { branchId, service: "yandex", rating: res.rating, reviewCount: res.reviewCount }
      });
      results.push({ service: "yandex", status: "success", rating: res.rating, count: res.reviewCount });
    } else {
      console.warn(`Yandex sync failed for ${branch.name}: ${res.error || "Data markers not found"}`);
      results.push({ service: "yandex", status: "failed", error: res.error || "Data markers not found" });
    }
  }

  if (branch.dgisUrl) {
    console.log(`Syncing 2GIS for branch ${branch.name}...`);
    const res = await fetchExternalRating(branch.dgisUrl, "2gis");
    if (res.success) {
      await prisma.ratingHistory.create({
        data: { branchId, service: "2gis", rating: res.rating, reviewCount: res.reviewCount }
      });
      results.push({ service: "2gis", status: "success", rating: res.rating, count: res.reviewCount });
    } else {
      console.warn(`2GIS sync failed for ${branch.name}: ${res.error || "Data markers not found"}`);
      results.push({ service: "2gis", status: "failed", error: res.error || "Data markers not found" });
    }
  }

  if (branch.googleUrl) {
    console.log(`Syncing Google for branch ${branch.name}...`);
    const res = await fetchExternalRating(branch.googleUrl, "google");
    if (res.success) {
      await prisma.ratingHistory.create({
        data: { branchId, service: "google", rating: res.rating, reviewCount: res.reviewCount }
      });
      results.push({ service: "google", status: "success", rating: res.rating, count: res.reviewCount });
    } else {
      console.warn(`Google sync failed for ${branch.name}: ${res.error || "Data markers not found"}`);
      results.push({ service: "google", status: "failed", error: res.error || "Data markers not found" });
    }
  }

  return results;
}
