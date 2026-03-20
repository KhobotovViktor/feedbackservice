async function testWidget() {
  const ids = ["1124715036", "1317581691", "241198943799"]; 
  for (const id of ids) {
    const url = `https://yandex.ru/maps-reviews-widget/${id}?view=desktop`;
    console.log(`Testing widget: ${url}`);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
        }
      });
      const html = await res.text();
      console.log(`Status: ${res.status}, Length: ${html.length}`);
      if (html.includes("Rating-Value")) {
        const rating = html.match(/class=\"Rating-Value\">([\d,.]+)<\/div>/)?.[1];
        const count = html.match(/class=\"Rating-Count\">[^<]*?(\d+)[^<]*?<\/div>/)?.[1];
        console.log(`SUCCESS! Rating: ${rating}, Count: ${count}`);
      } else {
        console.log("Widget HTML snippet:", html.substring(0, 500).replace(/\s+/g, ' '));
      }
    } catch (e) {
      console.log(`Error: ${e.message}`);
    }
    console.log("---");
  }
}

testWidget();
