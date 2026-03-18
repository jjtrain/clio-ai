import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

const API_BASE = "https://api.docketwise.com/v1";

async function getConfig() {
  const config = await db.immigrationIntegration.findUnique({ where: { provider: "DOCKETWISE" } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return { baseUrl: config.baseUrl || API_BASE, apiKey: config.apiKey };
}

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export async function testConnection() {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise is not configured. Set up in Settings → Integrations." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/account`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Docketwise API returned ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getCases(params?: { page?: number; limit?: number; status?: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.status) qs.set("status", params.status);
    const res = await makeApiCall(`${config.baseUrl}/cases?${qs}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getCase(id: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${id}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function createCase(data: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify(data),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function updateCase(id: string, data: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${id}`, {
      method: "PATCH", headers: headers(config.apiKey), body: JSON.stringify(data),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function deleteCase(id: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${id}`, {
      method: "DELETE", headers: headers(config.apiKey),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: { deleted: true } };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getForms(caseId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/forms`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getForm(caseId: string, formId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/forms/${formId}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function startForm(caseId: string, data: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/forms`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify(data),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function updateFormFields(caseId: string, formId: string, fields: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/forms/${formId}`, {
      method: "PATCH", headers: headers(config.apiKey), body: JSON.stringify(fields),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function validateForm(caseId: string, formId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/forms/${formId}/validate`, {
      method: "POST", headers: headers(config.apiKey),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function generateFormPDF(caseId: string, formId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/forms/${formId}/generate`, {
      method: "POST", headers: headers(config.apiKey),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getFormEditUrl(caseId: string, formId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/forms/${formId}/edit-url`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getAvailableForms() {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/forms/available`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getQuestionnaires(caseId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/questionnaires`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function sendQuestionnaire(caseId: string, qId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/questionnaires/${qId}/send`, {
      method: "POST", headers: headers(config.apiKey),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getQuestionnaireResponses(caseId: string, qId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/questionnaires/${qId}/responses`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getDocumentChecklist(caseId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/documents/checklist`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function uploadDocument(caseId: string, data: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/documents`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify(data),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getDocuments(caseId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/documents`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getDeadlines(caseId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/deadlines`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function checkCaseStatus(receiptNumber: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/status/check`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ receiptNumber }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function checkCaseStatusBulk(receiptNumbers: string[]) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/status/check/bulk`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ receiptNumbers }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getVisaBulletin() {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/visa-bulletin`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getProcessingTimes(params?: { formNumber?: string; office?: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const qs = new URLSearchParams();
    if (params?.formNumber) qs.set("form", params.formNumber);
    if (params?.office) qs.set("office", params.office);
    const res = await makeApiCall(`${config.baseUrl}/processing-times?${qs}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getCaseTimeline(caseId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/timeline`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function getClientPortalLink(caseId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/cases/${caseId}/portal`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function syncCaseToClioAI(docketwiseCaseId: string, matterId: string, clientId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const caseRes = await getCase(docketwiseCaseId);
    if (!caseRes.success) return { success: false, error: `Failed to fetch case: ${caseRes.error}` };
    const dwCase = caseRes.data;

    const existing = await db.immigrationCase.findFirst({ where: { externalCaseId: docketwiseCaseId } });
    const caseData = {
      clientId, matterId, externalCaseId: docketwiseCaseId, provider: "DOCKETWISE" as const,
      caseType: (dwCase.case_type || dwCase.caseType || "OTHER") as any,
      status: (dwCase.status === "approved" ? "APPROVED" : dwCase.status === "denied" ? "DENIED" : dwCase.status === "pending" ? "PENDING" : "PREPARING") as any,
      receiptNumber: dwCase.receipt_number || dwCase.receiptNumber || null,
      beneficiaryName: dwCase.beneficiary_name || dwCase.beneficiaryName || "Unknown",
      petitionerName: dwCase.petitioner_name || dwCase.petitionerName || null,
      priorityDate: dwCase.priority_date ? new Date(dwCase.priority_date) : null,
      notes: dwCase.notes || null,
    };
    const immigrationCase = existing
      ? await db.immigrationCase.update({ where: { id: existing.id }, data: caseData })
      : await db.immigrationCase.create({ data: caseData });

    // Sync forms
    const formsRes = await getForms(docketwiseCaseId);
    if (formsRes.success && Array.isArray(formsRes.data)) {
      for (const f of formsRes.data) {
        const existingForm = await db.immigrationForm.findFirst({ where: { externalFormId: f.id || f.form_id, caseId: immigrationCase.id } });
        if (existingForm) {
          await db.immigrationForm.update({ where: { id: existingForm.id }, data: { status: (f.status || "NOT_STARTED") as any } });
        } else {
          await db.immigrationForm.create({ data: { caseId: immigrationCase.id, matterId: immigrationCase.matterId, externalFormId: f.id || f.form_id, formNumber: f.form_number || f.formNumber || "", formTitle: f.title || f.form_title || "", status: (f.status || "NOT_STARTED") as any } });
        }
      }
    }

    return { success: true, data: immigrationCase };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function syncClioAIToDocketwise(immigrationCaseId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Docketwise not configured." };
  try {
    const immCase = await db.immigrationCase.findUnique({ where: { id: immigrationCaseId } });
    if (!immCase) return { success: false, error: "Immigration case not found." };
    if (!immCase.externalCaseId) return { success: false, error: "Case has no Docketwise link." };

    const res = await updateCase(immCase.externalCaseId, {
      case_type: immCase.caseType, status: immCase.status,
      receipt_number: immCase.receiptNumber, beneficiary_name: immCase.beneficiaryName,
      petitioner_name: immCase.petitionerName, notes: immCase.notes,
    });
    return res;
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function processWebhook(payload: any) {
  const eventType = payload.event || payload.type || "";
  const caseData = payload.case || payload.data?.case || {};
  const externalCaseId = caseData.id || payload.case_id || "";

  try {
    const existingCase = externalCaseId
      ? await db.immigrationCase.findFirst({ where: { externalCaseId } })
      : null;

    // Update case status for status-related events
    if (existingCase && ["case.updated", "receipt.issued", "rfe.received", "interview.scheduled",
      "biometrics.scheduled", "case.approved", "case.denied"].includes(eventType)) {
      const statusMap: Record<string, string> = {
        "case.approved": "APPROVED", "case.denied": "DENIED", "rfe.received": "RFE",
        "interview.scheduled": "INTERVIEW_SCHEDULED", "biometrics.scheduled": "BIOMETRICS_SCHEDULED",
      };
      const newStatus = statusMap[eventType] || caseData.status || existingCase.status;
      await db.immigrationCase.update({ where: { id: existingCase.id }, data: { status: newStatus } });
    }

    // Create form record for form events
    if (existingCase && eventType.startsWith("form.")) {
      const formData = payload.form || payload.data?.form || {};
      if (formData.id && existingCase) {
        const existingForm = await db.immigrationForm.findFirst({ where: { externalFormId: formData.id, caseId: existingCase.id } });
        if (existingForm) {
          await db.immigrationForm.update({ where: { id: existingForm.id }, data: { status: (formData.status || "IN_PROGRESS") as any } });
        } else {
          await db.immigrationForm.create({ data: { caseId: existingCase.id, matterId: existingCase.matterId, externalFormId: formData.id, formNumber: formData.form_number || formData.formNumber || "", formTitle: formData.title || "", status: (formData.status || "IN_PROGRESS") as any } });
        }
      }
    }

    // Create activity record
    if (existingCase) {
      await db.immigrationActivity.create({
        data: {
          caseId: existingCase.id, activityType: "NOTE_ADDED" as any,
          description: payload.description || payload.message || `Webhook: ${eventType}`,
          metadata: JSON.stringify(payload),
        },
      });
    }

    // Handle questionnaire events
    if (existingCase && eventType.startsWith("questionnaire.")) {
      const qData = payload.questionnaire || payload.data?.questionnaire || {};
      await db.immigrationActivity.create({
        data: {
          caseId: existingCase.id, activityType: "NOTE_ADDED" as any,
          description: `Questionnaire ${qData.status || "updated"}: ${qData.title || qData.id || ""}`,
          metadata: JSON.stringify(qData),
        },
      });
    }

    // Handle document events
    if (existingCase && eventType.startsWith("document.")) {
      const docData = payload.document || payload.data?.document || {};
      await db.immigrationActivity.create({
        data: {
          caseId: existingCase.id, activityType: "NOTE_ADDED" as any,
          description: `Document ${docData.status || "updated"}: ${docData.title || docData.name || ""}`,
          metadata: JSON.stringify(docData),
        },
      });
    }

    // Handle deadline events
    if (existingCase && eventType.startsWith("deadline.")) {
      const dlData = payload.deadline || payload.data?.deadline || {};
      await db.immigrationActivity.create({
        data: {
          caseId: existingCase.id, activityType: "NOTE_ADDED" as any,
          description: `Deadline ${dlData.action || "updated"}: ${dlData.title || ""}`,
          metadata: JSON.stringify(dlData),
        },
      });
    }

    return { success: true, processed: true, eventType, caseId: existingCase?.id || null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
