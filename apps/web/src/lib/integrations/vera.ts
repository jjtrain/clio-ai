import type { DeadlineResult, DocketAlertPayload, ServiceResult } from "./types";
import { getProviderConfig, makeApiCall } from "./provider-factory";

const DEFAULT_BASE = "https://api.vera.law/v1";

async function getConfig() {
  const config = await getProviderConfig("VERA");
  if (!config?.apiKey) return null;
  return { baseUrl: config.baseUrl || DEFAULT_BASE, apiKey: config.apiKey };
}

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export async function veraCalculateDeadlines(params: {
  jurisdiction: string; caseType: string; triggerEvent: string; triggerDate: string; courtId?: string;
}): Promise<ServiceResult<DeadlineResult[]>> {
  const config = await getConfig();
  if (!config) return { success: false, error: "VERA is not configured. Set up in Settings → Integrations.", provider: "VERA" };

  try {
    const res = await makeApiCall(`${config.baseUrl}/deadlines/calculate`, {
      method: "POST", headers: headers(config.apiKey),
      body: JSON.stringify(params),
    });
    if (!res.ok) return { success: false, error: `VERA returned ${res.status}`, provider: "VERA" };
    const data = await res.json();
    const deadlines: DeadlineResult[] = (data.deadlines || data || []).map((d: any) => ({
      title: d.title || d.name, dueDate: new Date(d.due_date || d.dueDate),
      courtRule: d.court_rule || d.ruleAuthority, jurisdiction: d.jurisdiction || params.jurisdiction,
      eventType: d.event_type || d.type || params.triggerEvent, source: "VERA",
    }));
    return { success: true, data: deadlines, provider: "VERA" };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "VERA" };
  }
}

export async function veraGetJurisdictions(): Promise<ServiceResult<Array<{ id: string; name: string }>>> {
  const config = await getConfig();
  if (!config) return { success: false, error: "VERA is not configured.", provider: "VERA" };

  try {
    const res = await makeApiCall(`${config.baseUrl}/jurisdictions`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `VERA returned ${res.status}`, provider: "VERA" };
    return { success: true, data: await res.json(), provider: "VERA" };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "VERA" };
  }
}

export async function processWebhook(payload: any): Promise<DocketAlertPayload> {
  return {
    externalId: payload.id || "",
    alertType: payload.type === "deadline" ? "DEADLINE" : payload.type?.toUpperCase() || "CUSTOM",
    caseNumber: payload.case_number || "",
    courtName: payload.court || "",
    title: payload.title || "VERA Deadline Alert",
    description: payload.description,
    dueDate: payload.due_date ? new Date(payload.due_date) : undefined,
    rawData: payload,
  };
}
