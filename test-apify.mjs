const API_KEY = process.env.APIFY_API_TOKEN; // set APIFY_API_TOKEN in your environment

async function testApify() {
  console.log("Testing Apify connection...");
  const actorId = "curious_coder/linkedin-company-scraper"; // standard one
  const input = { searchUrls: [`https://www.linkedin.com/search/results/companies/?keywords=plumbers%20chicago`] };
  
  const runRes = await fetch(`https://api.apify.com/v2/acts/${actorId}/runs?token=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input)
  });
  
  const runData = await runRes.json();
  console.log("Run info:", runRes.status, runData.data?.id);
}
testApify();
