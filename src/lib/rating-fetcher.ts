import { prisma } from "./prisma";
import { parseRating } from "./rating-parser";

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
    let usedProxy = false;

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

    // Phase 2: Proxy Fallbacks
    if (!html) {
      const proxies = [
        (u: string) => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
        (u: string) => `https://corsproxy.io/?${encodeURIComponent(u)}`
      ];

      for (const getProxyUrl of proxies) {
        console.log(`Using proxy fallback for ${service}...`);
        try {
          const proxyUrl = getProxyUrl(cleanUrl);
          const pResponse = await fetch(proxyUrl, { cache: 'no-store' });
          if (pResponse.ok) {
            const data = await pResponse.json();
            const content = data.contents || data.body || "";
            if (content && content.length > 500 && !content.includes("captcha")) {
              html = content;
              usedProxy = true;
              break;
            }
          }
        } catch (e) {
          console.warn(`${service} proxy failed:`, e);
        }
      }
    }

    if (!html || html.length < 200) {
      return { rating: 0, reviewCount: 0, success: false, error: "Access blocked (Captcha/403) on all routes" };
    }

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
