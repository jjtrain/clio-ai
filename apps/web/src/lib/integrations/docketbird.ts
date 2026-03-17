import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getConfig() {
  const config = await db.docToolIntegration.findUnique({ where: { provider: "DOCKETBIRD" } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return { baseUrl: config.baseUrl || "https://api.docketbird.com/v1", apiKey: config.apiKey };
}
function headers(apiKey: string) { return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }; }

export async function docketbirdSearchCases(params: { query: string; court?: string; jurisdiction?: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketbird is not configured.", provider: "DOCKETBIRD" };
  try {
    const qs = new URLSearchParams({ q: params.query });
    if (params.court) qs.set("court", params.court);
    if (params.jurisdiction) qs.set("jurisdiction", params.jurisdiction);
    const res = await makeApiCall(`${config.baseUrl}/search/cases?${qs}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "DOCKETBIRD" };
    return { success: true, data: await res.json(), provider: "DOCKETBIRD" };
  } catch (err: any) { return { success: false, error: err.message, provider: "DOCKETBIRD" }; }
}

export async function docketbirdSearchByParty(partyName: string, court?: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketbird not configured.", provider: "DOCKETBIRD" };
  try {
    const qs = new URLSearchParams({ party_name: partyName });
    if (court) qs.set("court", court);
    const res = await makeApiCall(`${config.baseUrl}/search/party?${qs}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "DOCKETBIRD" };
    return { success: true, data: await res.json(), provider: "DOCKETBIRD" };
  } catch (err: any) { return { success: false, error: err.message, provider: "DOCKETBIRD" }; }
}

export async function docketbirdSearchByJudge(judgeName: string, court?: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketbird not configured.", provider: "DOCKETBIRD" };
  try {
    const qs = new URLSearchParams({ judge_name: judgeName });
    if (court) qs.set("court", court);
    const res = await makeApiCall(`${config.baseUrl}/search/judge?${qs}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "DOCKETBIRD" };
    return { success: true, data: await res.json(), provider: "DOCKETBIRD" };
  } catch (err: any) { return { success: false, error: err.message, provider: "DOCKETBIRD" }; }
}

export async function docketbirdGetJudgeAnalytics(judgeName: string, court: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketbird not configured.", provider: "DOCKETBIRD" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/analytics/judge?judge_name=${encodeURIComponent(judgeName)}&court=${encodeURIComponent(court)}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "DOCKETBIRD" };
    return { success: true, data: await res.json(), provider: "DOCKETBIRD" };
  } catch (err: any) { return { success: false, error: err.message, provider: "DOCKETBIRD" }; }
}
