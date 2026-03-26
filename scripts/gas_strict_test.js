const fs = require('fs');

async function testGoogleExtraction() {
  const scraperKey = "06eeb0519264e083ad4b9da58a7f6902";
  const query = "Аллея Мебели Вологда отзывы";
  const gUrl = `https://www.google.ru/search?q=${encodeURIComponent(query)}`;
  const scraperUrl = `http://api.scraperapi.com/?api_key=${scraperKey}&country_code=ru&render=true&url=${encodeURIComponent(gUrl)}`;
  
  console.log("Fetching Google HTML...");
  try {
    const res = await fetch(scraperUrl);
    const html = await res.text();
    fs.writeFileSync('d:\\AI\\Antigravity\\feedback-service\\scripts\\debug_google_render.html', html);
    console.log(`Saved HTML (${html.length} bytes). Testing regexes...`);
    
    // User's regex (the one that gives Yandex 4.6):
    const userRMatch = html.match(/<span[^>]*>([0-5][.,]\d)<\/span>[^<]*<a[^>]*>/i) || html.match(/Оценка:\s*([0-5][.,]\d)/i) || html.match(/aria-label="Рейтинг ([0-5][.,]\d) из 5/i) || html.match(/>([0-5][.,]\d)<\/span>/);
    const userCMatch = html.match(/>([\d\s\u00A0]+)\s*(?:отзыв|отзыва|отзывов)/i) || html.match(/aria-label="[^"]*?([\d\s\u00A0]+)\s*(?:отзыв|отзыва|отзывов)/i) || html.match(/<a[^>]*>([\d\s\u00A0]+)\s*(?:Google|отзыв)/i) || html.match(/<span>\(([\d\s\u00A0]+)\)<\/span>/i) || html.match(/\(([\d\s\u00A0]+)\)/);
    
    console.log("User Regex result:", userRMatch?.[1], "/", userCMatch?.[1]);

    // My STRICT regex (targeting specifically "отзывов в Google" or similar Knowledge Graph block):
    let newRMatch, newCMatch;
    
    // First, try finding the block with Google reviews
    const gBlock = html.match(/([1-5][.,]\d)[\s\S]{0,300}?([\d\s\u00A0]+)\s*отзыв[^\s]*\s*в\s*Google/i);
    if (gBlock) {
      newRMatch = gBlock[1];
      newCMatch = gBlock[2];
      console.log("Matched gBlock!");
    } else {
        // Fallback for native google places block
        const nRMatch = html.match(/<span[^>]*aria-hidden="true"[^>]*>([1-5][.,]\d)<\/span>/) || html.match(/<span[^>]*>([1-5][.,]\d)<\/span>\s*<span[^>]*aria-label="[^"]*отзывов/);
        const nCMatch = html.match(/<span[^>]*aria-label="([\d\s\u00A0]+)\s*отзыв/);
        if (nRMatch) newRMatch = nRMatch[1];
        if (nCMatch) newCMatch = nCMatch[1];
    }
    
    console.log("New STRICT Regex result:", newRMatch, "/", newCMatch);

  } catch(e) { console.error("Error:", e); }
}

testGoogleExtraction();
