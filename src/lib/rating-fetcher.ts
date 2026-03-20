import { prisma } from "./prisma";

export interface RatingResult {
  rating: number;
  reviewCount: number;
  success: boolean;
  error?: string;
}

export async function fetchExternalRating(url: string, service: "yandex" | "2gis" | "google"): Promise<RatingResult> {
  const googleBotUA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  const desktopUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
  
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
      const city = cityMatch && cityMatch[1] !== 'firm' ? cityMatch[1] : 'vologda';
      cleanUrl = `https://2gis.ru/${city}/firm/${firmIdMatch[1]}`;
    }
  }

  try {
    console.log(`Fetching ${service} rating from: ${cleanUrl}`);
    
    let html = "";

    // Phase 1: Direct Fetch with Googlebot UA
    try {
      const response = await fetch(cleanUrl, {
        headers: { 
          "User-Agent": googleBotUA,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
          "Referer": `https://www.${service}.ru/`,
          "Cache-Control": "no-cache"
        },
        cache: 'no-store'
      });
      
      if (response.ok) {
        html = await response.text();
        // Check if direct fetch got a meaningful page
        if (html.includes("captcha") || html.includes("check_robot") || html.includes("checkbox-captcha") || html.length < 1000) {
           html = ""; // Trigger fallback
        }
      }
    } catch (e) {
      console.warn(`${service} direct fetch error:`, e);
    }

    // Phase 2: Proxy Fallback (AllOrigins)
    if (!html) {
      console.log(`Using proxy fallback for ${service}...`);
      try {
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(cleanUrl)}`;
        const pResponse = await fetch(proxyUrl, { cache: 'no-store' });
        if (pResponse.ok) {
          const data = await pResponse.json();
          html = data.contents || "";
        }
      } catch (e) {
        console.error(`${service} proxy fallback failed:`, e);
      }
    }

    if (!html || html.length < 200) {
      return { rating: 0, reviewCount: 0, success: false, error: "Access blocked (Captcha/403) on both direct and proxy routes" };
    }

    if (service === "yandex") {
      // 1. Try Widget extraction first
      const wRating = html.match(/class=\"Rating-Value\">([\d,.]+)<\/div>/)?.[1] || 
                      html.match(/\"ratingValue\":\s*\"([\d,.]+)\"/)?.[1];
      const wCount = html.match(/class=\"Rating-Count\">[^<]*?(\d+)[^<]*?<\/div>/)?.[1] || 
                     html.match(/\"reviewCount\":\s*\"(\d+)\"/)?.[1];
      
      if (wRating && wCount) {
        return {
          rating: Math.round(parseFloat(wRating.replace(',', '.')) * 10) / 10,
          reviewCount: parseInt(wCount.replace(/\s/g, '')),
          success: true
        };
      }

      // 2. Metadata / Schema.org
      const ratingProp = html.match(/itemProp="ratingValue" content="([0-9,.]+)"/i);
      const reviewProp = html.match(/itemProp="reviewCount" content="(\d+)"/i);
      if (ratingProp && reviewProp) {
        return {
          rating: Math.round(parseFloat(ratingProp[1].replace(',', '.')) * 10) / 10,
          reviewCount: parseInt(reviewProp[1].replace(/\s/g, '')),
          success: true
        };
      }

      // 3. OG / Meta
      const ogMatch = html.match(/property="og:description" content="[^"]*Рейтинг\s*([\d,.]+)[^"]*?([\d\s]+)\s*отзыв/i) ||
                      html.match(/content="[^"]*Рейтинг\s*([\d,.]+)[^"]*?([\d\s]+)\s*отзыв/i);
      if (ogMatch) {
        return {
          rating: Math.round(parseFloat(ogMatch[1].replace(',', '.')) * 10) / 10,
          reviewCount: parseInt(ogMatch[2].replace(/\s/g, '')),
          success: true
        };
      }
    } else if (service === "google") {
      const patterns = [
        /\[\s*"[^"]*"\s*,\s*\[\s*([0-5]\.\d+)\s*,\s*(\d+)\s*\]/i,
        /aria-label="([0-5][.,]\d)\s*звезд[^"]* ([\d\s]+)\s*отзыв/i,
        /aria-label="([0-5][.,]\d)\s*stars[^"]* ([\d\s]+)\s*reviews/i,
        /\[null,\s*([0-5][.,]\d+),\s*(\d+)\]/i,
        /(\d[.,]\d) звезда.+?([\d\s]+)\s*отзыв/i
      ];

      for (const p of patterns) {
        const m = html.match(p);
        if (m && m[1] && m[2]) {
          return {
            rating: Math.round(parseFloat(m[1].replace(',', '.')) * 10) / 10,
            reviewCount: parseInt(m[2].replace(/\s/g, '')),
            success: true
          };
        }
      }
    } else if (service === "2gis") {
      const ogMatch = html.match(/property="og:description" content="[^"]*Оценка ([\d.]+)[^"]*?([\d\s]+) отзыв/i) ||
                      html.match(/Оценка ([\d.]+)[^,]*,\s*([\d\s]+) отзыв/i);
      
      if (ogMatch) {
         return {
            rating: Math.round(parseFloat(ogMatch[1]) * 10) / 10,
            reviewCount: parseInt(ogMatch[2].replace(/\s/g, "")),
            success: true
         };
      }
    }

    console.log(`${service} data not found. HTML snippet: ${html.substring(0, 200).replace(/\s+/g, ' ')}`);
    return { rating: 0, reviewCount: 0, success: false, error: "Data markers not found in page content" };
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
