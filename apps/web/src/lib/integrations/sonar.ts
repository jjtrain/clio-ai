import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

const DEFAULT_BASE = "https://api.sonar.legal/v1";

async function getConfig() {
  const config = await db.investigationsIntegration.findUnique({ where: { provider: "SONAR" } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return { baseUrl: config.baseUrl || DEFAULT_BASE, apiKey: config.apiKey, webhookUrl: config.webhookUrl };
}

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

async function getRequest(endpoint: string) {
  const config = await getConfig();
  if (!config) return { success: false as const, error: "Sonar is not configured. Set up in Settings → Integrations.", provider: "SONAR" };
  try {
    const res = await makeApiCall(`${config.baseUrl}${endpoint}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false as const, error: `Sonar returned ${res.status}`, provider: "SONAR" };
    return { success: true as const, data: await res.json(), provider: "SONAR" };
  } catch (err: any) { return { success: false as const, error: err.message, provider: "SONAR" }; }
}

async function postRequest(endpoint: string, body: Record<string, any>) {
  const config = await getConfig();
  if (!config) return { success: false as const, error: "Sonar is not configured. Set up in Settings → Integrations.", provider: "SONAR" };
  try {
    const res = await makeApiCall(`${config.baseUrl}${endpoint}`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify(body),
    });
    if (!res.ok) return { success: false as const, error: `Sonar returned ${res.status}`, provider: "SONAR" };
    return { success: true as const, data: await res.json(), provider: "SONAR" };
  } catch (err: any) { return { success: false as const, error: err.message, provider: "SONAR" }; }
}

export async function testConnection() {
  return getRequest("/account");
}

export async function identifyProspect(params: Record<string, any>) {
  return postRequest("/identify", params);
}

export async function searchIncidents(params: Record<string, any>) {
  return postRequest("/search/incidents", params);
}

export async function getIncidentDetail(id: string) {
  return getRequest(`/incidents/${id}`);
}

export async function searchByPhone(params: Record<string, any>) {
  return postRequest("/search/phone", params);
}

export async function searchByAddress(params: Record<string, any>) {
  return postRequest("/search/address", params);
}

export async function monitorForIncidents(params: Record<string, any>) {
  return postRequest("/monitoring/start", params);
}

export async function stopMonitoring(id: string) {
  return postRequest(`/monitoring/${id}/stop`, {});
}

export async function getMonitoringAlerts() {
  return getRequest("/monitoring/alerts");
}

export async function acknowledgeAlert(id: string) {
  return postRequest(`/monitoring/alerts/${id}/acknowledge`, {});
}

export async function getPersonReport(id: string) {
  return getRequest(`/persons/${id}/report`);
}

export async function getMarketInsights() {
  return getRequest("/insights/market");
}

export async function getLeadScore(id: string) {
  return getRequest(`/persons/${id}/lead-score`);
}

export async function convertToLead(id: string) {
  return postRequest(`/persons/${id}/convert`, {});
}

export async function getStats() {
  return getRequest("/reports/stats");
}

export async function processWebhook(payload: any) {
  const alertType = payload.type || payload.event_type || "NEW_COURT_CASE";
  const severity = payload.severity === "critical" ? "CRITICAL" : payload.severity === "warning" ? "WARNING" : "INFO";

  const alert = await db.monitoringAlert.create({
    data: {
      provider: "SONAR",
      externalAlertId: payload.id || payload.alert_id,
      matterId: payload.matter_id || payload.matterId,
      clientId: payload.client_id || payload.clientId,
      monitoringType: alertType as any,
      subject: payload.subject || payload.person_name || "Unknown",
      title: payload.title || "New Sonar Alert",
      description: payload.description || payload.summary || "Monitoring alert received",
      severity: severity as any,
      data: JSON.stringify(payload),
    },
  });

  // Optionally create lead if incident involves a potential client
  let lead = null;
  if (payload.create_lead && payload.person_name) {
    lead = await db.lead.create({
      data: {
        name: payload.person_name,
        email: payload.email || null,
        phone: payload.phone || null,
        source: "OTHER",
        status: "NEW",
        notes: `Auto-created from Sonar alert: ${payload.title || alertType}`,
      },
    });
  }

  return { received: true, alertId: alert.id, leadId: lead?.id || null };
}
