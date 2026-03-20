async function testGoogleSearch() {
  const query = "site:yandex.ru/maps/org/ 1124715036";
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  console.log(`Testing Google Search: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    console.log(`Status: ${res.status}, Length: ${html.length}`);
    
    // Look for rating patterns in snippet
    const snippetMatch = html.match(/([\d,.]+)\s*(\(из 5\)|из 5|stars|звезд).+?(\d+)\s*отзыв/i);
    if (snippetMatch) {
      console.log("Found rating in snippet!", snippetMatch[0]);
    } else {
      console.log("Snippet not found. HTML snippet:", html.substring(0, 1000).replace(/\s+/g, ' '));
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

testGoogleSearch();
