import type { LegalSearchRequest, LegalSearchResult, ServiceResult } from "./types";
import { getProviderConfig, makeApiCall } from "./provider-factory";

const DEFAULT_BASE = "https://api.fastcase.com/v1";

async function getConfig() {
  const config = await getProviderConfig("FASTCASE");
  if (!config?.apiKey) return null;
  return { baseUrl: config.baseUrl || DEFAULT_BASE, apiKey: config.apiKey };
}

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export async function fastcaseSearch(request: LegalSearchRequest): Promise<ServiceResult<LegalSearchResult[]>> {
  const config = await getConfig();
  if (!config) return { success: false, error: "Fastcase is not configured. Set up in Settings → Integrations.", provider: "FASTCASE" };

  try {
    const res = await makeApiCall(`${config.baseUrl}/search`, {
      method: "POST", headers: headers(config.apiKey),
      body: JSON.stringify({ query: request.query, jurisdiction: request.jurisdiction, date_range: request.dateRange, sort_by: "relevance" }),
    });
    if (!res.ok) return { success: false, error: `Fastcase returned ${res.status}`, provider: "FASTCASE" };
    const data = await res.json();
    const results: LegalSearchResult[] = (data.results || data || []).map((r: any) => ({
      id: r.id, title: r.title || r.caseName, citation: r.citation,
      court: r.court, year: r.year, snippet: r.snippet || r.excerpt || "",
      url: r.url, relevanceScore: r.score, provider: "FASTCASE",
    }));
    return { success: true, data: results, provider: "FASTCASE" };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "FASTCASE" };
  }
}

export async function fastcaseCitationLookup(citation: string): Promise<ServiceResult<LegalSearchResult | null>> {
  const config = await getConfig();
  if (!config) return { success: false, error: "Fastcase is not configured.", provider: "FASTCASE" };

  try {
    const res = await makeApiCall(`${config.baseUrl}/cite?citation=${encodeURIComponent(citation)}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: true, data: null, provider: "FASTCASE" };
    const data = await res.json();
    return { success: true, data: { id: data.id, title: data.title, citation: data.citation, court: data.court, year: data.year, snippet: data.excerpt || "", provider: "FASTCASE" }, provider: "FASTCASE" };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "FASTCASE" };
  }
}
