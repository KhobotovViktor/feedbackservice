import { prisma } from "./prisma";
import { parseRating } from "./rating-parser";

export interface RatingResult {
  rating: number;
  reviewCount: number;
  success: boolean;
  error?: string;
}

export async function fetchExternalRating(url: string, service: "yandex" | "2gis" | "google"): Promise<RatingResult> {
  let cleanUrl = url.split("?")[0].replace(/\/$/, "");

  // Normalize URLs to canonical forms
  if (service === "yandex") {
    const orgIdMatch = cleanUrl.match(/\/org\/(\d+)/);
    if (orgIdMatch) cleanUrl = `https://yandex.ru/maps/org/${orgIdMatch[1]}`;
  } else if (service === "2gis") {
    const firmIdMatch = cleanUrl.match(/\/firm\/(\d+)/);
    const cityMatch = cleanUrl.match(/2gis\.ru\/([^/]+)/);
    if (firmIdMatch) {
      const city = cityMatch && cityMatch[1] !== 'firm' ? cityMatch[1] : 'vologda';
      cleanUrl = `https://2gis.ru/${city}/firm/${firmIdMatch[1]}`;
    }
  }

  const userAgents = [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  ];

  try {
    console.log(`Fetching ${service} rating from: ${cleanUrl}`);
    let html = "";

    // Phase 1: Direct Fetch with various UAs
    for (const ua of userAgents) {
      try {
        const response = await fetch(cleanUrl, {
          headers: { 
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "Cache-Control": "no-cache"
          },
          cache: 'no-store'
        });
        
        if (response.ok) {
          const fetchedHtml = await response.text();
          if (fetchedHtml.length > 1000 && !fetchedHtml.includes("captcha") && !fetchedHtml.includes("Detected as bot")) {
            const result = parseRating(service, fetchedHtml);
            if (result.success) return result;
          }
        }
      } catch (e) {
        console.warn(`${service} direct fetch error with UA ${ua.substring(0, 30)}...`);
      }
    }

    // Phase 2: Proxy Fallbacks
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanUrl)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanUrl)}`,
      `https://corsproxy.io/?${encodeURIComponent(cleanUrl)}`,
      `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(cleanUrl)}`,
      `https://proxy.cors.sh/${cleanUrl}`
    ];

    for (const proxyUrl of proxies) {
      console.log(`Using proxy fallback for ${service}: ${proxyUrl.substring(0, 50)}...`);
      try {
        const pResponse = await fetch(proxyUrl, { cache: 'no-store' });
        if (pResponse.ok) {
           let content = "";
           if (proxyUrl.includes("allorigins.win/get")) {
             const data = await pResponse.json();
             content = data.contents || "";
           } else {
             content = await pResponse.text();
           }

          if (content && content.length > 500 && !content.includes("captcha")) {
            const result = parseRating(service, content);
            if (result.success) return result;
          }
        }
      } catch (e) {
        console.warn(`${service} proxy failed:`, proxyUrl.substring(0, 50));
      }
    }

    return { rating: 0, reviewCount: 0, success: false, error: "Access blocked or data not found on all routes" };
  } catch (err: any) {
    console.error(`${service} sync exception:`, err);
    return { rating: 0, reviewCount: 0, success: false, error: err.message };
  }
}

export async function syncBranchRatings(branchId: string) {
  const branch = await prisma.branch.findUnique({
    where: { id: branchId }
  });
  
  if (!branch) return [];

  const updateResults = [];
  const configs = [
    { key: "yandexUrl", type: "yandex" as const },
    { key: "dgisUrl", type: "2gis" as const },
    { key: "googleUrl", type: "google" as const }
  ];

  for (const config of configs) {
    const url = (branch as any)[config.key];
    if (url) {
      console.log(`Syncing ${config.type} for branch ${branch.name}...`);
      const res = await fetchExternalRating(url, config.type);
      if (res.success) {
        await prisma.ratingHistory.create({
          data: { branchId, service: config.type, rating: res.rating, reviewCount: res.reviewCount }
        });
        updateResults.push({ service: config.type, status: "success", rating: res.rating, count: res.reviewCount });
      } else {
        console.warn(`${config.type} sync failed: ${res.error}`);
        updateResults.push({ service: config.type, status: "failed", error: res.error });
      }
    }
  }

  return updateResults;
}
