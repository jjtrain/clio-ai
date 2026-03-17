import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getConfig() {
  const c = await db.pImedIntegration.findUnique({ where: { provider: "AUTOREQUEST" } });
  if (!c?.isEnabled || !c?.apiKey) return null;
  return { baseUrl: c.baseUrl || "https://api.autorequest.com/v1", apiKey: c.apiKey };
}
function headers(key: string) { return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; }

export async function autorequestTestConnection() {
  const c = await getConfig();
  if (!c) return { success: false, error: "AutoRequest is not configured.", provider: "AUTOREQUEST" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/account`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "AUTOREQUEST" } : { success: false, error: `Failed: ${res.status}`, provider: "AUTOREQUEST" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AUTOREQUEST" }; }
}

export async function autorequestSubmitRequest(params: { patientName: string; providerName: string; providerFax?: string; recordType: string; includesBilling?: boolean; dateRangeStart?: string; dateRangeEnd?: string; rushRequested?: boolean }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AutoRequest not configured.", provider: "AUTOREQUEST" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/requests`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "AUTOREQUEST" };
    const data = await res.json();
    return { success: true, data: { requestId: data.id || `ar_${Date.now()}`, estimatedCompletion: data.estimated_completion, status: data.status || "submitted" }, provider: "AUTOREQUEST" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AUTOREQUEST" }; }
}

export async function autorequestGetRequest(requestId: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AutoRequest not configured." };
  try {
    const res = await makeApiCall(`${c.baseUrl}/requests/${requestId}`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json() } : { success: false, error: `Failed: ${res.status}` };
  } catch (err: any) { return { success: false, error: err.message }; }
}
