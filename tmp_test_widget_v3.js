async function testWidgetV3() {
  const id = "1124715036"; 
  const url = `https://yandex.ru/maps-reviews-widget/${id}?view=desktop`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    const html = await res.text();
    console.log("Full HTML length:", html.length);
    
    // Look for JSON or State
    const scriptMatch = html.match(/<script type=\"application\/json\"[^>]*>(.*?)<\/script>/);
    if (scriptMatch) {
       console.log("Found JSON script!");
       console.log(scriptMatch[1].substring(0, 500));
    }
    
    // Look for "ratingValue" or similar
    const ratingValue = html.match(/\"ratingValue\":\"?([\d,.]+)\"?/);
    const reviewCount = html.match(/\"reviewCount\":\"?(\d+)\"?/);
    console.log("Regex search:", { ratingValue: ratingValue?.[1], reviewCount: reviewCount?.[1] });

    if (html.includes("error")) {
        console.log("HTML contains 'error'");
    }
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

testWidgetV3();
