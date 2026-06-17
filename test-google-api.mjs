const key = process.env.GOOGLE_API_KEY;
async function test() {
  const query = "Plumbers in Chicago";
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": key,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri",
    },
    body: JSON.stringify({
      textQuery: query,
    }),
  });
  console.log(res.status);
  console.log(await res.text());
}
test();
