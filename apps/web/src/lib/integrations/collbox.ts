import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getConfig() {
  const s = await db.collBoxSettings.findUnique({ where: { id: "default" } });
  if (!s?.isEnabled || !s?.apiKey) return null;
  return { baseUrl: s.baseUrl || "https://api.collbox.co/v1", apiKey: s.apiKey };
}
function headers(apiKey: string) { return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }; }

export async function collboxTestConnection() {
  const config = await getConfig();
  if (!config) return { success: false, error: "CollBox is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/account/verify`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `CollBox returned ${res.status}` };
    const data = await res.json();
    return { success: true, firmName: data.name || data.firm_name };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function collboxSubmitClaim(params: { debtorName: string; debtorEmail?: string; originalBalance: number; description: string; preserveRelationship?: boolean }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CollBox not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/claims`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ debtor_name: params.debtorName, debtor_email: params.debtorEmail, original_balance: params.originalBalance, description: params.description, preserve_relationship: params.preserveRelationship ?? true }) });
    if (!res.ok) return { success: false, error: `Submission failed: ${res.status}` };
    const data = await res.json();
    return { success: true, data: { claimId: data.id || data.claim_id || `cb_${Date.now()}`, status: data.status || "submitted" } };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function collboxGetStatus(claimId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CollBox not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/claims/${claimId}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function collboxWithdraw(claimId: string, reason: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CollBox not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/claims/${claimId}/withdraw`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ reason }) });
    return { success: res.ok };
  } catch (err: any) { return { success: false, error: err.message }; }
}
