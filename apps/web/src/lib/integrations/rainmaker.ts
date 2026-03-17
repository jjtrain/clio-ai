import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

const DEFAULT_BASE = "https://api.rainmaker.legal/v1";

async function getConfig() {
  const config = await db.finInsightsIntegration.findUnique({ where: { provider: "RAINMAKER" } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return { baseUrl: config.baseUrl || DEFAULT_BASE, apiKey: config.apiKey, accountId: config.accountId, firmId: config.firmId };
}

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export async function testConnection() {
  const config = await getConfig();
  if (!config) return { success: false, error: "Rainmaker is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/account`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Rainmaker API returned ${res.status}` };
    const data = await res.json();
    return { success: true, firmName: data.firmName, diagnosticsRun: data.diagnosticsRun, activeWorkPlans: data.activeWorkPlans };
  } catch (err: any) {
    return { success: false, error: `Rainmaker error: ${err.message}` };
  }
}

export async function runDiagnostic(params: {
  clientId?: string;
  clientName: string;
  clientIndustry?: string;
  clientSize?: string;
  diagnosticType: string;
  existingMatters?: Array<{ name: string; practiceArea: string; status: string }>;
  financialData?: { annualRevenue?: number; employeeCount?: number; yearsInBusiness?: number; state?: string; entityType?: string };
  additionalContext?: string;
}) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Rainmaker is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/diagnostics`, {
      method: "POST",
      headers: headers(config.apiKey),
      body: JSON.stringify({ firmId: config.firmId, ...params }),
      timeout: 30000,
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    const data = await res.json();
    return { success: true, diagnosticId: data.diagnosticId, status: data.status, estimatedCompletion: data.estimatedCompletion };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getDiagnostic(diagnosticId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Rainmaker is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/diagnostics/${diagnosticId}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getDiagnostics(params?: { clientId?: string; status?: string; diagnosticType?: string; dateRange?: { start: string; end: string } }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Rainmaker is not configured." };
  try {
    const qs = new URLSearchParams();
    if (params?.clientId) qs.set("clientId", params.clientId);
    if (params?.status) qs.set("status", params.status);
    if (params?.diagnosticType) qs.set("diagnosticType", params.diagnosticType);
    if (params?.dateRange) { qs.set("startDate", params.dateRange.start); qs.set("endDate", params.dateRange.end); }
    const res = await makeApiCall(`${config.baseUrl}/diagnostics?${qs}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getFindings(diagnosticId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Rainmaker is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/diagnostics/${diagnosticId}/findings`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getOpportunities(diagnosticId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Rainmaker is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/diagnostics/${diagnosticId}/opportunities`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function generateWorkPlan(diagnosticId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Rainmaker is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/diagnostics/${diagnosticId}/work-plan`, {
      method: "POST", headers: headers(config.apiKey),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getWorkPlan(diagnosticId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Rainmaker is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/diagnostics/${diagnosticId}/work-plan`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updateWorkPlanTask(diagnosticId: string, taskId: string, params: { status?: string; assignedTo?: string; notes?: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Rainmaker is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/diagnostics/${diagnosticId}/work-plan/${taskId}`, {
      method: "PUT", headers: headers(config.apiKey), body: JSON.stringify(params),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function convertOpportunityToMatter(diagnosticId: string, opportunityId: string, params: { matterName: string; practiceArea: string; assignedTo?: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Rainmaker is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/diagnostics/${diagnosticId}/opportunities/${opportunityId}/convert`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify(params),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getClientHealthScore(clientId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Rainmaker is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/clients/${clientId}/health`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getAnnualReviewTemplate(clientId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Rainmaker is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/clients/${clientId}/annual-review`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getIndustryInsights(industry: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Rainmaker is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/insights/industry?industry=${encodeURIComponent(industry)}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getRiskReport(params: { clientId?: string; firmWide?: boolean }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Rainmaker is not configured." };
  try {
    const qs = new URLSearchParams();
    if (params.clientId) qs.set("clientId", params.clientId);
    if (params.firmWide) qs.set("firmWide", "true");
    const res = await makeApiCall(`${config.baseUrl}/reports/risk?${qs}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getOpportunityPipeline() {
  const config = await getConfig();
  if (!config) return { success: false, error: "Rainmaker is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/pipeline/opportunities`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function processWebhook(payload: any) {
  const event = {
    type: payload.event || payload.type,
    data: payload.data || payload,
    timestamp: payload.timestamp || new Date().toISOString(),
  };

  if (event.type === "diagnostic_completed" && event.data.diagnosticId) {
    const diag = await db.rainmakerDiagnostic.findFirst({ where: { id: event.data.diagnosticId } });
    if (diag) {
      await db.rainmakerDiagnostic.update({
        where: { id: diag.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          riskScore: event.data.riskScore,
          opportunityScore: event.data.opportunityScore,
          findings: event.data.findings ? JSON.stringify(event.data.findings) : undefined,
          opportunities: event.data.opportunities ? JSON.stringify(event.data.opportunities) : undefined,
          aiAnalysis: event.data.aiAnalysis,
        },
      });
    }
  }

  if (event.type === "risk_alert") {
    await db.financialAlert.create({
      data: {
        provider: "RAINMAKER",
        alertType: "PROFITABILITY_RISK",
        severity: event.data.severity === "critical" ? "CRITICAL" : "WARNING",
        title: event.data.title || "Rainmaker Risk Alert",
        description: event.data.description || "",
        recommendation: event.data.recommendation,
        linkedClientId: event.data.clientId,
      },
    });
  }

  if (event.type === "opportunity_identified") {
    await db.financialAlert.create({
      data: {
        provider: "RAINMAKER",
        alertType: "OPPORTUNITY",
        severity: "INFO",
        title: event.data.title || "New Opportunity Identified",
        description: event.data.description || "",
        recommendation: event.data.recommendation,
        linkedClientId: event.data.clientId,
      },
    });
  }

  if (event.type === "work_plan_generated" && event.data.diagnosticId) {
    const diag = await db.rainmakerDiagnostic.findFirst({ where: { id: event.data.diagnosticId } });
    if (diag) {
      await db.rainmakerDiagnostic.update({
        where: { id: diag.id },
        data: { workPlan: JSON.stringify(event.data.workPlan) },
      });
    }
  }

  return event;
}
