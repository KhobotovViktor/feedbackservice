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
    let wRating = html.match(/class=\"Rating-Value\">([\d,.]+)<\/div>/)?.[1] || 
                  html.match(/\"ratingValue\":\s*\"([\d,.]+)\"/)?.[1] ||
                  html.match(/rating-text\">([\d,.]+)<\/span>/)?.[1] ||
                  html.match(/rating-badge-view__rating-text\">([\d,.]+)<\/span>/)?.[1];

    let wCount = html.match(/class=\"Rating-Count\">[^<]*?(\d+)[^<]*?<\/div>/)?.[1] || 
                 html.match(/\"reviewCount\":\s*\"(\d+)\"/)?.[1] ||
                 html.match(/aria-label=\"(\d+)\s+оцен/)?.[1] ||
                 html.match(/(\d+)\s+оцен/)?.[1];
    
    if (!wRating) {
      const metaRating = html.match(/content=\"[^"]*?([\d,.]+)\s*из\s*5/i) || 
                         html.match(/content=\"[^"]*?Рейтинг\s*([\d,.]+)/i);
      const metaCount = html.match(/content=\"[^"]*?(\d+)\s+отзыв/i) ||
                        html.match(/content=\"[^"]*?([\d\s]+)\s+оценок/i);
      if (metaRating) wRating = metaRating[1];
      if (metaCount) wCount = metaCount[1];
    }

    if (wRating && wCount) {
      return {
        rating: Math.round(parseFloat(wRating.replace(',', '.')) * 10) / 10,
        reviewCount: parseInt(wCount.replace(/\s/g, '')),
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

    for (const p of patterns) {
      const m = html.match(p);
      if (m && m.length >= 2) {
        // Special case for patterns that only match one thing (like the new user count one)
        // But we need both rating and count. So we'll refine the loop.
      }
    }

    // Secondary pass for single captures
    const gRating = html.match(/<span aria-hidden=\"true\">([0-5][.,]\d)<\/span>/i)?.[1];
    const gCount = html.match(/aria-label=\"([\d\s,]+)\s+reviews\"/i)?.[1] || 
                   html.match(/\(([\d\s,]+)\)\s*<\/span>\s*<\/span>/i)?.[1];

    if (gRating && gCount) {
      return {
        rating: Math.round(parseFloat(gRating.replace(',', '.')) * 10) / 10,
        reviewCount: parseInt(gCount.replace(/[^\d]/g, '')),
        success: true
      };
    }

    // Original loop fallback
    for (const p of patterns) {
      const m = html.match(p);
      if (m && m[1] && m[2]) {
        return {
          rating: Math.round(parseFloat(m[1].replace(',', '.')) * 10) / 10,
          reviewCount: parseInt(m[2].replace(/[^\d]/g, '')),
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
        reviewCount: parseInt(ogMatch[2].replace(/[^\d]/g, '')),
        success: true
      };
    } else if (cssRating && cssCount) {
      return {
        rating: parseFloat(cssRating),
        reviewCount: parseInt(cssCount.replace(/[^\d]/g, '')),
        success: true
      };
    }
  }

  return { rating: 0, reviewCount: 0, success: false, error: "Patterns not found" };
}
