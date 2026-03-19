import { db } from "@/lib/db";

const API_BASE = "https://api.rippling.com/platform/api";

async function getConfig() {
  const integration = await db.hRIntegration.findFirst({ where: { provider: "RIPPLING" as any, isEnabled: true } });
  if (!integration?.accessToken) return null;
  return { accessToken: integration.accessToken, refreshToken: integration.refreshToken, companyId: integration.companyId };
}

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function apiCall(path: string, opts: RequestInit = {}) {
  const config = await getConfig();
  if (!config) throw new Error("Rippling integration not configured");
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: { ...headers(config.accessToken), ...(opts.headers || {}) } });
  if (!res.ok) throw new Error(`Rippling API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function testConnection() {
  try {
    await apiCall("/company");
    return { connected: true };
  } catch (err: any) {
    return { connected: false, error: err.message };
  }
}

export async function refreshAccessToken() {
  const config = await getConfig();
  if (!config?.refreshToken) throw new Error("No refresh token available");
  const res = await fetch(`${API_BASE}/oauth/token`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ grant_type: "refresh_token", refresh_token: config.refreshToken }),
  });
  const data = await res.json();
  await db.hRIntegration.updateMany({ where: { provider: "RIPPLING" as any }, data: { accessToken: data.access_token, refreshToken: data.refresh_token } });
  return data;
}

export async function getCompany() {
  return apiCall("/company");
}

export async function getEmployees() {
  return apiCall("/employees");
}

export async function getEmployee(employeeId: string) {
  return apiCall(`/employees/${employeeId}`);
}

export async function getEmployeeByEmail(email: string) {
  return apiCall(`/employees?work_email=${encodeURIComponent(email)}`);
}

export async function onboardEmployee(data: { firstName: string; lastName: string; email: string; startDate: string; department?: string; role?: string }) {
  return apiCall("/employees/onboard", { method: "POST", body: JSON.stringify(data) });
}

export async function offboardEmployee(employeeId: string, data: { lastDay: string; reason?: string }) {
  return apiCall(`/employees/${employeeId}/offboard`, { method: "POST", body: JSON.stringify(data) });
}

export async function updateEmployee(employeeId: string, data: Record<string, any>) {
  return apiCall(`/employees/${employeeId}`, { method: "PATCH", body: JSON.stringify(data) });
}

export async function getTimeOffRequests(params?: { status?: string; employeeId?: string }) {
  const query = new URLSearchParams(params as Record<string, string> || {}).toString();
  return apiCall(`/time-off/requests${query ? `?${query}` : ""}`);
}

export async function getTimeOffRequest(requestId: string) {
  return apiCall(`/time-off/requests/${requestId}`);
}

export async function approveTimeOff(requestId: string) {
  return apiCall(`/time-off/requests/${requestId}/approve`, { method: "POST" });
}

export async function denyTimeOff(requestId: string, reason?: string) {
  return apiCall(`/time-off/requests/${requestId}/deny`, { method: "POST", body: JSON.stringify({ reason }) });
}

export async function getTimeOffBalances(employeeId: string) {
  return apiCall(`/time-off/balances/${employeeId}`);
}

export async function getPayrollRuns(params?: { startDate?: string; endDate?: string }) {
  const query = new URLSearchParams(params as Record<string, string> || {}).toString();
  return apiCall(`/payroll/runs${query ? `?${query}` : ""}`);
}

export async function getPayrollRun(runId: string) {
  return apiCall(`/payroll/runs/${runId}`);
}

export async function getDepartments() {
  return apiCall("/departments");
}

export async function getOrgChart() {
  return apiCall("/org-chart");
}

export async function getCompanyHolidays() {
  return apiCall("/company/holidays");
}

export async function getTimeTracking(params?: { employeeId?: string; startDate?: string; endDate?: string }) {
  const query = new URLSearchParams(params as Record<string, string> || {}).toString();
  return apiCall(`/time-tracking${query ? `?${query}` : ""}`);
}

export async function processWebhook(payload: any) {
  const { event_type, data } = payload;
  const config = await getConfig();
  if (event_type?.startsWith("employee.")) {
    const emp = data.employee || data;
    if (event_type === "employee.created" || event_type === "employee.updated") {
      await db.firmEmployee.upsert({
        where: { id: emp.id },
        create: {
          id: emp.id, externalEmployeeId: emp.id, firstName: emp.first_name, lastName: emp.last_name,
          fullName: `${emp.first_name} ${emp.last_name}`, email: emp.work_email, role: emp.role as any,
          department: emp.department, employmentType: (emp.employment_type || "FULL_TIME") as any,
          startDate: new Date(emp.start_date), isActive: true, barNumber: emp.bar_number || null,
        },
        update: {
          firstName: emp.first_name, lastName: emp.last_name, fullName: `${emp.first_name} ${emp.last_name}`,
          email: emp.work_email, role: emp.role as any, department: emp.department,
          employmentType: (emp.employment_type || "FULL_TIME") as any,
        },
      });
    } else if (event_type === "employee.terminated") {
      await db.firmEmployee.update({ where: { id: emp.id }, data: { isActive: false, endDate: new Date(emp.termination_date || new Date()) } });
    }
    return { received: true, eventType: event_type, employeeId: emp.id };
  }

  if (event_type?.startsWith("time_off.")) {
    const req = data.request || data;
    const statusMap: Record<string, string> = { "time_off.requested": "PENDING", "time_off.approved": "APPROVED", "time_off.denied": "DENIED", "time_off.cancelled": "CANCELLED" };
    await db.timeOffRequest.upsert({
      where: { id: req.id },
      create: {
        id: req.id, employeeId: req.employee_id, requestType: (req.type || "VACATION") as any,
        startDate: new Date(req.start_date), endDate: new Date(req.end_date),
        status: (statusMap[event_type] || "PENDING") as any, reason: req.reason || null, totalDays: req.total_days || 1,
      },
      update: { status: (statusMap[event_type] || "PENDING") as any },
    });
    return { received: true, eventType: event_type, requestId: req.id };
  }

  if (event_type === "payroll.processed") {
    const run = data.payroll_run || data;
    await db.payrollSummary.create({
      data: {
        provider: "RIPPLING" as any, externalPayrollId: run.id, payPeriodStart: new Date(run.period_start),
        payPeriodEnd: new Date(run.period_end), payDate: new Date(run.pay_date || new Date()),
        totalGrossPay: run.total_gross || 0, totalNetPay: run.total_net || 0, totalTaxes: run.total_taxes || 0,
        totalDeductions: run.total_deductions || 0, totalBenefits: run.total_benefits || 0,
        employeeCount: run.employee_count || 0,
      },
    });
    return { received: true, eventType: event_type, employeeId: null };
  }

  return { received: true, eventType: event_type || "unknown", employeeId: null };
}
