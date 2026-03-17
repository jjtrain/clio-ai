import { getProviderConfig, makeApiCall } from "./provider-factory";
import { db } from "@/lib/db";

async function getConfig() {
  const config = await db.docToolIntegration.findUnique({ where: { provider: "CLEARBRIEF" } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return { baseUrl: config.baseUrl || "https://api.clearbrief.com/v1", apiKey: config.apiKey };
}

function headers(apiKey: string) { return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }; }

export async function clearbriefAnalyze(text: string, briefType: string, referenceDocIds?: string[]) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Clearbrief is not configured. Set up in Settings → Integrations.", provider: "CLEARBRIEF" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/analyze`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ document_text: text, brief_type: briefType, reference_documents: referenceDocIds }) });
    if (!res.ok) return { success: false, error: `Clearbrief returned ${res.status}`, provider: "CLEARBRIEF" };
    return { success: true, data: await res.json(), provider: "CLEARBRIEF" };
  } catch (err: any) { return { success: false, error: err.message, provider: "CLEARBRIEF" }; }
}

export async function clearbriefCheckCitations(citations: string[]) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Clearbrief not configured.", provider: "CLEARBRIEF" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/citations/check`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ citations }) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "CLEARBRIEF" };
    return { success: true, data: await res.json(), provider: "CLEARBRIEF" };
  } catch (err: any) { return { success: false, error: err.message, provider: "CLEARBRIEF" }; }
}

export async function clearbriefFindAuthority(claim: string, jurisdiction: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Clearbrief not configured.", provider: "CLEARBRIEF" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/authority/find`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ claim, jurisdiction }) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "CLEARBRIEF" };
    return { success: true, data: await res.json(), provider: "CLEARBRIEF" };
  } catch (err: any) { return { success: false, error: err.message, provider: "CLEARBRIEF" }; }
}
