export interface RatingResult {
  rating: number;
  reviewCount: number;
  success: boolean;
  error?: string;
}

export function parseRating(service: string, html: string): RatingResult {
  if (!html || html.length < 200) {
    return { rating: 0, reviewCount: 0, success: false, error: "Empty content or blocked" };
  }

  if (service === "yandex") {
    // Patterns ordered from current Yandex orgpage DOM (May 2026) down to
    // legacy / SSR / metadata fallbacks. Verified against a real network-shop
    // card; the previous regex set missed the count node on these cards
    // because they expose it as aria-label / inline text under
    // .business-header-rating-view__text, not as the old .Rating-Count div.
    const ratingPatterns = [
      /business-rating-badge-view__rating-text"[^>]*>\s*([\d.,]+)\s*</i,
      /rating-badge-view__rating-text"[^>]*>\s*([\d.,]+)\s*</i,
      /aria-label="\s*Оценка\s+([\d.,]+)\s+[Ии]з/i,
      /"ratingValue"\s*:\s*"?([\d.,]+)"?/i,
      /content="[^"]*?([\d.,]+)\s*из\s*5/i,
      /content="[^"]*?Рейтинг\s*([\d.,]+)/i,
      /class="Rating-Value"[^>]*>\s*([\d.,]+)\s*</i,
      /rating-text"[^>]*>\s*([\d.,]+)\s*<\/span>/i,
    ];
    const countPatterns = [
      // Anchor to .business-header-rating-view__text first — that's the only
      // node that carries the *card's* rating count. Without the anchor the
      // bare `aria-label="N оценок"` regex can grab an unrelated counter on
      // the page (observed on the Vologda card: 2279 instead of ~909).
      /business-header-rating-view__text[^>]*aria-label="\s*(\d[\d\s ]*)\s+оцен/i,
      /business-header-rating-view__text[^>]*>\s*(\d[\d\s ]*)\s+оцен/i,
      /aria-label="\s*(\d[\d\s ]*)\s+оцен[а-я]*"/i,
      />\s*(\d[\d\s ]*)\s+оцен[а-я]*\s*</i,
      /"reviewCount"\s*:\s*"?(\d+)"?/i,
      /content="[^"]*?(\d+)\s+отзыв/i,
      /content="[^"]*?([\d\s]+)\s+оценок/i,
      /class="Rating-Count"[^>]*>[^<]*?(\d+)[^<]*?</i,
      /(\d+)\s+оцен/i,
    ];

    let wRating: string | undefined;
    for (const p of ratingPatterns) {
      const m = html.match(p);
      if (m) { wRating = m[1]; break; }
    }
    let wCount: string | undefined;
    for (const p of countPatterns) {
      const m = html.match(p);
      if (m) { wCount = m[1]; break; }
    }

    if (wRating && wCount) {
      return {
        rating: Math.round(parseFloat(wRating.replace(',', '.')) * 10) / 10,
        reviewCount: parseInt(wCount.replace(/\s/g, ''), 10),
        success: true
      };
    }
  } else if (service === "google") {
    const patterns = [
      /\[\s*"[^"]*"\s*,\s*\[\s*([0-5]\.\d+)\s*,\s*(\d+)\s*\]/i,
      /aria-label="([0-5][.,]\d)\s*звезд[^"]* ([\d\s]+)\s*отзыв/i,
      /aria-label="([0-5][.,]\d)\s*stars[^"]* ([\d\s]+)\s*reviews/i,
      /aria-label=\"([\d\s,]+)\s+reviews\"/i,
      /aria-label=\"([\d\s,]+)\s+отзыв\"/i,
      /\[null,\s*([0-5][.,]\d+),\s*(\d+)\]/i,
      /\"ratingValue\":\s*\"([\d,.]+)\"/i,
      /\"reviewCount\":\s*\"(\d+)\"/i,
      /<span aria-hidden=\"true\">([0-5][.,]\d)<\/span>/i
    ];

    // First pass: patterns that capture both rating and count
    const gRating = html.match(/<span aria-hidden=\"true\">([0-5][.,]\d)<\/span>/i)?.[1];
    const gCount = html.match(/aria-label=\"([\d\s,]+)\s+reviews\"/i)?.[1] || 
                   html.match(/\(([\d\s,]+)\)\s*<\/span>\s*<\/span>/i)?.[1];

    if (gRating && gCount) {
      return {
        rating: Math.round(parseFloat(gRating.replace(',', '.')) * 10) / 10,
        reviewCount: parseInt(gCount.replace(/[^\d]/g, ''), 10),
        success: true
      };
    }

    // Original loop fallback
    for (const p of patterns) {
      const m = html.match(p);
      if (m && m[1] && m[2]) {
        return {
          rating: Math.round(parseFloat(m[1].replace(',', '.')) * 10) / 10,
          reviewCount: parseInt(m[2].replace(/[^\d]/g, ''), 10),
          success: true
        };
      }
    }
  } else if (service === "2gis") {
    const ogMatch = html.match(/property="og:description" content="[^"]*Оценка ([\d.]+)[^"]*?([\d\s]+) отзыв/i) ||
                    html.match(/Оценка ([\d.]+)[^,]*,\s*([\d\s]+) отзыв/i);
    const cssRating = html.match(/class=\"_y10azs\">([\d.]+)/i)?.[1];
    const cssCount = html.match(/class=\"_jspzdm\">(\d+)\s+оцен/i)?.[1];

    if (ogMatch) {
      return {
        rating: parseFloat(ogMatch[1]),
        reviewCount: parseInt(ogMatch[2].replace(/[^\d]/g, ''), 10),
        success: true
      };
    } else if (cssRating && cssCount) {
      return {
        rating: parseFloat(cssRating),
        reviewCount: parseInt(cssCount.replace(/[^\d]/g, ''), 10),
        success: true
      };
    }
  }

  return { rating: 0, reviewCount: 0, success: false, error: "Patterns not found" };
}
