import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

const DEFAULT_BASE = "https://api.legl.com/v1";

async function getConfig() {
  const config = await db.complianceIntegration.findUnique({ where: { provider: "LEGL" } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return { baseUrl: config.baseUrl || DEFAULT_BASE, apiKey: config.apiKey, apiSecret: config.apiSecret, accountId: config.accountId, firmId: config.firmId };
}

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export async function testConnection() {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/account`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Legl API returned ${res.status}` };
    const data = await res.json();
    return { success: true, firmName: data.firmName, plan: data.plan, checksRemaining: data.checksRemaining, activeMonitoring: data.activeMonitoring };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function initiateCheck(params: {
  subjectType: string; name: string; email: string; phone?: string; dob?: string;
  nationality?: string; address?: string; companyName?: string; companyRegistrationNumber?: string;
  companyJurisdiction?: string; checkTypes: string[]; policyId?: string; matterId?: string;
  clientPortalBranding?: { firmName: string; logoUrl?: string; primaryColor?: string };
}) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks`, {
      method: "POST", headers: headers(config.apiKey),
      body: JSON.stringify({ firm_id: config.firmId, ...params }), timeout: 30000,
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    const data = await res.json();
    return { success: true, checkId: data.id || data.checkId, clientPortalUrl: data.clientPortalUrl || data.portal_url, status: data.status, estimatedCompletion: data.estimatedCompletion };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getCheck(checkId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getChecks(params?: { status?: string; clientEmail?: string; riskLevel?: string; page?: number }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.clientEmail) qs.set("email", params.clientEmail);
    if (params?.riskLevel) qs.set("risk_level", params.riskLevel);
    if (params?.page) qs.set("page", params.page.toString());
    const res = await makeApiCall(`${config.baseUrl}/checks?${qs}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateCheck(checkId: string, params: { additionalCheckTypes?: string[]; notes?: string; priority?: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}`, {
      method: "PATCH", headers: headers(config.apiKey), body: JSON.stringify(params),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function cancelCheck(checkId: string, reason: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/cancel`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ reason }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function approveCheck(checkId: string, params: { approvedBy: string; notes?: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/approve`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify(params),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function rejectCheck(checkId: string, params: { rejectedBy: string; reason: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/reject`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify(params),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function referCheck(checkId: string, params: { referredBy: string; reason: string; referredTo?: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/refer`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify(params),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getSanctionsResult(checkId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/sanctions`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getPEPResult(checkId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/pep`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getAdverseMediaResult(checkId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/adverse-media`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function resolveSanctionsMatch(checkId: string, matchId: string, resolution: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/sanctions/${matchId}/resolve`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ resolution }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function resolvePEPMatch(checkId: string, matchId: string, resolution: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/pep/${matchId}/resolve`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ resolution }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function resolveAdverseMediaMatch(checkId: string, matchId: string, resolution: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/adverse-media/${matchId}/resolve`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ resolution }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getDocuments(checkId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/documents`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function requestAdditionalDocument(checkId: string, params: { documentType: string; reason: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/documents/request`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify(params),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function verifyDocument(checkId: string, documentId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/documents/${documentId}/verify`, {
      method: "POST", headers: headers(config.apiKey),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function rejectDocument(checkId: string, documentId: string, reason: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/documents/${documentId}/reject`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ reason }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function startOngoingMonitoring(checkId: string, params: { frequency: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/monitoring/start`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify(params),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function stopOngoingMonitoring(checkId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/monitoring/stop`, {
      method: "POST", headers: headers(config.apiKey),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getMonitoringAlerts(checkId?: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const url = checkId ? `${config.baseUrl}/checks/${checkId}/monitoring/alerts` : `${config.baseUrl}/monitoring/alerts`;
    const res = await makeApiCall(url, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function acknowledgeAlert(alertId: string, params: { action: string; notes?: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/monitoring/alerts/${alertId}/acknowledge`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify(params),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getRiskAssessment(checkId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/risk`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function generateClientPortalLink(checkId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/portal-link`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function resendClientNotification(checkId: string, method?: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/checks/${checkId}/notify`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ method: method || "email" }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getComplianceStats() {
  const config = await getConfig();
  if (!config) return { success: false, error: "Legl is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/stats`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function processWebhook(payload: any) {
  const event = { type: payload.event || payload.type, data: payload.data || payload.payload || {}, timestamp: payload.timestamp || new Date().toISOString() };

  const checkId = event.data.check_id || event.data.checkId;
  if (!checkId) return event;

  const check = await db.complianceCheck.findFirst({ where: { externalCheckId: checkId } });
  if (!check) return event;

  // Log activity
  const activityMap: Record<string, string> = {
    "check.initiated": "CHECK_INITIATED", "check.client_notified": "CLIENT_NOTIFIED",
    "check.documents_submitted": "DOCUMENT_SUBMITTED", "check.document_verified": "DOCUMENT_VERIFIED",
    "check.document_rejected": "DOCUMENT_REJECTED", "check.sanctions_clear": "SANCTIONS_CLEAR",
    "check.sanctions_match": "SANCTIONS_MATCH", "check.pep_clear": "PEP_CLEAR",
    "check.pep_match": "PEP_MATCH", "check.adverse_media_clear": "ADVERSE_MEDIA_CLEAR",
    "check.adverse_media_match": "ADVERSE_MEDIA_MATCH", "check.risk_assessed": "RISK_ASSESSED",
    "check.completed": "STATUS_CHANGED", "check.passed": "APPROVED",
    "check.failed": "FAILED", "monitoring.alert": "MONITORING_ALERT",
  };

  const actType = activityMap[event.type];
  if (actType) {
    await db.complianceActivity.create({
      data: { checkId: check.id, activityType: actType as any, description: `${event.type}: ${event.data.description || event.data.message || event.type}`, performedBy: "legl", metadata: JSON.stringify(event.data) },
    });
  }

  // Update check based on event
  const updates: any = {};
  if (event.type === "check.sanctions_clear") { updates.sanctionsResult = "CLEAR"; }
  if (event.type === "check.sanctions_match") { updates.sanctionsResult = "POTENTIAL_MATCH"; updates.sanctionsMatches = JSON.stringify(event.data.matches || []); }
  if (event.type === "check.pep_clear") { updates.pepResult = "CLEAR"; }
  if (event.type === "check.pep_match") { updates.pepResult = "POTENTIAL_MATCH"; updates.pepMatches = JSON.stringify(event.data.matches || []); }
  if (event.type === "check.adverse_media_clear") { updates.adverseMediaResult = "CLEAR"; }
  if (event.type === "check.adverse_media_match") { updates.adverseMediaResult = "POTENTIAL_MATCH"; updates.adverseMediaMatches = JSON.stringify(event.data.matches || []); }
  if (event.type === "check.risk_assessed") { updates.riskScore = event.data.risk_score; updates.overallRiskLevel = mapRiskLevel(event.data.risk_level); }
  if (event.type === "check.passed") { updates.status = "PASSED"; updates.expiresAt = new Date(Date.now() + 365 * 86400000); }
  if (event.type === "check.failed") { updates.status = "FAILED"; }
  if (event.type === "check.client_notified") { updates.status = "PENDING_CLIENT"; }
  if (event.type === "check.documents_submitted") { updates.status = "IN_PROGRESS"; }

  if (Object.keys(updates).length > 0) {
    await db.complianceCheck.update({ where: { id: check.id }, data: updates });
  }

  return event;
}

function mapRiskLevel(level: string): string {
  const map: Record<string, string> = { low: "LOW", medium: "MEDIUM", high: "HIGH", very_high: "VERY_HIGH", prohibited: "PROHIBITED" };
  return map[level?.toLowerCase()] || "MEDIUM";
}
