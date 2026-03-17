import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getConfig() {
  const c = await db.pImedIntegration.findUnique({ where: { provider: "PRECEDENT" } });
  if (!c?.isEnabled || !c?.apiKey) return null;
  return { baseUrl: c.baseUrl || "https://api.precedent.ai/v1", apiKey: c.apiKey };
}
function headers(key: string) { return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; }

export async function precedentTestConnection() {
  const c = await getConfig();
  if (!c) return { success: false, error: "Precedent is not configured.", provider: "PRECEDENT" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/account`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "PRECEDENT" } : { success: false, error: `Failed: ${res.status}`, provider: "PRECEDENT" };
  } catch (err: any) { return { success: false, error: err.message, provider: "PRECEDENT" }; }
}

export async function precedentCreateDemand(params: { clientName: string; incidentDate: string; incidentDescription: string; medicalBills: any[]; demandAmount: number; jurisdiction: string; insurer?: string; claimNumber?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Precedent not configured.", provider: "PRECEDENT" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/demands`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "PRECEDENT" };
    const data = await res.json();
    return { success: true, data: { demandId: data.id || `pr_${Date.now()}`, status: data.status || "IN_PROGRESS" }, provider: "PRECEDENT" };
  } catch (err: any) { return { success: false, error: err.message, provider: "PRECEDENT" }; }
}

export async function precedentGetDemand(demandId: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Precedent not configured." };
  try {
    const res = await makeApiCall(`${c.baseUrl}/demands/${demandId}`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json() } : { success: false, error: `Failed: ${res.status}` };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function precedentDeliverDemand(demandId: string, params: { method: string; recipientEmail?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Precedent not configured." };
  try {
    const res = await makeApiCall(`${c.baseUrl}/demands/${demandId}/deliver`, { method: "POST", headers: headers(c.apiKey!), body: JSON.stringify(params) });
    return { success: res.ok };
  } catch (err: any) { return { success: false, error: err.message }; }
}
