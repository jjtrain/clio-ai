import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getConfig() {
  const config = await db.docToolIntegration.findUnique({ where: { provider: "DEFINELY" } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return { baseUrl: config.baseUrl || "https://api.definely.com/v1", apiKey: config.apiKey };
}

function headers(apiKey: string) { return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }; }

export async function definelyAnalyze(text: string, documentType?: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Definely is not configured. Set up in Settings → Integrations.", provider: "DEFINELY" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/analyze`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ document_text: text, type: documentType }) });
    if (!res.ok) return { success: false, error: `Definely returned ${res.status}`, provider: "DEFINELY" };
    return { success: true, data: await res.json(), provider: "DEFINELY" };
  } catch (err: any) { return { success: false, error: err.message, provider: "DEFINELY" }; }
}

export async function definelyExtractTerms(text: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Definely not configured.", provider: "DEFINELY" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/terms/extract`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ document_text: text }) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "DEFINELY" };
    return { success: true, data: await res.json(), provider: "DEFINELY" };
  } catch (err: any) { return { success: false, error: err.message, provider: "DEFINELY" }; }
}

export async function definelyCheckCrossRefs(text: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Definely not configured.", provider: "DEFINELY" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/crossref/check`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ document_text: text }) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "DEFINELY" };
    return { success: true, data: await res.json(), provider: "DEFINELY" };
  } catch (err: any) { return { success: false, error: err.message, provider: "DEFINELY" }; }
}

export async function definelyCompareVersions(text1: string, text2: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Definely not configured.", provider: "DEFINELY" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/compare`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ text1, text2 }) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "DEFINELY" };
    return { success: true, data: await res.json(), provider: "DEFINELY" };
  } catch (err: any) { return { success: false, error: err.message, provider: "DEFINELY" }; }
}
