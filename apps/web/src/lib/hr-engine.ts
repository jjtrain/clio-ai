import { db } from "@/lib/db";
import * as rippling from "@/lib/integrations/rippling";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

async function aiComplete(prompt: string): Promise<string> {
  const res = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });
  return res.content[0].type === "text" ? res.content[0].text : "";
}

export async function syncEmployees() {
  const employees = await rippling.getEmployees();
  let created = 0, updated = 0;
  for (const emp of employees) {
    const existing = await db.firmEmployee.findFirst({ where: { externalEmployeeId: emp.id } });
    const data = {
      externalEmployeeId: emp.id, firstName: emp.first_name, lastName: emp.last_name,
      email: emp.work_email, role: emp.role as any, department: emp.department,
      employmentType: (emp.employment_type || "FULL_TIME") as any,
      startDate: new Date(emp.start_date), isActive: emp.status === "active",
      barNumber: emp.bar_number || null,
    };
    if (existing) {
      await db.firmEmployee.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.firmEmployee.create({ data: { ...data, fullName: `${emp.first_name} ${emp.last_name}` } });
      created++;
    }
  }
  return { synced: employees.length, created, updated };
}

export async function syncTimeOff() {
  const requests = await rippling.getTimeOffRequests();
  let created = 0, updated = 0;
  for (const req of requests) {
    const existing = await db.timeOffRequest.findFirst({ where: { id: req.id } });
    const data = {
      employeeId: req.employee_id, requestType: (req.type || "VACATION") as any, startDate: new Date(req.start_date),
      endDate: new Date(req.end_date), status: req.status as any, reason: req.reason || null, totalDays: req.total_days || 1,
    };
    if (existing) {
      await db.timeOffRequest.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await db.timeOffRequest.create({ data: { ...data, id: req.id } });
      created++;
    }
  }
  return { synced: requests.length, created, updated };
}

export async function handleNewHire(data: { firstName: string; lastName: string; email: string; startDate: string; role: string; department: string }) {
  const employee = await db.firmEmployee.create({
    data: {
      firstName: data.firstName, lastName: data.lastName, fullName: `${data.firstName} ${data.lastName}`,
      email: data.email, role: data.role as any, department: data.department,
      employmentType: "FULL_TIME" as any, startDate: new Date(data.startDate), isActive: true,
    },
  });
  // Create onboarding tasks (linked to employee's user if available)
  const tasks = ["Set up workstation and accounts", "Complete I-9 verification", "Assign mentor/buddy", "Schedule orientation meetings", "Set up billing profile", "Bar admission verification"];
  for (const title of tasks) {
    await db.task.create({ data: { title, status: "NOT_STARTED" as any, dueDate: new Date(data.startDate), assigneeId: employee.userId } });
  }
  return employee;
}

export async function handleOffboarding(employeeId: string, endDate: Date) {
  await db.firmEmployee.update({ where: { id: employeeId }, data: { isActive: false, endDate } });
  const employee = await db.firmEmployee.findUnique({ where: { id: employeeId } });
  // Find matters with time entries by this user as a proxy for assignment
  const timeEntries = employee?.userId ? await db.timeEntry.findMany({ where: { userId: employee.userId }, select: { matterId: true }, distinct: ["matterId"] }) : [];
  const matterIds = timeEntries.map(t => t.matterId);
  const matters = matterIds.length > 0 ? await db.matter.findMany({ where: { id: { in: matterIds }, status: "OPEN" as any } }) : [];
  const tasks = employee?.userId ? await db.task.findMany({ where: { assigneeId: employee.userId, status: { not: "COMPLETED" as any } } }) : [];
  const activeAttorneys = await db.firmEmployee.findMany({ where: { isActive: true, role: "ATTORNEY" as any } });

  const suggestion = await aiComplete(
    `Attorney ${employee?.firstName} ${employee?.lastName} is leaving. They have ${matters.length} active matters and ${tasks.length} pending tasks. ` +
    `Available attorneys: ${activeAttorneys.map(a => `${a.firstName} ${a.lastName} (${a.department})`).join(", ")}. ` +
    `Suggest reassignments considering department and workload balance. Return JSON with matterReassignments and taskReassignments arrays.`
  );

  return { employee, matters: matters.length, tasks: tasks.length, endDate, reassignmentPlan: suggestion };
}

