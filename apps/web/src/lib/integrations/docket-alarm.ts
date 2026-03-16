import type { DocketAlertPayload, ServiceResult } from "./types";
import { getProviderConfig, makeApiCall } from "./provider-factory";
import { db } from "@/lib/db";

const DEFAULT_BASE = "https://www.docketalarm.com/api/v1";

async function getConfig() {
  const config = await getProviderConfig("DOCKET_ALARM");
  if (!config?.apiKey) return null;
  return { baseUrl: config.baseUrl || DEFAULT_BASE, apiKey: config.apiKey, webhookUrl: config.webhookUrl };
}

export async function docketAlarmSearch(query: string, court?: string): Promise<ServiceResult<any[]>> {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docket Alarm is not configured. Set up in Settings → Integrations.", provider: "DOCKET_ALARM" };

  try {
    const params = new URLSearchParams({ q: query, token: config.apiKey });
    if (court) params.set("court", court);
    const res = await makeApiCall(`${config.baseUrl}/search?${params}`);
    if (!res.ok) return { success: false, error: `Docket Alarm returned ${res.status}`, provider: "DOCKET_ALARM" };
    const data = await res.json();
    return { success: true, data: data.results || data || [], provider: "DOCKET_ALARM" };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "DOCKET_ALARM" };
  }
}

export async function docketAlarmTrackCase(courtId: string, caseNumber: string, matterId: string): Promise<ServiceResult<{ alertId: string }>> {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docket Alarm is not configured.", provider: "DOCKET_ALARM" };

  try {
    const res = await makeApiCall(`${config.baseUrl}/alerts/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ court: courtId, docket: caseNumber, token: config.apiKey, webhook_url: config.webhookUrl }),
    });
    if (!res.ok) return { success: false, error: `Track failed: ${res.status}`, provider: "DOCKET_ALARM" };
    const data = await res.json();
    return { success: true, data: { alertId: data.id || data.alert_id || `da_${Date.now()}` }, provider: "DOCKET_ALARM" };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "DOCKET_ALARM" };
  }
}

export async function processWebhook(payload: any): Promise<DocketAlertPayload> {
  return {
    externalId: payload.id || payload.alert_id || "",
    alertType: payload.type || payload.event_type || "NEW_FILING",
    caseNumber: payload.docket || payload.case_number || "",
    courtName: payload.court || "",
    title: payload.title || payload.description || "New filing detected",
    description: payload.description || payload.text,
    dueDate: payload.due_date ? new Date(payload.due_date) : undefined,
    filingDate: payload.filing_date ? new Date(payload.filing_date) : undefined,
    rawData: payload,
  };
}
