"use client";

import { useState } from "react";
import { Search, MapPin, Briefcase, Download, Play, CheckCircle, RefreshCcw, Loader2, Link as LinkIcon, KeyRound, Cog, Mail, MessageCircle, SlidersHorizontal, ChevronDown, Star, MessageSquare, Phone, Filter } from "lucide-react";

type Lead = {
  id: string;
  name: string;
  source: string;
  website: string | null;
  phone: string | null;
  phoneRaw?: string | null;
  email: string | null;
  emailStatus: "Valid" | "Invalid" | "Unknown";
  address?: string | null;
  profileUrl?: string | null;
  rating?: number | null;
  reviewsCount?: number | null;
  category?: string | null;
};

export default function DashboardPage() {
  const [platform, setPlatform] = useState("gmb");
  
  // GMB State
  const [industry, setIndustry] = useState("");
  const [location, setLocation] = useState("");
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(true);
  const [maxResults, setMaxResults] = useState(1000);

  // GMB Advanced Filters
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchMatching, setSearchMatching] = useState("all"); // scraper-level relevance
  const [minRating, setMinRating] = useState(0); // 0 = any
  const [maxRating, setMaxRating] = useState(5); // 5 = any
  const [minReviews, setMinReviews] = useState(0);
  const [maxReviews, setMaxReviews] = useState(0); // 0 = no cap
  const [mustHavePhone, setMustHavePhone] = useState(false);
  const [excludeKeywords, setExcludeKeywords] = useState(""); // comma-separated
  
  // LinkedIn State
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [linkedinCookie, setLinkedinCookie] = useState("");
  const [apifyActorId, setApifyActorId] = useState("freshdata/linkedin-sales-navigator-scraper");

  const [isScraping, setIsScraping] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);

  const handleStartExtraction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (platform === "gmb" && (!industry || !location)) return;
    if (platform === "linkedin" && (!linkedinUrl || !linkedinCookie || !apifyActorId)) return;

    setIsScraping(true);
    setLeads([]);
    
    try {
      const payload = platform === "gmb"
        ? {
            platform, industry, location, noWebsiteOnly, maxResults,
            searchMatching, minRating, maxRating, minReviews, maxReviews,
            mustHavePhone, excludeKeywords,
          }
        : { platform, linkedinUrl, linkedinCookie, apifyActorId };

      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert("Error: " + (data.error || "Failed to extract"));
      } else if (data.leads) {
        setLeads(data.leads);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsScraping(false);
    }
  };

  const handleExport = async () => {
    if (leads.length === 0) return;
    setIsExporting(true);
    
    try {
      const headers = ["Business Name", "Category", "Rating", "Reviews", "Website", "Google Maps Profile", "Phone", "Email", "Email Status", "Source", "Address"];
      const csvRows = [headers.join(",")];

      for (const lead of leads) {
        const row = [
          `"${(lead.name || "").replace(/"/g, '""')}"`,
          `"${(lead.category || "").replace(/"/g, '""')}"`,
          `"${lead.rating ?? ""}"`,
          `"${lead.reviewsCount ?? ""}"`,
          `"${(lead.website || "").replace(/"/g, '""')}"`,
          `"${(lead.profileUrl || "").replace(/"/g, '""')}"`,
          `"${(lead.phone || "").replace(/"/g, '""')}"`,
          `"${(lead.email || "").replace(/"/g, '""')}"`,
          `"${(lead.emailStatus || "").replace(/"/g, '""')}"`,
          `"${(lead.source || "").replace(/"/g, '""')}"`,
          `"${(lead.address || "").replace(/"/g, '""')}"`
        ];
        csvRows.push(row.join(","));
      }

      const csvString = csvRows.join("\n");
      const blob = new Blob([csvString], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.setAttribute("hidden", "");
      a.setAttribute("href", url);
      a.setAttribute("download", `extracted_leads_${new Date().getTime()}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert("Error exporting CSV: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-indigo-500/30">
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-md sticky top-0 z-10 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCcw className="w-6 h-6 text-indigo-400" />
            <span className="text-xl font-bold bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">
              Panah Lead Extractor
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 shadow-xl shadow-black/50">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2 text-white">
              <Play className="w-5 h-5 text-indigo-400" /> New Extraction Job
            </h2>

            <form onSubmit={handleStartExtraction} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-400">Target Platform</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-neutral-500" />
                  </div>
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value)}
                    className="block w-full pl-10 bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 text-neutral-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors sm:text-sm appearance-none"
                  >
                    <option value="gmb">Google My Business</option>
                    <option value="linkedin">LinkedIn Sales Navigator</option>
                  </select>
                </div>
              </div>

              {platform === "gmb" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-400">Industry / Business Type</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Briefcase className="h-4 w-4 text-neutral-500" />
                      </div>
                      <input
                        type="text"
                        required={platform === "gmb"}
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        className="block w-full pl-10 bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 text-neutral-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors sm:text-sm"
                        placeholder="e.g. Plumbers, Roofing..."
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-400">Target Location</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <MapPin className="h-4 w-4 text-neutral-500" />
                      </div>
                      <input
                        type="text"
                        required={platform === "gmb"}
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="block w-full pl-10 bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 text-neutral-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors sm:text-sm"
                        placeholder="e.g. Chicago, IL"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-400">Max Results</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Download className="h-4 w-4 text-neutral-500" />
                      </div>
                      <select
                        value={maxResults}
                        onChange={(e) => setMaxResults(Number(e.target.value))}
                        className="block w-full pl-10 bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 text-neutral-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors sm:text-sm appearance-none"
                      >
                        <option value={100}>100 (fastest)</option>
                        <option value={250}>250</option>
                        <option value={500}>500</option>
                        <option value={1000}>1000 (slowest, ~5-15 min)</option>
                      </select>
                    </div>
                    <p className="text-xs text-neutral-500 pt-1">Higher counts take longer and use more Apify compute.</p>
                  </div>

                  <div className="pt-2">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          checked={noWebsiteOnly}
                          onChange={(e) => setNoWebsiteOnly(e.target.checked)}
                          className="peer sr-only"
                        />
                        <div className="w-10 h-5.5 bg-neutral-800 rounded-full peer-focus:ring-2 peer-focus:ring-indigo-500/50 peer-checked:bg-indigo-500 transition-colors"></div>
                        <div className="absolute left-1 top-1 bg-white w-3.5 h-3.5 rounded-full transition-transform peer-checked:translate-x-4.5"></div>
                      </div>
                      <span className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">
                        Only extract businesses WITHOUT a website
                      </span>
                    </label>
                  </div>

                  {/* Advanced / refined filters */}
                  <div className="pt-2 border-t border-neutral-800/80">
                    <button
                      type="button"
                      onClick={() => setShowAdvanced((v) => !v)}
                      className="w-full flex items-center justify-between text-sm font-medium text-neutral-300 hover:text-white transition-colors py-1"
                    >
                      <span className="flex items-center gap-2">
                        <SlidersHorizontal className="w-4 h-4 text-indigo-400" /> Advanced Filters
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
                    </button>

                    {showAdvanced && (
                      <div className="mt-4 space-y-4">
                        {/* Match strictness — scraper-level relevance */}
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-neutral-400 flex items-center gap-1.5">
                            <Filter className="h-3.5 w-3.5 text-neutral-500" /> Category Match
                          </label>
                          <select
                            value={searchMatching}
                            onChange={(e) => setSearchMatching(e.target.value)}
                            className="block w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 px-3 text-neutral-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors sm:text-sm appearance-none"
                          >
                            <option value="all">Broad — anything related</option>
                            <option value="only_includes">Includes the term</option>
                            <option value="only_exact">Exact match only</option>
                          </select>
                          <p className="text-xs text-neutral-500">Stricter matching = fewer, more relevant results.</p>
                        </div>

                        {/* Rating range */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-neutral-400 flex items-center gap-1.5">
                              <Star className="h-3.5 w-3.5 text-neutral-500" /> Min Rating
                            </label>
                            <select
                              value={minRating}
                              onChange={(e) => setMinRating(Number(e.target.value))}
                              className="block w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 px-3 text-neutral-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors sm:text-sm appearance-none"
                            >
                              <option value={0}>Any</option>
                              <option value={2}>2.0+</option>
                              <option value={3}>3.0+</option>
                              <option value={3.5}>3.5+</option>
                              <option value={4}>4.0+</option>
                              <option value={4.5}>4.5+</option>
                            </select>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-neutral-400 flex items-center gap-1.5">
                              <Star className="h-3.5 w-3.5 text-neutral-500" /> Max Rating
                            </label>
                            <select
                              value={maxRating}
                              onChange={(e) => setMaxRating(Number(e.target.value))}
                              className="block w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 px-3 text-neutral-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors sm:text-sm appearance-none"
                            >
                              <option value={5}>Any</option>
                              <option value={4.5}>≤ 4.5</option>
                              <option value={4}>≤ 4.0</option>
                              <option value={3.5}>≤ 3.5</option>
                              <option value={3}>≤ 3.0</option>
                            </select>
                          </div>
                        </div>
                        <p className="text-xs text-neutral-500 -mt-2">Tip: cap the rating (e.g. ≤ 3.5) to find businesses that may need help.</p>

                        {/* Reviews range */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-neutral-400 flex items-center gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5 text-neutral-500" /> Min Reviews
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={minReviews}
                              onChange={(e) => setMinReviews(Math.max(0, Number(e.target.value)))}
                              className="block w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 px-3 text-neutral-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors sm:text-sm"
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-sm font-medium text-neutral-400 flex items-center gap-1.5">
                              <MessageSquare className="h-3.5 w-3.5 text-neutral-500" /> Max Reviews
                            </label>
                            <input
                              type="number"
                              min={0}
                              value={maxReviews}
                              onChange={(e) => setMaxReviews(Math.max(0, Number(e.target.value)))}
                              className="block w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 px-3 text-neutral-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors sm:text-sm"
                              placeholder="0 = no cap"
                            />
                          </div>
                        </div>

                        {/* Exclude keywords */}
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-neutral-400">Exclude Keywords</label>
                          <input
                            type="text"
                            value={excludeKeywords}
                            onChange={(e) => setExcludeKeywords(e.target.value)}
                            className="block w-full bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 px-3 text-neutral-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors sm:text-sm"
                            placeholder="e.g. franchise, hospital, clinic"
                          />
                          <p className="text-xs text-neutral-500">Comma-separated. Drops leads whose name or category contains any of these.</p>
                        </div>

                        {/* Must have phone */}
                        <label className="flex items-center gap-2 cursor-pointer group pt-1">
                          <div className="relative flex items-center">
                            <input
                              type="checkbox"
                              checked={mustHavePhone}
                              onChange={(e) => setMustHavePhone(e.target.checked)}
                              className="peer sr-only"
                            />
                            <div className="w-10 h-5.5 bg-neutral-800 rounded-full peer-focus:ring-2 peer-focus:ring-indigo-500/50 peer-checked:bg-indigo-500 transition-colors"></div>
                            <div className="absolute left-1 top-1 bg-white w-3.5 h-3.5 rounded-full transition-transform peer-checked:translate-x-4.5"></div>
                          </div>
                          <span className="text-sm font-medium text-neutral-300 group-hover:text-white transition-colors flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" /> Only leads with a phone number
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </>
              )}

              {platform === "linkedin" && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-400">Sales Navigator Search URL</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <LinkIcon className="h-4 w-4 text-neutral-500" />
                      </div>
                      <input
                        type="url"
                        required={platform === "linkedin"}
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        className="block w-full pl-10 bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 text-neutral-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors sm:text-sm"
                        placeholder="https://www.linkedin.com/sales/search/..."
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-400">LinkedIn Cookie (li_at)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <KeyRound className="h-4 w-4 text-neutral-500" />
                      </div>
                      <input
                        type="password"
                        required={platform === "linkedin"}
                        value={linkedinCookie}
                        onChange={(e) => setLinkedinCookie(e.target.value)}
                        className="block w-full pl-10 bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 text-neutral-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors sm:text-sm"
                        placeholder="Secret session cookie..."
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-400">Apify Actor ID</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Cog className="h-4 w-4 text-neutral-500" />
                      </div>
                      <input
                        type="text"
                        required={platform === "linkedin"}
                        value={apifyActorId}
                        onChange={(e) => setApifyActorId(e.target.value)}
                        className="block w-full pl-10 bg-neutral-950 border border-neutral-800 rounded-lg py-2.5 text-neutral-500 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-colors sm:text-sm cursor-help"
                      />
                    </div>
                    <p className="text-xs text-neutral-500 pt-1">Advanced: Change if using a different Apify scraper.</p>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={isScraping}
                className="w-full mt-6 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                {isScraping ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Extracting (Might take 1-5 mins)...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" /> Start Extraction
                  </>
                )}
              </button>
            </form>
          </div>
        </aside>

        <div className="lg:col-span-8 flex flex-col">
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden shadow-xl shadow-black/50 flex-1 flex flex-col">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-900/50">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                Extracted Leads <span className="bg-neutral-800 text-neutral-300 text-xs py-0.5 px-2 rounded-full">{leads.length}</span>
              </h2>
              <button
                onClick={handleExport}
                disabled={leads.length === 0 || isExporting}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 text-white text-sm font-medium py-1.5 px-4 rounded-lg transition-colors"
              >
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Download CSV
              </button>
            </div>

            <div className="flex-1 overflow-auto bg-neutral-950/50">
              {leads.length === 0 ? (
                <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-neutral-500">
                  <Search className="w-12 h-12 mb-4 text-neutral-700" />
                  <p>No leads extracted yet.</p>
                  <p className="text-sm">Configure a job on the left to begin.</p>
                </div>
              ) : (
                <table className="w-full text-sm text-left text-neutral-300">
                  <thead className="text-xs text-neutral-400 uppercase bg-neutral-900/80 sticky top-0 backdrop-blur-sm z-10 border-b border-neutral-800">
                    <tr>
                      <th className="px-6 py-3 font-medium">Name</th>
                      <th className="px-6 py-3 font-medium">Contact</th>
                      <th className="px-6 py-3 font-medium">Email Status</th>
                      <th className="px-6 py-3 font-medium">Source</th>
                      <th className="px-6 py-3 font-medium">Profile</th>
                      <th className="px-6 py-3 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-800">
                    {leads.map((lead, idx) => (
                      <tr key={idx} className="hover:bg-neutral-900/50 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="font-medium text-white truncate max-w-[200px]">{lead.name}</div>
                          {lead.category && (
                            <div className="text-xs text-neutral-500 mt-0.5 max-w-[200px] truncate">{lead.category}</div>
                          )}
                          {(lead.rating != null || lead.reviewsCount != null) && (
                            <div className="flex items-center gap-2 mt-1 text-xs">
                              {lead.rating != null && (
                                <span className="flex items-center gap-0.5 text-amber-400">
                                  <Star className="w-3 h-3 fill-amber-400" /> {lead.rating}
                                </span>
                              )}
                              {lead.reviewsCount != null && (
                                <span className="text-neutral-500">{lead.reviewsCount} reviews</span>
                              )}
                            </div>
                          )}
                          <div className="text-xs text-neutral-500 mt-0.5 max-w-[200px] truncate">{lead.website || "No website"}</div>
                          {lead.address && (
                            <div className="text-xs text-neutral-400 mt-1 flex items-start gap-1" title={lead.address}>
                              <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5 opacity-70" /> 
                              <span className="truncate max-w-[180px]">{lead.address}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-neutral-300">{lead.email || "No email"}</div>
                          <div className="text-xs text-neutral-500 mt-0.5">{lead.phone || "No phone"}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border
                            ${lead.emailStatus === 'Valid' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                              lead.emailStatus === 'Invalid' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 
                              'bg-neutral-500/10 text-neutral-400 border-neutral-500/20'}`}>
                            {lead.emailStatus === 'Valid' && <CheckCircle className="w-3 h-3 mr-1" />}
                            {lead.emailStatus}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="uppercase text-xs tracking-wider opacity-70 group-hover:opacity-100 transition-opacity">
                            {lead.source}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {lead.profileUrl ? (
                            <a href={lead.profileUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline text-xs flex items-center gap-1" title="View Profile">
                              <MapPin className="w-3 h-3 flex-shrink-0" /> <span className="truncate max-w-[80px]">Link</span>
                            </a>
                          ) : (
                            <span className="text-xs text-neutral-500">N/A</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                          {lead.email && lead.emailStatus !== 'Invalid' ? (
                            <a
                              href={`mailto:${lead.email}?subject=Proposal for ${encodeURIComponent(lead.name)}&body=Hi there,%0D%0A%0D%0AI was doing some research on businesses in your area and noticed ${encodeURIComponent(lead.name)} didn't have a fully optimized website online. I went ahead and put together a quick mockup design for you.%0D%0A%0D%0AWould you be open to taking a look?%0D%0A%0D%0AThanks,%0D%0A`}
                              className="inline-flex items-center justify-center p-2 text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 rounded-lg transition-colors border border-indigo-500/20"
                              title="Send Proposal via Email Client"
                            >
                              <Mail className="w-4 h-4" />
                            </a>
                          ) : lead.phone ? (
                            <a
                              href={`https://wa.me/${(lead.phoneRaw || lead.phone).replace(/[^0-9]/g, '')}?text=Hi there,%0D%0A%0D%0AI was doing some research on businesses in your area and noticed ${encodeURIComponent(lead.name)} didn't have a fully optimized website online. I went ahead and put together a quick mockup design for you.%0D%0A%0D%0AWould you be open to taking a look?`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center p-2 text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-lg transition-colors border border-emerald-500/20"
                              title="Send Proposal via WhatsApp"
                            >
                              <MessageCircle className="w-4 h-4" />
                            </a>
                          ) : (
                            <span className="text-xs text-neutral-500 italic">No Contact</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
