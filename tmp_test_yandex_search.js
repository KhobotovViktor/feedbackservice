async function testYandexSearch() {
  const query = "аллея мебели вологда 150а яндекс отзывы";
  const url = `https://yandex.ru/search/?text=${encodeURIComponent(query)}`;
  console.log(`Testing Yandex Search: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    console.log(`Status: ${res.status}, Length: ${html.length}`);
    
    // Look for rating patterns in snippet
    const ratingMatch = html.match(/Рейтинг\s*([\d,.]+).+?(\d+)\s*отзыв/i);
    if (ratingMatch) {
      console.log("Found rating in search result!", ratingMatch[0]);
    } else {
      console.log("Not found. Check for captcha...");
      if (html.includes("captcha")) console.log("CAPTCHA DETECTED");
      console.log("Snippet:", html.substring(0, 1000).replace(/\s+/g, ' '));
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

testYandexSearch();
