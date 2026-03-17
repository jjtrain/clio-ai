import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

const DEFAULT_BASE = "https://api.pwc.com/insightsofficer/v1";

async function getConfig() {
  const config = await db.finInsightsIntegration.findUnique({ where: { provider: "PWC_INSIGHTS" } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return { baseUrl: config.baseUrl || DEFAULT_BASE, apiKey: config.apiKey, accountId: config.accountId, firmId: config.firmId };
}

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export async function testConnection() {
  const config = await getConfig();
  if (!config) return { success: false, error: "PwC InsightsOfficer is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/account`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `PwC API returned ${res.status}` };
    const data = await res.json();
    return { success: true, firmName: data.firmName, plan: data.plan, lastReport: data.lastReport };
  } catch (err: any) {
    return { success: false, error: `PwC error: ${err.message}` };
  }
}

export async function pushFinancialData(params: {
  period: string;
  revenue: number;
  expenses: Array<{ category: string; amount: number }>;
  invoices: Array<{ id: string; amount: number; paidAmount: number; dueDate: string; status: string }>;
  timeEntries: Array<{ hours: number; billingRate: number; matterId: string; billed: boolean }>;
  trustBalances: Array<{ account: string; balance: number }>;
  bankBalances?: Array<{ account: string; balance: number }>;
  payroll?: Array<{ employee: string; amount: number }>;
}) {
  const config = await getConfig();
  if (!config) return { success: false, error: "PwC InsightsOfficer is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/data/push`, {
      method: "POST",
      headers: headers(config.apiKey),
      body: JSON.stringify({ accountId: config.accountId, firmId: config.firmId, ...params }),
      timeout: 30000,
    });
    if (!res.ok) return { success: false, error: `Push failed: ${res.status}` };
    const data = await res.json();
    await db.finInsightsIntegration.update({
      where: { provider: "PWC_INSIGHTS" },
      data: { lastSyncAt: new Date(), lastSyncStatus: "success" },
    });
    return { success: true, syncId: data.syncId, status: data.status };
  } catch (err: any) {
    await db.finInsightsIntegration.update({
      where: { provider: "PWC_INSIGHTS" },
      data: { lastSyncAt: new Date(), lastSyncStatus: "error", lastSyncError: err.message },
    }).catch(() => {});
    return { success: false, error: err.message };
  }
}

export async function getInsightsReport(period: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "PwC InsightsOfficer is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/reports/insights?period=${period}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getBookkeepingReview(period: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "PwC InsightsOfficer is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/reports/bookkeeping?period=${period}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getBenchmarks(params: { metrics: string[]; industry?: string; firmSize?: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "PwC InsightsOfficer is not configured." };
  try {
    const qs = new URLSearchParams({ metrics: params.metrics.join(","), industry: params.industry || "legal_services", firmSize: params.firmSize || "solo_small" });
    const res = await makeApiCall(`${config.baseUrl}/benchmarks?${qs}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getCashFlowForecast(months: number) {
  const config = await getConfig();
  if (!config) return { success: false, error: "PwC InsightsOfficer is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/forecasts/cash-flow?months=${months}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getRevenueForecast(months: number) {
  const config = await getConfig();
  if (!config) return { success: false, error: "PwC InsightsOfficer is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/forecasts/revenue?months=${months}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getProfitabilityAnalysis(params: { by: "client" | "matter" | "practice_area" | "attorney"; period: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "PwC InsightsOfficer is not configured." };
  try {
    const qs = new URLSearchParams({ by: params.by, period: params.period });
    const res = await makeApiCall(`${config.baseUrl}/analysis/profitability?${qs}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getTrustCompliance(period: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "PwC InsightsOfficer is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/reports/trust-compliance?period=${period}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getExpenseAnalysis(period: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "PwC InsightsOfficer is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/reports/expenses?period=${period}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getKPIDashboard() {
  const config = await getConfig();
  if (!config) return { success: false, error: "PwC InsightsOfficer is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/dashboard/kpis`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getAlerts() {
  const config = await getConfig();
  if (!config) return { success: false, error: "PwC InsightsOfficer is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/alerts`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getHistoricalTrends(metric: string, periods: number) {
  const config = await getConfig();
  if (!config) return { success: false, error: "PwC InsightsOfficer is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/trends?metric=${metric}&periods=${periods}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function generateTaxPrep(taxYear: number) {
  const config = await getConfig();
  if (!config) return { success: false, error: "PwC InsightsOfficer is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/reports/tax-prep?year=${taxYear}`, { headers: headers(config.apiKey) });
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

  if (event.type === "alert_generated" && event.data) {
    await db.financialAlert.create({
      data: {
        provider: "PWC_INSIGHTS",
        alertType: mapPwcAlertType(event.data.alertType),
        severity: mapPwcSeverity(event.data.severity),
        title: event.data.title || "PwC Alert",
        description: event.data.description || "",
        metric: event.data.metric,
        currentValue: event.data.currentValue,
        thresholdValue: event.data.thresholdValue,
        recommendation: event.data.recommendation,
      },
    });
  }

  if (event.type === "sync_completed") {
    await db.finInsightsIntegration.update({
      where: { provider: "PWC_INSIGHTS" },
      data: { lastSyncAt: new Date(), lastSyncStatus: "success" },
    }).catch(() => {});
  }

  if (event.type === "compliance_issue") {
    await db.financialAlert.create({
      data: {
        provider: "PWC_INSIGHTS",
        alertType: "CUSTOM",
        severity: "CRITICAL",
        title: event.data.title || "Compliance Issue",
        description: event.data.description || "PwC has identified a compliance issue.",
        recommendation: event.data.recommendation,
      },
    });
  }

  return event;
}

function mapPwcAlertType(type: string): any {
  const map: Record<string, string> = {
    revenue_decline: "REVENUE_DECLINE", expense_spike: "EXPENSE_SPIKE", ar_aging: "AR_AGING",
    cash_flow_warning: "CASH_FLOW_WARNING", utilization_drop: "UTILIZATION_DROP",
    collection_rate_drop: "COLLECTION_RATE_DROP", realization_decline: "REALIZATION_DECLINE",
    benchmark_below: "BENCHMARK_BELOW", wip_buildup: "WIP_BUILDUP",
    client_concentration: "CLIENT_CONCENTRATION", profitability_risk: "PROFITABILITY_RISK",
    opportunity: "OPPORTUNITY",
  };
  return map[type] || "CUSTOM";
}

function mapPwcSeverity(severity: string): any {
  const map: Record<string, string> = { info: "INFO", warning: "WARNING", critical: "CRITICAL" };
  return map[severity?.toLowerCase()] || "WARNING";
}
