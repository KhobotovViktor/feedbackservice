const fs = require('fs');

async function testExtraction() {
  const scraperKey = "06eeb0519264e083ad4b9da58a7f6902";
  
  // 1. Google (premium=true)
  console.log("=== Testing Google (premium=true) ===");
  const query = "Аллея Мебели Вологда отзывы";
  const gUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ru`;
  const gScraper = `http://api.scraperapi.com/?api_key=${scraperKey}&premium=true&country_code=ru&url=${encodeURIComponent(gUrl)}`;
  
  try {
    const res = await fetch(gScraper);
    console.log(`Google Status: ${res.status}`);
    const html = await res.text();
    fs.writeFileSync('d:\\AI\\Antigravity\\feedback-service\\debug_google.html', html);
    
    let rating = null, count = null;
    let gBlock = html.match(/(\d[\.,]\d)[\s\S]{0,200}?(\d[\s\d]*)\s*отзыв\S*\s+в\s+Google/);
    if (!gBlock) gBlock = html.match(/(\d[\.,]\d)[\s\S]{0,200}?(\d[\s\d]*)\s*Google\s*reviews/);
    
    if (gBlock) { rating = gBlock[1].replace(",", "."); count = gBlock[2].replace(/\D/g, ""); console.log("Google match: strict block"); }
    if (!rating) {
      const rMatch = html.match(/data-rating="(\d[\.,]\d)"/) || html.match(/aria-label="[^"]*?(\d[\.,]\d)\s/);
      const cMatch = html.match(/(\d+)\s+Google\s+reviews/) || html.match(/(\d+)\s*отзыв/);
      if (rMatch) rating = rMatch[1].replace(",", ".");
      if (cMatch) count = cMatch[1].replace(/\D/g, "");
      if (rating || count) console.log("Google match: generic patterns");
    }
    console.log(`Google Result: ${rating} / ${count}\n`);
  } catch(e) { console.error("Google error:", e); }

  // 2. 2GIS (render=true)
  console.log("=== Testing 2GIS (render=true) ===");
  const dgisUrl = "https://2gis.ru/vologda/firm/70000001039498416";
  const dgisScraper = `http://api.scraperapi.com/?api_key=${scraperKey}&render=true&country_code=ru&url=${encodeURIComponent(dgisUrl)}`;
  
  try {
    const res = await fetch(dgisScraper);
    console.log(`2GIS Status: ${res.status}`);
    const html = await res.text();
    fs.writeFileSync('d:\\AI\\Antigravity\\feedback-service\\debug_2gis.html', html);
    
    let rating = null, count = null;
    const ogMatch = html.match(/Оценка\s*(\d[\.,]\d)[^"<>]*?(\d+)\s*отзыв/i) || html.match(/content="[^"]*Оценка\s*(\d[\.,]\d)[^"]*?(\d+)\s*отзыв/i);
    if (ogMatch) { rating = ogMatch[1].replace(",", "."); count = ogMatch[2]; console.log("2GIS match: og:description"); }
    
    if (!rating) {
      const rMatch2 = html.match(/>(\d[\.,]\d)<\/span>/);
      const cMatch2 = html.match(/>(\d+)\s*оцен\S*/);
      if (rMatch2) { rating = rMatch2[1].replace(",", "."); }
      if (cMatch2) { count = cMatch2[1]; }
      if (rating || count) console.log("2GIS match: text patterns");
    }
    console.log(`2GIS Result: ${rating} / ${count}\n`);
  } catch(e) { console.error("2GIS error:", e); }
}

testExtraction();
