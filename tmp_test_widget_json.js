async function testWidgetJSON() {
  const id = "1124715036"; 
  const url = `https://yandex.ru/maps-reviews-widget/v1/get-reviews?id=${id}&lang=ru`;
  console.log(`Testing Widget API: ${url}`);
  try {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log("JSON Data:", JSON.stringify(data).substring(0, 500));
  } catch (e) {
    console.log(`Error: ${e.message}`);
  }
}

testWidgetJSON();
