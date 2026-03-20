async function testWidget() {
  const response = await fetch('https://yandex.ru/maps-reviews-widget/1244126946?comments');
  const html = await response.text();
  
  // Try finding in JSON-LD or similar strings in the widget
  const ratingMatch = html.match(/\"ratingValue\":\s*\"([\d.]+)\"/) || html.match(/class=\"[^\"]*rating-value[^\"]*\">([\d.]+)/);
  const reviewMatch = html.match(/\"reviewCount\":\s*\"(\d+)\"/) || html.match(/(\d+)\s+отзыв/);
  
  console.log('Results:', {
    rating: ratingMatch ? ratingMatch[1] : 'not found',
    reviews: reviewMatch ? reviewMatch[1] : 'not found'
  });
}

testWidget();
