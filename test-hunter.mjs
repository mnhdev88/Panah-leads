const HUNTER_API_KEY = process.env.HUNTER_API_KEY;

async function testHunter() {
  const domain = "stripe.com";
  console.log(`Checking Hunter.io for ${domain}`);
  const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_API_KEY}`);
  console.log(res.status);
  const data = await res.json();
  console.log(data);
}
testHunter();
