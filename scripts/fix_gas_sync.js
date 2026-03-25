const fs = require('fs');
const path = 'd:\\AI\\Antigravity\\feedback-service\\src\\app\\admin\\branches\\page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Fix ScraperAPI URL to remove render=true for Google
// Currently:
// if (service === "google" || service === "yandex") {
//   fetchUrl = "http://api.scraperapi.com/?api_key=" + scraperKey + "&country_code=ru&render=true&url=" + encodeURIComponent(url);
// }

const scraperApiRegex = /if\s*\(service\s*===\s*"google"\s*\|\|\s*service\s*===\s*"yandex"\)\s*\{\s*fetchUrl\s*=\s*"http:\/\/api\.scraperapi\.com\/\?api_key="\s*\+\s*scraperKey\s*\+\s*"&country_code=ru&render=true&url="\s*\+\s*encodeURIComponent\(url\);\s*\}/;
const newScraperApiStr = `if (service === "yandex") {
      fetchUrl = "http://api.scraperapi.com/?api_key=" + scraperKey + "&country_code=ru&render=true&session_number=123&url=" + encodeURIComponent(url);
    } else if (service === "google") {
      // Google search doesn't need JS render, removing it fixes timeouts (500/404)
      fetchUrl = "http://api.scraperapi.com/?api_key=" + scraperKey + "&country_code=ru&url=" + encodeURIComponent(url);
    }`;

content = content.replace(scraperApiRegex, newScraperApiStr);

// 2. Fix Regex cyrillic encoding for Google and 2GIS
// Replace "отзыв" -> "\\u043e\\u0442\\u0437\\u044b\\u0432"
// Replace "Оценка" -> "\\u041e\\u0446\\u0435\\u043d\\u043a\\u0430"
// Replace "оцен" -> "\\u043e\\u0446\\u0435\\u043d"
// In the lines array from 241 to 270

const lines = content.split(/\r?\n/);
let inGoogleBlock = false;
let in2GisBlock = false;

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  if (line.includes('if (service === "google") {')) {
    inGoogleBlock = true;
  } else if (line.includes('if (service === "2gis") {')) {
    inGoogleBlock = false;
    in2GisBlock = true;
  } else if (line.includes('if (!rating) {') && in2GisBlock && lines[i+1] && lines[i+1].includes('console.warn')) {
    in2GisBlock = false;
  }
  
  if (inGoogleBlock || in2GisBlock) {
    if (line.includes('отзыв')) {
      lines[i] = line.replace(/отзыв/g, '\\\\u043e\\\\u0442\\\\u0437\\\\u044b\\\\u0432');
    }
    if (line.includes('Оценка')) {
      lines[i] = line.replace(/Оценка/g, '\\\\u041e\\\\u0446\\\\u0435\\\\u043d\\\\u043a\\\\u0430');
    }
    if (line.includes('оцен')) {
      lines[i] = line.replace(/оцен/g, '\\\\u043e\\\\u0446\\\\u0435\\\\u043d');
    }
  }
}

fs.writeFileSync(path, lines.join('\\n'), 'utf8');
console.log("Updated page.tsx with ScraperAPI fix and Unicode Regex fixes.");