export async function calculateUtilization(employeeId: string, period: Date, periodType: "WEEKLY" | "MONTHLY") {
  const employee = await db.firmEmployee.findUnique({ where: { id: employeeId } });
  if (!employee?.userId) throw new Error("Employee not linked to user");

  const start = new Date(period);
  const end = new Date(period);
  if (periodType === "WEEKLY") end.setDate(end.getDate() + 7);
  else end.setMonth(end.getMonth() + 1);

  const entries = await db.timeEntry.findMany({ where: { userId: employee.userId, date: { gte: start, lt: end } } });
  const billable = entries.filter(e => e.billable).reduce((s, e) => s + Number(e.duration), 0);
  const nonBillable = entries.filter(e => !e.billable).reduce((s, e) => s + Number(e.duration), 0);
  const total = billable + nonBillable;
  const utilization = total > 0 ? (billable / total) * 100 : 0;
  const revenue = entries.filter(e => e.billable).reduce((s, e) => s + (Number(e.duration) / 60) * Number(e.rate || 0), 0);

  const periodStr = periodType === "MONTHLY"
    ? `${start.getFullYear()}-${(start.getMonth() + 1).toString().padStart(2, "0")}`
    : `${start.getFullYear()}-W${Math.ceil(start.getDate() / 7)}`;
  const billableHours = billable / 60;
  const nonBillableHours = nonBillable / 60;
  const totalHoursWorked = total / 60;

  const record = await db.utilizationRecord.create({
    data: {
      employeeId, period: periodStr, periodType: periodType as any,
      billableHours, nonBillableHours, totalHoursWorked,
      utilizationRate: utilization, revenue,
    },
  });
  return { ...record, billableHours, nonBillableHours, utilization: Math.round(utilization * 100) / 100, revenue: Number(revenue) };
}

export async function calculateAllUtilization(period: Date, periodType: "WEEKLY" | "MONTHLY") {
  const attorneys = await db.firmEmployee.findMany({ where: { isActive: true, role: "ATTORNEY" as any } });
  const results = [];
  for (const atty of attorneys) {
    try {
      results.push(await calculateUtilization(atty.id, period, periodType));
    } catch { /* skip unlinked employees */ }
  }
  const avgUtilization = results.length > 0 ? results.reduce((s, r) => s + r.utilization, 0) / results.length : 0;
  const totalRevenue = results.reduce((s, r) => s + r.revenue, 0);
  return { period, periodType, attorneys: results.length, results, avgUtilization: Math.round(avgUtilization * 100) / 100, totalRevenue };
}

export async function generateUtilizationReport(dateRange: { start: Date; end: Date }) {
  const employees = await db.firmEmployee.findMany({ where: { isActive: true, role: "ATTORNEY" as any } });
  const startStr = `${dateRange.start.getFullYear()}-${(dateRange.start.getMonth() + 1).toString().padStart(2, "0")}`;
  const endStr = `${dateRange.end.getFullYear()}-${(dateRange.end.getMonth() + 1).toString().padStart(2, "0")}`;
  const records = await db.utilizationRecord.findMany({ where: { period: { gte: startStr, lte: endStr } } });
  const summary = {
    totalAttorneys: employees.length, avgUtilization: records.length > 0 ? records.reduce((s, r) => s + Number(r.utilizationRate), 0) / records.length : 0,
    totalRevenue: records.reduce((s, r) => s + Number(r.revenue), 0), topPerformers: [...records].sort((a, b) => Number(b.utilizationRate) - Number(a.utilizationRate)).slice(0, 5),
  };
  const insights = await aiComplete(
    `Analyze this law firm utilization data: ${JSON.stringify(summary)}. Provide insights on trends, areas of concern, and recommendations for improving firm profitability. Keep it concise.`
  );
  return { ...summary, insights, dateRange };
}

