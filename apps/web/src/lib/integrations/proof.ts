import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getConfig() {
  const c = await db.processServingIntegration.findUnique({ where: { provider: "PROOF" } });
  if (!c?.isEnabled || !c?.apiKey) return null;
  return { baseUrl: c.baseUrl || "https://api.proofserve.com/v1", apiKey: c.apiKey, accountId: c.accountId };
}
function headers(key: string) { return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; }

export async function proofTestConnection() {
  const c = await getConfig();
  if (!c) return { success: false, error: "Proof is not configured. Set up in Settings → Integrations.", provider: "PROOF" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/account`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "PROOF" } : { success: false, error: `Proof returned ${res.status}`, provider: "PROOF" };
  } catch (err: any) { return { success: false, error: err.message, provider: "PROOF" }; }
}

export async function proofCreateJob(params: { recipientName: string; serviceAddress: string; city: string; state: string; zip: string; serviceType: string; priority: string; specialInstructions?: string; documentsToServe?: any[] }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Proof not configured.", provider: "PROOF" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/jobs`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify({ recipient_name: params.recipientName, service_address: params.serviceAddress, city: params.city, state: params.state, zip: params.zip, service_type: params.serviceType, priority: params.priority, special_instructions: params.specialInstructions, documents: params.documentsToServe }) });
    if (!res.ok) return { success: false, error: `Submission failed: ${res.status}`, provider: "PROOF" };
    const data = await res.json();
    return { success: true, data: { jobId: data.id || data.job_id || `proof_${Date.now()}`, estimatedCost: data.estimated_cost, estimatedServiceDate: data.estimated_service_date, trackingUrl: data.tracking_url }, provider: "PROOF" };
  } catch (err: any) { return { success: false, error: err.message, provider: "PROOF" }; }
}

export async function proofGetJob(jobId: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Proof not configured.", provider: "PROOF" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/jobs/${jobId}`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "PROOF" } : { success: false, error: `Failed: ${res.status}`, provider: "PROOF" };
  } catch (err: any) { return { success: false, error: err.message, provider: "PROOF" }; }
}

export async function proofGetEstimate(params: { serviceAddress: string; serviceType: string; priority: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Proof not configured.", provider: "PROOF" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/estimate`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    return res.ok ? { success: true, data: await res.json(), provider: "PROOF" } : { success: false, error: `Failed: ${res.status}`, provider: "PROOF" };
  } catch (err: any) { return { success: false, error: err.message, provider: "PROOF" }; }
}

export async function proofGetProofOfService(jobId: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Proof not configured.", provider: "PROOF" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/jobs/${jobId}/proof`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "PROOF" } : { success: false, error: `Failed: ${res.status}`, provider: "PROOF" };
  } catch (err: any) { return { success: false, error: err.message, provider: "PROOF" }; }
}
