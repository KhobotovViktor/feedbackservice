const https = require('https');
const fs = require('fs');

const query = "Аллея Мебели Вологда отзывы";
const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=ru`;

https.get(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    fs.writeFileSync('d:\\AI\\Antigravity\\feedback-service\\scripts\\debug_google_direct.html', data);
    console.log("Saved. Length:", data.length);
    
    // Let's test basic regexes here
    const rMatch = data.match(/<span[^>]*>([0-5][.,]\d)<\/span>[^<]*<a[^>]*>/i);
    console.log("rMatch:", rMatch ? rMatch[1] : null);

    // Let's print all 4.x or 3.x ratings followed by 'отзыв'
    const blockMatches = [...data.matchAll(/([0-5][.,]\d)[\s\S]{0,300}?([\d\s\u00A0]*\d)\s*отзыв/gi)];
    blockMatches.forEach((m, i) => {
      console.log(`Block ${i+1}: Rating ${m[1]}, Count ${m[2]}`);
    });
    
    // Look for Yandex and Google specifically
    console.log("Yandex mentions:", (data.match(/yandex/gi) || []).length);
    console.log("Google reviews mentions:", (data.match(/в Google/gi) || []).length);
  });
}).on('error', e => console.error(e));