export async function calculateProfitabilityPerEmployee(employeeId: string, dateRange: { start: Date; end: Date }) {
  const employee = await db.firmEmployee.findUnique({ where: { id: employeeId } });
  if (!employee?.userId) throw new Error("Employee not linked to user");

  const entries = await db.timeEntry.findMany({ where: { userId: employee.userId, date: { gte: dateRange.start, lte: dateRange.end }, billable: true } });
  const revenue = entries.reduce((s, e) => s + (Number(e.duration) / 60) * Number(e.rate || 0), 0);
  const payroll = await db.payrollSummary.findMany({ where: { payPeriodStart: { gte: dateRange.start }, payPeriodEnd: { lte: dateRange.end } } });
  const estimatedCost = payroll.length > 0 ? payroll.reduce((s, p) => s + Number(p.totalGrossPay), 0) / (payroll[0] as any).employeeCount : 0;

  return { employeeId, employee: `${employee.firstName} ${employee.lastName}`, revenue, estimatedCost, profit: revenue - estimatedCost, margin: revenue > 0 ? ((revenue - estimatedCost) / revenue) * 100 : 0, dateRange };
}

export async function handleTimeOffApproval(requestId: string) {
  const request = await db.timeOffRequest.update({ where: { id: requestId }, data: { status: "APPROVED" as any } });
  const employee = await db.firmEmployee.findUnique({ where: { id: request.employeeId } });
  if (!employee?.userId) return { request, conflicts: [], calendarBlocked: false };

  const conflicts = await db.task.findMany({
    where: { assigneeId: employee.userId, dueDate: { gte: request.startDate, lte: request.endDate }, status: { not: "COMPLETED" as any } },
  });

  await db.calendarEvent.create({
    data: {
      title: `${employee.firstName} ${employee.lastName} - Time Off`,
      startTime: request.startDate, endTime: request.endDate, allDay: true,
    },
  });

  return { request, conflicts, calendarBlocked: true };
}

export async function suggestCoverage(employeeId: string, startDate: Date, endDate: Date) {
  const employee = await db.firmEmployee.findUnique({ where: { id: employeeId } });
  if (!employee?.userId) throw new Error("Employee not linked to user");

  const timeEntries = await db.timeEntry.findMany({ where: { userId: employee.userId }, select: { matterId: true }, distinct: ["matterId"] });
  const matterIds = timeEntries.map(t => t.matterId);
  const matters = matterIds.length > 0 ? await db.matter.findMany({ where: { id: { in: matterIds }, status: "OPEN" as any }, select: { id: true, name: true, clientId: true } }) : [];
  const available = await db.firmEmployee.findMany({ where: { isActive: true, role: "ATTORNEY" as any, id: { not: employeeId } } });

  const suggestion = await aiComplete(
    `Attorney ${employee.firstName} ${employee.lastName} (${employee.department}) will be out ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}. ` +
    `Active matters: ${matters.map(m => m.name).join(", ")}. ` +
    `Available attorneys: ${available.map(a => `${a.firstName} ${a.lastName} (${a.department})`).join(", ")}. ` +
    `Suggest coverage assignments considering expertise and department. Return JSON with coverageAssignments array.`
  );
  return { employee: `${employee.firstName} ${employee.lastName}`, startDate, endDate, matters: matters.length, suggestion };
}

