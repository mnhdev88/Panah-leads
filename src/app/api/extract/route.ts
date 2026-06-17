import { NextResponse } from "next/server";

const ZEROBOUNCE_API_KEY = process.env.ZEROBOUNCE_API_KEY;
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

// Apify "Google Maps Scraper" actor — handles grid search to return up to ~1000 places per query.
const GMB_ACTOR_ID = "compass~crawler-google-places";
const MAX_GMB_RESULTS = 1000; // hard cap to protect Apify compute spend

// Poll an Apify run until it finishes; returns its default dataset id. Capped at ~30 min.
async function waitForApifyRun(runId: string) {
  const MAX_POLLS = 360; // 360 * 5s = 30 minutes
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(resolve => setTimeout(resolve, 5000)); // poll every 5s
    const statusRes = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`);
    if (!statusRes.ok) continue;
    const data = await statusRes.json();
    const status = data.data.status;
    if (status === "SUCCEEDED") return data.data.defaultDatasetId;
    if (status === "FAILED" || status === "TIMED-OUT" || status === "ABORTED") {
      throw new Error(`Apify run failed with status: ${status}`);
    }
  }
  throw new Error("Apify run timed out after 30 minutes.");
}

// Fetch every item from an Apify dataset, paging through in case it holds thousands.
async function fetchAllDatasetItems(datasetId: string) {
  const all: any[] = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    const res = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&clean=true&limit=${pageSize}&offset=${offset}`);
    if (!res.ok) break;
    const batch = await res.json();
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { platform } = body;

    // --- GOOGLE MY BUSINESS EXTRACTION (via Apify Google Maps Scraper) ---
    if (platform === "gmb" || platform === "both") {
      const {
        industry, location, noWebsiteOnly, maxResults,
        // refined filters
        searchMatching, minRating, maxRating, minReviews, maxReviews,
        mustHavePhone, excludeKeywords,
      } = body;
      if (!industry || !location) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }
      if (!APIFY_API_TOKEN) return NextResponse.json({ error: "Apify API Token missing in .env.local" }, { status: 500 });

      const limit = Math.min(Math.max(Number(maxResults) || MAX_GMB_RESULTS, 1), MAX_GMB_RESULTS);

      // Only pass match strictness the actor understands; default to "all".
      const matching = ["all", "only_includes", "only_exact"].includes(searchMatching) ? searchMatching : "all";

      // The scraper grids the search area internally to return far more than Google's 60-result API cap.
      const apifyInput = {
        searchStringsArray: [`${industry} in ${location}`],
        maxCrawledPlacesPerSearch: limit,
        language: "en",
        website: noWebsiteOnly ? "withoutWebsite" : "allPlaces", // server-side "no website" filter
        searchMatching: matching, // scraper-level relevance filter
        skipClosedPlaces: true,
        maxReviews: 0,
        maxImages: 0,
        scrapeContacts: false,
      };

      // 1. Trigger the scraper run
      const runRes = await fetch(`https://api.apify.com/v2/acts/${GMB_ACTOR_ID}/runs?token=${APIFY_API_TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apifyInput),
      });

      if (!runRes.ok) {
        return NextResponse.json({ error: `Apify Trigger Failed: ${await runRes.text()}` }, { status: 500 });
      }

      // 2. Wait for it to finish, then pull every result
      const runData = await runRes.json();
      const datasetId = await waitForApifyRun(runData.data.id);
      if (!datasetId) {
        return NextResponse.json({ error: "Scraper finished but returned no dataset." }, { status: 500 });
      }

      const places = await fetchAllDatasetItems(datasetId);

      // 3. Map to our Lead shape — no email enrichment by design (volume over enrichment)
      let leads = places.map((place: any, idx: number) => ({
        id: place.placeId || place.cid || `gmb-${idx}`,
        name: place.title || "Unknown Business",
        source: "GMB",
        website: place.website || null,
        phone: place.phone || null,
        phoneRaw: place.phoneUnformatted || null, // E.164-ish, used for WhatsApp links
        email: null,
        emailStatus: "Unknown" as const,
        address: place.address || null,
        profileUrl: place.url || null,
        rating: typeof place.totalScore === "number" ? place.totalScore : null,
        reviewsCount: typeof place.reviewsCount === "number" ? place.reviewsCount : null,
        category: place.categoryName || (Array.isArray(place.categories) ? place.categories[0] : null) || null,
      }));

      // Belt-and-suspenders: the scraper already filters, but enforce it locally too.
      if (noWebsiteOnly) {
        leads = leads.filter((lead) => !lead.website);
      }

      // --- Post-extraction refinement (filters the actor can't apply natively) ---
      const minR = Number(minRating) || 0;
      const maxR = Number(maxRating) || 5;
      const minRev = Number(minReviews) || 0;
      const maxRev = Number(maxReviews) || 0; // 0 = no cap
      const excludes = String(excludeKeywords || "")
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);

      leads = leads.filter((lead) => {
        // Rating range — only enforce when the lead actually has a rating.
        if (lead.rating != null) {
          if (minR > 0 && lead.rating < minR) return false;
          if (maxR < 5 && lead.rating > maxR) return false;
        }
        // Reviews range
        const rev = lead.reviewsCount ?? 0;
        if (minRev > 0 && rev < minRev) return false;
        if (maxRev > 0 && rev > maxRev) return false;
        // Must have phone
        if (mustHavePhone && !lead.phone) return false;
        // Exclude keywords (match against name + category)
        if (excludes.length > 0) {
          const haystack = `${lead.name || ""} ${lead.category || ""}`.toLowerCase();
          if (excludes.some((kw) => haystack.includes(kw))) return false;
        }
        return true;
      });

      return NextResponse.json({ leads });
    }

    // --- LINKEDIN SALES NAVIGATOR EXTRACTION ---
    else if (platform === "linkedin") {
      const { linkedinUrl, linkedinCookie, apifyActorId } = body;
      
      if (!APIFY_API_TOKEN) return NextResponse.json({ error: "Apify API Token missing in .env.local" }, { status: 500 });
      if (!linkedinUrl || !linkedinCookie || !apifyActorId) return NextResponse.json({ error: "Missing LinkedIn credentials or URL" }, { status: 400 });

      // Run specific payload schema often used by Sales Nav scrapers
      const apifyInput = {
        cookie: linkedinCookie,
        urls: [ { url: linkedinUrl } ],
        searchUrl: linkedinUrl, 
        limit: 10,
        deepScrape: false
      };

      // 1. Trigger Apify Run
      const runRes = await fetch(`https://api.apify.com/v2/acts/${apifyActorId}/runs?token=${APIFY_API_TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apifyInput)
      });
      
      if (!runRes.ok) {
        return NextResponse.json({ error: `Apify Trigger Failed: ${await runRes.text()}` }, { status: 500 });
      }

      const runData = await runRes.json();
      const runId = runData.data.id;

      // 2. Wait for Run to Finish
      const datasetId = await waitForApifyRun(runId);

      if (!datasetId) {
        return NextResponse.json({ error: "Apify run finished but no dataset was returned." }, { status: 500 });
      }

      // 3. Fetch Dataset Items
      const datasetRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`);
      const items = await datasetRes.json();

      // 4. Map the Apify response to our generic Lead object
      // (This attempts to pull common fields since every actor has different output keys)
      const mappedLeads = items.map((item: any, idx: number) => {
        const name = item.fullName || item.name || item.firstName + ' ' + item.lastName || "Unknown Profile";
        const email = item.email || item.emailAddress || item.contactEmail || null;
        const phone = item.phone || item.phoneNumber || null;
        const website = item.website || item.companyWebsite || item.linkedInUrl || null;
        const address = item.location || item.city || item.country || null;
        const profileUrl = item.linkedInUrl || null;

        return {
          id: item.id || `linkedin-${idx}`,
          name: name,
          source: "LinkedIn",
          website: website,
          phone: phone,
          email: email,
          emailStatus: email ? "Unknown" : "Invalid", // Will be passed to ZeroBounce sequentially if needed
          address: address,
          profileUrl: profileUrl
        };
      });

      // 5. Enhance with ZeroBounce if emails were found by the scraper
      if (ZEROBOUNCE_API_KEY) {
        for (const lead of mappedLeads) {
          if (lead.email) {
            try {
              const zbRes = await fetch(`https://api.zerobounce.net/v2/validate?api_key=${ZEROBOUNCE_API_KEY}&email=${lead.email}&ip_address=`);
              if (zbRes.ok) {
                const zbData = await zbRes.json();
                lead.emailStatus = zbData.status === "valid" ? "Valid" : (zbData.status === "invalid" ? "Invalid" : zbData.status);
              }
            } catch(e) {}
          }
        }
      }

      return NextResponse.json({ leads: mappedLeads });
    }
    
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
    
  } catch (error: any) {
    console.error("API Route Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
