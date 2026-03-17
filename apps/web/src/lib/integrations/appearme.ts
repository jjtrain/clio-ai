import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getConfig() {
  const c = await db.referralIntegration.findUnique({ where: { provider: "APPEARME" } });
  if (!c?.isEnabled || !c?.apiKey) return null;
  return { baseUrl: c.baseUrl || "https://api.appearme.com/v1", apiKey: c.apiKey };
}
function headers(key: string) { return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; }

export async function appearMeTestConnection() {
  const c = await getConfig();
  if (!c) return { success: false, error: "AppearMe is not configured.", provider: "APPEARME" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/account`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "APPEARME" } : { success: false, error: `Failed: ${res.status}`, provider: "APPEARME" };
  } catch (err: any) { return { success: false, error: err.message, provider: "APPEARME" }; }
}

export async function appearMePostRequest(params: { requestType: string; practiceArea: string; jurisdiction: string; courtName?: string; eventDate: string; eventTime?: string; estimatedDuration?: number; caseDescription: string; urgency: string; budget?: number; rateType?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AppearMe not configured.", provider: "APPEARME" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/requests`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "APPEARME" };
    const data = await res.json();
    return { success: true, data: { requestId: data.id || data.request_id || `am_${Date.now()}`, status: data.status || "POSTED", estimatedMatchTime: data.estimated_match_time }, provider: "APPEARME" };
  } catch (err: any) { return { success: false, error: err.message, provider: "APPEARME" }; }
}

export async function appearMeGetRequest(requestId: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AppearMe not configured.", provider: "APPEARME" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/requests/${requestId}`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "APPEARME" } : { success: false, error: `Failed: ${res.status}`, provider: "APPEARME" };
  } catch (err: any) { return { success: false, error: err.message, provider: "APPEARME" }; }
}

export async function appearMeGetEstimate(params: { requestType: string; jurisdiction: string; duration: number; urgency: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AppearMe not configured.", provider: "APPEARME" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/estimate`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    return res.ok ? { success: true, data: await res.json(), provider: "APPEARME" } : { success: false, error: `Failed: ${res.status}`, provider: "APPEARME" };
  } catch (err: any) { return { success: false, error: err.message, provider: "APPEARME" }; }
}

export async function appearMeCancelRequest(requestId: string, reason?: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AppearMe not configured." };
  try {
    const res = await makeApiCall(`${c.baseUrl}/requests/${requestId}/cancel`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify({ reason }) });
    return { success: res.ok };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function appearMeSubmitRating(requestId: string, rating: number, comment?: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AppearMe not configured." };
  try {
    const res = await makeApiCall(`${c.baseUrl}/requests/${requestId}/rating`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify({ rating, comment }) });
    return { success: res.ok };
  } catch (err: any) { return { success: false, error: err.message }; }
}
