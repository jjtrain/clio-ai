import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getConfig() {
  const c = await db.referralIntegration.findUnique({ where: { provider: "ATTORNEY_SHARE" } });
  if (!c?.isEnabled || !c?.apiKey) return null;
  return { baseUrl: c.baseUrl || "https://api.attorneyshare.com/v1", apiKey: c.apiKey };
}
function headers(key: string) { return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; }

export async function attorneyShareTestConnection() {
  const c = await getConfig();
  if (!c) return { success: false, error: "Attorney Share is not configured.", provider: "ATTORNEY_SHARE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/account`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "ATTORNEY_SHARE" } : { success: false, error: `Failed: ${res.status}`, provider: "ATTORNEY_SHARE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "ATTORNEY_SHARE" }; }
}

export async function attorneyShareSearchAttorneys(params: { practiceArea: string; jurisdiction: string; query?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Attorney Share not configured.", provider: "ATTORNEY_SHARE" };
  try {
    const qs = new URLSearchParams({ practice_area: params.practiceArea, jurisdiction: params.jurisdiction });
    if (params.query) qs.set("q", params.query);
    const res = await makeApiCall(`${c.baseUrl}/attorneys/search?${qs}`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "ATTORNEY_SHARE" } : { success: false, error: `Failed: ${res.status}`, provider: "ATTORNEY_SHARE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "ATTORNEY_SHARE" }; }
}

export async function attorneyShareSendReferral(params: { recipientEmail?: string; clientName: string; caseType: string; caseDescription: string; jurisdiction: string; urgency: string; referralFeeType: string; referralFeePercentage?: number }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Attorney Share not configured.", provider: "ATTORNEY_SHARE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/referrals`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "ATTORNEY_SHARE" };
    const data = await res.json();
    return { success: true, data: { referralId: data.id || data.referral_id || `as_${Date.now()}`, status: data.status || "sent" }, provider: "ATTORNEY_SHARE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "ATTORNEY_SHARE" }; }
}

export async function attorneyShareAcceptReferral(referralId: string, message?: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Attorney Share not configured." };
  try {
    const res = await makeApiCall(`${c.baseUrl}/referrals/${referralId}/accept`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify({ message }) });
    return { success: res.ok };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function attorneyShareDeclineReferral(referralId: string, reason: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Attorney Share not configured." };
  try {
    const res = await makeApiCall(`${c.baseUrl}/referrals/${referralId}/decline`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify({ reason }) });
    return { success: res.ok };
  } catch (err: any) { return { success: false, error: err.message }; }
}