export async function getHeadcount() {
  const employees = await db.firmEmployee.findMany({ where: { isActive: true } });
  const byRole: Record<string, number> = {};
  const byDepartment: Record<string, number> = {};
  for (const emp of employees) {
    byRole[emp.role || "UNKNOWN"] = (byRole[emp.role || "UNKNOWN"] || 0) + 1;
    byDepartment[emp.department || "UNKNOWN"] = (byDepartment[emp.department || "UNKNOWN"] || 0) + 1;
  }
  return { total: employees.length, byRole, byDepartment };
}

export async function getCLETracking(employeeId?: string) {
  const where = employeeId ? { id: employeeId, isActive: true } : { isActive: true, role: "ATTORNEY" as any };
  const attorneys = await db.firmEmployee.findMany({ where });
  const results = attorneys.map(a => ({
    id: a.id, name: `${a.firstName} ${a.lastName}`, department: a.department,
    cleCredits: (a as any).cleCredits || 0, cleRequired: (a as any).cleRequired || 12,
    cleDeadline: (a as any).cleDeadline || null,
    compliant: ((a as any).cleCredits || 0) >= ((a as any).cleRequired || 12),
  }));
  return { attorneys: results, compliant: results.filter(r => r.compliant).length, nonCompliant: results.filter(r => !r.compliant).length };
}

export async function getWorkloadDistribution() {
  const attorneys = await db.firmEmployee.findMany({ where: { isActive: true, role: "ATTORNEY" as any } });
  const distribution = [];
  for (const atty of attorneys) {
    if (!atty.userId) continue;
    const matterCount = await db.timeEntry.groupBy({ by: ["matterId"], where: { userId: atty.userId } }).then(g => g.length);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const entries = await db.timeEntry.findMany({ where: { userId: atty.userId, date: { gte: monthStart } } });
    const totalHours = entries.reduce((s, e) => s + Number(e.duration), 0) / 60;
    distribution.push({ id: atty.id, name: `${atty.firstName} ${atty.lastName}`, department: atty.department, activeMatters: matterCount, monthlyHours: Math.round(totalHours * 100) / 100 });
  }
  return distribution.sort((a, b) => b.monthlyHours - a.monthlyHours);
}

export async function getFirmCalendar(dateRange: { start: Date; end: Date }) {
  const timeOff = await db.timeOffRequest.findMany({ where: { status: "APPROVED" as any, startDate: { lte: dateRange.end }, endDate: { gte: dateRange.start } }, include: { employee: true } as any });
  const holidays = await db.firmHoliday.findMany({ where: { date: { gte: dateRange.start, lte: dateRange.end } } });
  const employees = await db.firmEmployee.findMany({ where: { isActive: true } });

  const days: Record<string, { date: string; out: string[]; holidays: string[]; inCount: number }> = {};
  for (let d = new Date(dateRange.start); d <= dateRange.end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split("T")[0];
    const outToday = (timeOff as any[]).filter(t => new Date(t.startDate) <= d && new Date(t.endDate) >= d).map(t => `${t.employee?.firstName} ${t.employee?.lastName}`);
    const holidayToday = holidays.filter(h => new Date(h.date).toISOString().split("T")[0] === key).map(h => (h as any).name);
    days[key] = { date: key, out: outToday, holidays: holidayToday, inCount: employees.length - outToday.length };
  }
  return { dateRange, days: Object.values(days), totalEmployees: employees.length };
}

export async function generateFirmDirectory() {
  const employees = await db.firmEmployee.findMany({ where: { isActive: true }, orderBy: [{ department: "asc" }, { lastName: "asc" }] });
  const byDepartment: Record<string, Array<{ id: string; name: string; role: string; email: string; barNumber: string | null }>> = {};
  for (const emp of employees) {
    const dept = emp.department || "General";
    if (!byDepartment[dept]) byDepartment[dept] = [];
    byDepartment[dept].push({ id: emp.id, name: `${emp.firstName} ${emp.lastName}`, role: emp.role || "STAFF", email: emp.email, barNumber: emp.barNumber || null });
  }
  return { departments: Object.keys(byDepartment).sort(), directory: byDepartment, totalEmployees: employees.length };
}
