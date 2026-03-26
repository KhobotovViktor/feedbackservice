// Test 2GIS catalog API and ScraperAPI Google autoparse

async function test2gisApi() {
  // Found in 2GIS page config: webApiKey
  const apiKey = "c7f1a769-c8a5-4636-b14d-d8c987808a12"; 
  const firmId = "70000001039498416";
  
  // 2GIS Catalog API  
  const url = `https://catalog.api.2gis.ru/3.0/items/byid?id=${firmId}&key=${apiKey}&fields=items.reviews`;
  console.log("=== 2GIS Catalog API ===");
  console.log("URL:", url);
  
  try {
    const res = await fetch(url);
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2).substring(0, 2000));
  } catch(e) { console.error("2GIS API error:", e.message); }
}

async function testGoogleAutoparse() {
  const scraperKey = "06eeb0519264e083ad4b9da58a7f6902";
  const query = "Аллея Мебели Вологда отзывы";
  const gUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ru`;
  // Try autoparse - ScraperAPI extracts structured data automatically
  const scraperUrl = `http://api.scraperapi.com/?api_key=${scraperKey}&autoparse=true&country_code=ru&url=${encodeURIComponent(gUrl)}`;
  
  console.log("\n=== Google ScraperAPI autoparse ===");
  try {
    const res = await fetch(scraperUrl);
    console.log(`Status: ${res.status}`);
    const text = await res.text();
    console.log(`Size: ${text.length}`);
    console.log(text.substring(0, 1500));
  } catch(e) { console.error("Google error:", e.message); }
}

(async () => {
  await test2gisApi();
  await testGoogleAutoparse();
})();
