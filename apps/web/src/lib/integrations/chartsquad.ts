import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getConfig() {
  const c = await db.pImedIntegration.findUnique({ where: { provider: "CHARTSQUAD" } });
  if (!c?.isEnabled || !c?.apiKey) return null;
  return { baseUrl: c.baseUrl || "https://api.chartsquad.com/v1", apiKey: c.apiKey };
}
function headers(key: string) { return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; }

export async function chartsquadTestConnection() {
  const c = await getConfig();
  if (!c) return { success: false, error: "ChartSquad is not configured.", provider: "CHARTSQUAD" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/account`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "CHARTSQUAD" } : { success: false, error: `Failed: ${res.status}`, provider: "CHARTSQUAD" };
  } catch (err: any) { return { success: false, error: err.message, provider: "CHARTSQUAD" }; }
}

export async function chartsquadSubmitRequest(params: { patientName: string; providerName: string; providerFax?: string; recordType: string; dateRangeStart?: string; dateRangeEnd?: string; rushRequested?: boolean; notes?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "ChartSquad not configured.", provider: "CHARTSQUAD" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/requests`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "CHARTSQUAD" };
    const data = await res.json();
    return { success: true, data: { requestId: data.id || `cs_${Date.now()}`, estimatedCompletionDate: data.estimated_completion_date, estimatedCost: data.estimated_cost, status: data.status || "submitted" }, provider: "CHARTSQUAD" };
  } catch (err: any) { return { success: false, error: err.message, provider: "CHARTSQUAD" }; }
}

export async function chartsquadGetRequest(requestId: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "ChartSquad not configured." };
  try {
    const res = await makeApiCall(`${c.baseUrl}/requests/${requestId}`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json() } : { success: false, error: `Failed: ${res.status}` };
  } catch (err: any) { return { success: false, error: err.message }; }
}
