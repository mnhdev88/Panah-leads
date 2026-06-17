const key = process.env.GOOGLE_API_KEY;
async function test() {
  const query = "Plumbers in Chicago";
  const res = await fetch(`https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${key}`);
  console.log(res.status);
  const data = await res.json();
  console.log(data.status);
  if (data.results && data.results.length > 0) {
    console.log(data.results[0].name);
    
    // Test Place Details
    const placeId = data.results[0].place_id;
    const detailsRes = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,website,formatted_phone_number&key=${key}`);
    const detailsData = await detailsRes.json();
    console.log("Details:", detailsData.result.website, detailsData.result.formatted_phone_number);
  }
}
test();
