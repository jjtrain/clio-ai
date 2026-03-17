import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getConfig() {
  const config = await db.docToolIntegration.findUnique({ where: { provider: "MEDILENZ" } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return { baseUrl: config.baseUrl || "https://api.medilenz.com/v1", apiKey: config.apiKey };
}
function headers(apiKey: string) { return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }; }

export async function medilenzSubmitRecords(params: { patientName: string; matterId: string; recordType: string; files?: any[] }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Medilenz is not configured. Set up in Settings → Integrations.", provider: "MEDILENZ" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/submit`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ patient_name: params.patientName, record_type: params.recordType }) });
    if (!res.ok) return { success: false, error: `Medilenz returned ${res.status}`, provider: "MEDILENZ" };
    const data = await res.json();
    return { success: true, data: { caseId: data.id || data.case_id || `ml_${Date.now()}` }, provider: "MEDILENZ" };
  } catch (err: any) { return { success: false, error: err.message, provider: "MEDILENZ" }; }
}

export async function medilenzGetSummary(caseId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Medilenz not configured.", provider: "MEDILENZ" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/summary`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "MEDILENZ" };
    return { success: true, data: await res.json(), provider: "MEDILENZ" };
  } catch (err: any) { return { success: false, error: err.message, provider: "MEDILENZ" }; }
}

export async function medilenzGetStatus(caseId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Medilenz not configured.", provider: "MEDILENZ" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/status`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "MEDILENZ" };
    return { success: true, data: await res.json(), provider: "MEDILENZ" };
  } catch (err: any) { return { success: false, error: err.message, provider: "MEDILENZ" }; }
}
