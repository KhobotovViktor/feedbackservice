import { prisma } from "./prisma";
import { parseRating } from "./rating-parser";

export interface RatingResult {
  rating: number;
  reviewCount: number;
  success: boolean;
  error?: string;
}

// Per-service allowlist of hostnames we are willing to scrape. Anything else
// is rejected — including private IPs, AWS metadata, and arbitrary attacker
// URLs that an admin could paste into a branch's yandexUrl/dgisUrl field.
// Without this, an admin (or someone who compromised an admin session) could
// pivot fetchExternalRating into SSRF — the function fetches whatever URL it
// gets and returns the body downstream.
const ALLOWED_HOSTS: Record<string, RegExp[]> = {
  yandex: [/^([\w-]+\.)*yandex\.(ru|com|by|kz|ua)$/i, /^([\w-]+\.)*ya\.ru$/i],
  "2gis": [/^([\w-]+\.)*2gis\.(ru|com|kz|ae|cz|cy|cl|ar|by|kg|me|ua)$/i],
  google: [/^([\w-]+\.)*google\.(com|ru|by|kz)$/i, /^([\w-]+\.)*g\.co$/i],
};

function isSafeRatingUrl(url: string, service: "yandex" | "2gis" | "google"): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    // Reject loopback / private ranges explicitly even before allowlist check.
    if (
      host === "localhost" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      host.startsWith("169.254.") ||
      host === "0.0.0.0" ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return false;
    }
    return ALLOWED_HOSTS[service]?.some((re) => re.test(host)) ?? false;
  } catch {
    return false;
  }
}

export async function fetchExternalRating(url: string, service: "yandex" | "2gis" | "google"): Promise<RatingResult> {
  if (!isSafeRatingUrl(url, service)) {
    console.warn(`Refusing to fetch rating from unsafe URL for ${service}: ${url}`);
    return { rating: 0, reviewCount: 0, success: false, error: "URL not on the allowlist" };
  }
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

    // Direct fetch with several UAs. The previous "Phase 2" proxy fallbacks
    // (api.allorigins.win, corsproxy.io, etc.) were removed because they're
    // untrusted intermediaries that can return arbitrary content — combined
    // with no URL validation, they amounted to SSRF amplifiers. Now that
    // isSafeRatingUrl() bounds where we fetch from, the direct path is
    // sufficient; failures here just return success=false, which the caller
    // already handles gracefully.
    for (const ua of userAgents) {
      try {
        const response = await fetch(cleanUrl, {
          headers: {
            "User-Agent": ua,
            "Accept":
              "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
            "Cache-Control": "no-cache",
          },
          cache: "no-store",
        });

        if (response.ok) {
          const fetchedHtml = await response.text();
          if (
            fetchedHtml.length > 1000 &&
            !fetchedHtml.includes("captcha") &&
            !fetchedHtml.includes("Detected as bot")
          ) {
            const result = parseRating(service, fetchedHtml);
            if (result.success) return result;
          }
        }
      } catch {
        console.warn(`${service} direct fetch error with UA ${ua.substring(0, 30)}...`);
      }
    }

    return {
      rating: 0,
      reviewCount: 0,
      success: false,
      error: "Access blocked or data not found",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error(`${service} sync exception:`, msg);
    return { rating: 0, reviewCount: 0, success: false, error: msg };
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
