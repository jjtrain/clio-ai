import type { LegalSearchRequest, LegalSearchResult, ServiceResult } from "./types";
import { getProviderConfig, makeApiCall } from "./provider-factory";

const DEFAULT_BASE = "https://api.casetext.com/v1";

async function getConfig() {
  const config = await getProviderConfig("CASETEXT");
  if (!config?.apiKey) return null;
  return { baseUrl: config.baseUrl || DEFAULT_BASE, apiKey: config.apiKey };
}

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export async function casetextSearch(request: LegalSearchRequest): Promise<ServiceResult<LegalSearchResult[]>> {
  const config = await getConfig();
  if (!config) return { success: false, error: "Casetext is not configured. Set up in Settings → Integrations.", provider: "CASETEXT" };

  try {
    const res = await makeApiCall(`${config.baseUrl}/search`, {
      method: "POST",
      headers: headers(config.apiKey),
      body: JSON.stringify({ query: request.query, filters: { jurisdiction: request.jurisdiction, date_range: request.dateRange, document_type: request.documentType }, limit: request.resultLimit || 20 }),
    });
    if (!res.ok) return { success: false, error: `Casetext API returned ${res.status}`, provider: "CASETEXT" };
    const data = await res.json();
    const results: LegalSearchResult[] = (data.results || data || []).map((r: any) => ({
      id: r.id || r.caseId, title: r.title || r.caseName, citation: r.citation,
      court: r.court, year: r.year, snippet: r.snippet || r.excerpt || "",
      fullText: r.fullText, url: r.url, relevanceScore: r.score, provider: "CASETEXT",
    }));
    return { success: true, data: results, provider: "CASETEXT" };
  } catch (err: any) {
    return { success: false, error: `Casetext error: ${err.message}`, provider: "CASETEXT" };
  }
}

export async function casetextCheckCitations(citations: string[]): Promise<ServiceResult<Array<{ citation: string; status: string; details?: string }>>> {
  const config = await getConfig();
  if (!config) return { success: false, error: "Casetext is not configured.", provider: "CASETEXT" };

  try {
    const res = await makeApiCall(`${config.baseUrl}/cocounsel/citation-check`, {
      method: "POST", headers: headers(config.apiKey),
      body: JSON.stringify({ citations }),
    });
    if (!res.ok) return { success: false, error: `Citation check failed: ${res.status}`, provider: "CASETEXT" };
    const data = await res.json();
    return { success: true, data: data.results || citations.map((c) => ({ citation: c, status: "unknown" })), provider: "CASETEXT" };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "CASETEXT" };
  }
}
