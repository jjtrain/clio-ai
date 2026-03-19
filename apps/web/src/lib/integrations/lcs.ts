import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

const API_BASE = "https://api.lawyerconveyance.com/v1";

async function getConfig() {
  const config = await db.conveyancingIntegration.findUnique({ where: { provider: "LCS" } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return { baseUrl: config.baseUrl || API_BASE, apiKey: config.apiKey };
}

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export async function testConnection() {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS is not configured. Set up in Settings → Integrations." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/account`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `LCS API returned ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function createMatter(data: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify(data) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getMatter(id: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${id}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getMatters(params?: { page?: number; limit?: number; status?: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.status) qs.set("status", params.status);
    const res = await makeApiCall(`${config.baseUrl}/matters?${qs}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function updateMatter(id: string, data: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${id}`, { method: "PATCH", headers: headers(config.apiKey), body: JSON.stringify(data) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getChecklist(matterId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/checklist`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function updateChecklistItem(matterId: string, itemId: string, data: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/checklist/${itemId}`, { method: "PUT", headers: headers(config.apiKey), body: JSON.stringify(data) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getAdjustments(matterId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/adjustments`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function calculateAdjustments(matterId: string, data?: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/adjustments/calculate`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify(data || {}) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function addAdjustment(matterId: string, data: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/adjustments`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify(data) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function updateAdjustment(matterId: string, adjId: string, data: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/adjustments/${adjId}`, { method: "PUT", headers: headers(config.apiKey), body: JSON.stringify(data) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function deleteAdjustment(matterId: string, adjId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/adjustments/${adjId}`, { method: "DELETE", headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: { deleted: true } };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function generateClosingStatement(matterId: string, data?: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/closing-statement`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify(data || {}) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getClosingStatement(matterId: string, stmtId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/closing-statement/${stmtId}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function generateDocument(matterId: string, data: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/documents/generate`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify(data) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getAvailableDocuments() {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/documents/available`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getGeneratedDocuments(matterId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/documents`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function downloadDocument(matterId: string, docId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/documents/${docId}/download`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getTitleExceptions(matterId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/title-exceptions`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function addTitleException(matterId: string, data: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/title-exceptions`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify(data) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function updateTitleException(matterId: string, excId: string, data: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/title-exceptions/${excId}`, { method: "PUT", headers: headers(config.apiKey), body: JSON.stringify(data) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function clearTitleException(matterId: string, excId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/title-exceptions/${excId}/clear`, { method: "POST", headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function calculateTransferTax(data: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/calculate/transfer-tax`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify(data) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function calculateMortgageTax(data: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/calculate/mortgage-tax`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify(data) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getFinancialSummary(matterId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/financials`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getContactDirectory(matterId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "LCS not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/matters/${matterId}/contacts`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function processWebhook(payload: any) {
  const eventType = payload.event || payload.type || "";
  const matterData = payload.matter || payload.data?.matter || {};
  const externalMatterId = matterData.id || payload.matter_id || "";

  try {
    const existingMatter = externalMatterId
      ? await db.conveyancingMatter.findFirst({ where: { externalMatterId } })
      : null;

    // Update status for matter/status events
    if (existingMatter && ["matter.updated", "matter.status_changed", "closing.scheduled", "closing.completed"].includes(eventType)) {
      const statusMap: Record<string, string> = {
        "matter.status_changed": matterData.status || existingMatter.status,
        "closing.scheduled": "CLOSING_SCHEDULED",
        "closing.completed": "CLOSED",
      };
      const newStatus = statusMap[eventType] || matterData.status || existingMatter.status;
      await db.conveyancingMatter.update({ where: { id: existingMatter.id }, data: { status: newStatus } });
    }

    // Create activity for document events
    if (existingMatter && eventType.startsWith("document.")) {
      const docData = payload.document || payload.data?.document || {};
      await db.conveyancingActivity.create({
        data: {
          conveyancingMatterId: existingMatter.id, activityType: "DOCUMENT_GENERATED" as any,
          description: `Document ${docData.status || "updated"}: ${docData.title || docData.name || ""}`,
          metadata: JSON.stringify(docData),
        },
      });
    }

    // Create activity for checklist events
    if (existingMatter && eventType.startsWith("checklist.")) {
      const checkData = payload.checklist || payload.data?.checklist || {};
      await db.conveyancingActivity.create({
        data: {
          conveyancingMatterId: existingMatter.id, activityType: "CHECKLIST_UPDATED" as any,
          description: `Checklist ${checkData.action || "updated"}: ${checkData.item || ""}`,
          metadata: JSON.stringify(checkData),
        },
      });
    }

    // Create activity for closing events
    if (existingMatter && eventType.startsWith("closing.")) {
      const closingData = payload.closing || payload.data?.closing || {};
      await db.conveyancingActivity.create({
        data: {
          conveyancingMatterId: existingMatter.id, activityType: "CLOSING_SCHEDULED" as any,
          description: `Closing ${closingData.action || eventType.replace("closing.", "")}: ${closingData.date || ""}`,
          metadata: JSON.stringify(closingData),
        },
      });
    }

    // Create activity for title events
    if (existingMatter && eventType.startsWith("title.")) {
      const titleData = payload.title || payload.data?.title || {};
      await db.conveyancingActivity.create({
        data: {
          conveyancingMatterId: existingMatter.id, activityType: "TITLE_UPDATED" as any,
          description: `Title ${titleData.action || "updated"}: ${titleData.exception || ""}`,
          metadata: JSON.stringify(titleData),
        },
      });
    }

    // General activity log
    if (existingMatter && !eventType.startsWith("document.") && !eventType.startsWith("checklist.") && !eventType.startsWith("closing.") && !eventType.startsWith("title.")) {
      await db.conveyancingActivity.create({
        data: {
          conveyancingMatterId: existingMatter.id, activityType: "NOTE_ADDED" as any,
          description: payload.description || payload.message || `Webhook: ${eventType}`,
          metadata: JSON.stringify(payload),
        },
      });
    }

    return { received: true, matterId: existingMatter?.id || null, eventType };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
