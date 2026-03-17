import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getConfig() {
  const config = await db.docToolIntegration.findUnique({ where: { provider: "INFOTRACK" } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return { baseUrl: config.baseUrl || "https://api.infotrack.com/v1", apiKey: config.apiKey };
}
function headers(apiKey: string) { return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }; }

export async function infotrackGetCourts(jurisdiction: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "InfoTrack is not configured.", provider: "INFOTRACK" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/courts?jurisdiction=${encodeURIComponent(jurisdiction)}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "INFOTRACK" };
    return { success: true, data: await res.json(), provider: "INFOTRACK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "INFOTRACK" }; }
}

export async function infotrackSubmitFiling(params: { courtId: string; caseNumber: string; filingType: string; description: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "InfoTrack not configured.", provider: "INFOTRACK" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/filings/submit`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Submission failed: ${res.status}`, provider: "INFOTRACK" };
    return { success: true, data: await res.json(), provider: "INFOTRACK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "INFOTRACK" }; }
}

export async function infotrackRequestService(params: { recipientName: string; recipientAddress: string; serviceMethod: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "InfoTrack not configured.", provider: "INFOTRACK" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/service/request`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Request failed: ${res.status}`, provider: "INFOTRACK" };
    return { success: true, data: await res.json(), provider: "INFOTRACK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "INFOTRACK" }; }
}

export async function infotrackGetStatus(orderId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "InfoTrack not configured.", provider: "INFOTRACK" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/filings/${orderId}/status`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "INFOTRACK" };
    return { success: true, data: await res.json(), provider: "INFOTRACK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "INFOTRACK" }; }
}
