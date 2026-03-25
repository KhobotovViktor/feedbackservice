const fs = require('fs');

async function testExtraction() {
  const gQuery = "Аллея Мебели Вологда отзывы";
  const scraperKey = "2f79d5dad217d73a81af41f23cb816e1";
  
  console.log("=== Testing Google Search (us proxy) ===");
  const gUrl = `https://www.google.com/search?q=${encodeURIComponent(gQuery)}&hl=ru`;
  const gScraperUrl = `http://api.scraperapi.com/?api_key=${scraperKey}&country_code=us&render=true&url=${encodeURIComponent(gUrl)}`;
  
  try {
    const gRes = await fetch(gScraperUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    console.log(`Google ScraperAPI Status: ${gRes.status}`);
    const gData = await gRes.text();
    fs.writeFileSync('google_njs_test.html', gData);
    console.log(`Saved google_njs_test.html (${gData.length} bytes)`);
    
    // Extractor test
    let rating = null, count = null;
    const html = gData;
    
    // The unicode version of the regex to avoid encoding corruption in GAS string representations
    const gBlock = html.match(new RegExp(`(\\d[\\.,]\\d)[\\s\\S]{0,200}?(\\d[\\s\\d]*)\\s*\u043e\u0442\u0437\u044b\u0432\\S*\\s+\u0432\\s+Google`));
    if (gBlock) { rating = gBlock[1].replace(",", "."); count = gBlock[2].replace(/\D/g, ""); }
    
    console.log(`Google Extraction: rating=${rating}, count=${count}`);

  } catch(e) { console.error("Google Fetch Error:", e); }
}

testExtraction();
