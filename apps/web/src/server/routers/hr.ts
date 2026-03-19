import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as rippling from "@/lib/integrations/rippling";
import * as engine from "@/lib/hr-engine";

export const hrRouter = router({
  // ── Settings ──────────────────────────────────────────────────────────
  "settings.get": publicProcedure
    .input(z.object({ provider: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return db.hRIntegration.findFirst({ where: input?.provider ? { provider: input.provider as any } : {} });
    }),

  "settings.update": publicProcedure
    .input(z.object({ provider: z.string(), apiKey: z.string(), displayName: z.string().optional(), isEnabled: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      return db.hRIntegration.upsert({
        where: { provider: input.provider as any },
        create: { provider: input.provider as any, displayName: input.displayName ?? input.provider, apiKey: input.apiKey, isEnabled: input.isEnabled ?? true },
        update: { apiKey: input.apiKey, isEnabled: input.isEnabled },
      });
    }),

  "settings.test": publicProcedure
    .input(z.object({ provider: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      const settings = await db.hRIntegration.findFirstOrThrow({ where: input?.provider ? { provider: input.provider as any } : {} });
      return rippling.testConnection();
    }),

  "settings.syncNow": publicProcedure
    .input(z.object({}).optional())
    .mutation(async () => {
      const employees = await engine.syncEmployees();
      const timeOff = await engine.syncTimeOff();
      return { employees, timeOff };
    }),

  // ── Employees ─────────────────────────────────────────────────────────
  "employees.list": publicProcedure
    .input(z.object({ role: z.string().optional(), department: z.string().optional(), isActive: z.boolean().optional(), search: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.role) where.role = input.role;
      if (input?.department) where.department = input.department;
      if (input?.isActive !== undefined) where.isActive = input.isActive;
      if (input?.search) where.OR = [{ firstName: { contains: input.search, mode: "insensitive" } }, { lastName: { contains: input.search, mode: "insensitive" } }];
      return db.firmEmployee.findMany({
        where,
        orderBy: { lastName: "asc" },
      });
    }),

  "employees.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.firmEmployee.findUniqueOrThrow({
        where: { id: input.id },
        include: { timeOffRequests: true, timeOffBalances: true, utilizationRecords: true },
      });
    }),

  "employees.create": publicProcedure
    .input(z.object({ firstName: z.string(), lastName: z.string(), email: z.string(), role: z.string(), department: z.string().optional(), startDate: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.firmEmployee.create({ data: { firstName: input.firstName, lastName: input.lastName, fullName: `${input.firstName} ${input.lastName}`, email: input.email, role: input.role as any, department: input.department, startDate: input.startDate ? new Date(input.startDate) : undefined, isActive: true } });
    }),

  "employees.update": publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.unknown()) }))
    .mutation(async ({ input }) => {
      return db.firmEmployee.update({ where: { id: input.id }, data: input.data as any });
    }),

  "employees.deactivate": publicProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      return engine.handleOffboarding(input.id, new Date());
    }),

  "employees.getDirectory": publicProcedure
    .input(z.object({ firmId: z.string().optional() }).optional())
    .query(async () => {
      return engine.generateFirmDirectory();
    }),

  "employees.getOrgChart": publicProcedure
    .input(z.object({ firmId: z.string().optional(), useRippling: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      if (input?.useRippling) return rippling.getOrgChart();
      const employees = await db.firmEmployee.findMany({ where: { isActive: true } });
      return employees.map((e: any) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, reportsTo: e.reportingTo }));
    }),

  "employees.syncFromRippling": publicProcedure
    .input(z.object({}).optional())
    .mutation(async () => {
      return engine.syncEmployees();
    }),

  "employees.mapToUser": publicProcedure
    .input(z.object({ employeeId: z.string(), userId: z.string() }))
    .mutation(async ({ input }) => {
      return db.firmEmployee.update({ where: { id: input.employeeId }, data: { userId: input.userId } });
    }),

  // ── Utilization ───────────────────────────────────────────────────────
  "utilization.getForEmployee": publicProcedure
    .input(z.object({ employeeId: z.string(), period: z.string().optional(), periodType: z.string().optional() }))
    .query(async ({ input }) => {
      const period = input.period ? new Date(input.period) : new Date();
      return engine.calculateUtilization(input.employeeId, period, (input.periodType || "MONTHLY") as any);
    }),

  "utilization.getForFirm": publicProcedure
    .input(z.object({ period: z.string().optional(), periodType: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const now = new Date();
      const periodStr = input?.period || "month";
      let periodDate = now;
      if (periodStr.match(/^\d{4}-\d{2}$/)) periodDate = new Date(periodStr + "-01");
      const raw = await engine.calculateAllUtilization(periodDate, (input?.periodType || "MONTHLY") as any);
      const totalBillableHours = raw.results.reduce((s: number, r: any) => s + (r.billableHours ?? 0), 0);
      return {
        ...raw,
        firmUtilizationPercent: raw.avgUtilization,
        totalBillableHours,
        avgHoursPerAttorney: raw.attorneys > 0 ? totalBillableHours / raw.attorneys : 0,
      };
    }),

  "utilization.getReport": publicProcedure
    .input(z.object({ firmId: z.string().optional(), startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      return engine.generateUtilizationReport({ start: new Date(input.startDate), end: new Date(input.endDate) });
    }),

  "utilization.getHistory": publicProcedure
    .input(z.object({ employeeId: z.string(), limit: z.number().optional() }))
    .query(async ({ input }) => {
      return db.utilizationRecord.findMany({
        where: { employeeId: input.employeeId },
        orderBy: { period: "desc" },
        take: input.limit ?? 12,
      });
    }),

  "utilization.getProfitability": publicProcedure
    .input(z.object({ employeeId: z.string(), startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      return engine.calculateProfitabilityPerEmployee(input.employeeId, { start: new Date(input.startDate), end: new Date(input.endDate) });
    }),

  "utilization.getWorkload": publicProcedure
    .input(z.object({ firmId: z.string().optional() }))
    .query(async () => {
      return engine.getWorkloadDistribution();
    }),

  "utilization.getLeaderboard": publicProcedure
    .input(z.object({ period: z.string().optional() }))
    .query(async ({ input }) => {
      const now = new Date();
      const currentPeriod = input?.period === "year"
        ? `${now.getFullYear()}`
        : input?.period === "quarter"
          ? `${now.getFullYear()}-Q${Math.ceil((now.getMonth() + 1) / 3)}`
          : `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
      return db.utilizationRecord.findMany({
        where: { period: currentPeriod },
        orderBy: { billableHours: "desc" },
        take: 20,
        include: { employee: true },
      });
    }),

  // ── Time Off ──────────────────────────────────────────────────────────
  "timeOff.list": publicProcedure
    .input(z.object({ status: z.string().optional(), employeeId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return db.timeOffRequest.findMany({
        where: { ...(input?.status ? { status: input.status as any } : {}), ...(input?.employeeId ? { employeeId: input.employeeId } : {}) },
        orderBy: { startDate: "desc" },
      });
    }),

  "timeOff.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.timeOffRequest.findUniqueOrThrow({ where: { id: input.id } });
    }),

  "timeOff.create": publicProcedure
    .input(z.object({ employeeId: z.string(), type: z.string(), startDate: z.string(), endDate: z.string(), reason: z.string().optional(), notes: z.string().optional() }).passthrough())
    .mutation(async ({ input }) => {
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
      return db.timeOffRequest.create({ data: { employeeId: input.employeeId, requestType: input.type as any, startDate: start, endDate: end, totalDays: days, reason: input.reason, notes: input.notes, status: "PENDING" as any } });
    }),

  "timeOff.approve": publicProcedure
    .input(z.object({ requestId: z.string(), approverId: z.string().optional() }))
    .mutation(async ({ input }) => {
      return engine.handleTimeOffApproval(input.requestId);
    }),

  "timeOff.deny": publicProcedure
    .input(z.object({ requestId: z.string(), approverId: z.string().optional(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.timeOffRequest.update({
        where: { id: input.requestId },
        data: { status: "DENIED" as any, deniedReason: input.reason },
      });
    }),

  "timeOff.cancel": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      return db.timeOffRequest.update({ where: { id: input.id }, data: { status: "cancelled" as any } });
    }),

  "timeOff.getBalances": publicProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async ({ input }) => {
      return db.timeOffBalance.findMany({ where: { employeeId: input.employeeId } });
    }),

  "timeOff.getConflicts": publicProcedure
    .input(z.object({ firmId: z.string().optional(), startDate: z.string().optional(), endDate: z.string().optional(), employeeId: z.string().optional() }))
    .query(async ({ input }) => {
      // TODO: implement conflict detection
      return { conflicts: [], hasConflicts: false, inOffice: 0, outThisWeek: 0 };
    }),

  "timeOff.suggestCoverage": publicProcedure
    .input(z.object({ requestId: z.string() }))
    .query(async ({ input }) => {
      const request = await db.timeOffRequest.findUniqueOrThrow({ where: { id: input.requestId } });
      return engine.suggestCoverage(request.employeeId, request.startDate, request.endDate);
    }),

  "timeOff.getFirmCalendar": publicProcedure
    .input(z.object({ firmId: z.string().optional(), month: z.number().optional(), year: z.number().optional() }))
    .query(async ({ input }) => {
      const now = new Date();
      const month = input.month ?? now.getMonth();
      const year = input.year ?? now.getFullYear();
      const start = new Date(year, month, 1);
      const end = new Date(year, month + 1, 0);
      return engine.getFirmCalendar({ start, end });
    }),

  "timeOff.getHolidays": publicProcedure
    .input(z.object({ firmId: z.string().optional(), year: z.number().optional() }))
    .query(async ({ input }) => {
      return db.firmHoliday.findMany({
        where: { ...(input.firmId ? { firmId: input.firmId } : {}), ...(input.year ? { date: { gte: new Date(input.year, 0, 1), lt: new Date(input.year + 1, 0, 1) } } : {}) },
        orderBy: { date: "asc" },
      });
    }),

  // ── CLE ───────────────────────────────────────────────────────────────
  "cle.getTracking": publicProcedure
    .input(z.object({ employeeId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return engine.getCLETracking(input?.employeeId);
    }),

  "cle.addCredits": publicProcedure
    .input(z.object({ employeeId: z.string(), credits: z.number(), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      const emp = await db.firmEmployee.findUniqueOrThrow({ where: { id: input.employeeId } });
      return db.firmEmployee.update({
        where: { id: input.employeeId },
        data: { cleCreditsEarned: ((emp as any).cleCreditsEarned ?? 0) + input.credits },
      });
    }),

  "cle.getDeadlines": publicProcedure
    .input(z.object({ withinDays: z.number().optional() }).optional())
    .query(async ({ input }) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + (input?.withinDays ?? 90));
      return db.firmEmployee.findMany({
        where: { isActive: true, cleDeadline: { lte: cutoff } },
        orderBy: { cleDeadline: "asc" },
      });
    }),

  // ── Onboarding ────────────────────────────────────────────────────────
  "onboarding.getChecklist": publicProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async ({ input }) => {
      // TODO: implement checklist retrieval
      return { employeeId: input.employeeId, items: [], completedCount: 0, totalCount: 0 };
    }),

  "onboarding.updateChecklistItem": publicProcedure
    .input(z.object({ employeeId: z.string(), itemId: z.string(), completed: z.boolean() }))
    .mutation(async ({ input }) => {
      // TODO: implement checklist item update
      return { employeeId: input.employeeId, itemId: input.itemId, completed: input.completed };
    }),

  // ── Offboarding ───────────────────────────────────────────────────────
  "offboarding.getPlan": publicProcedure
    .input(z.object({ employeeId: z.string() }))
    .query(async ({ input }) => {
      // Return offboarding plan without executing
      const employee = await db.firmEmployee.findUniqueOrThrow({ where: { id: input.employeeId } });
      return { employeeId: input.employeeId, employee, plan: [] };
    }),

  "offboarding.reassignMatter": publicProcedure
    .input(z.object({ matterId: z.string(), fromEmployeeId: z.string(), toEmployeeId: z.string() }))
    .mutation(async ({ input }) => {
      // TODO: implement matter reassignment
      return { matterId: input.matterId, reassignedTo: input.toEmployeeId };
    }),

  "offboarding.reassignTask": publicProcedure
    .input(z.object({ taskId: z.string(), fromEmployeeId: z.string(), toEmployeeId: z.string() }))
    .mutation(async ({ input }) => {
      // TODO: implement task reassignment
      return { taskId: input.taskId, reassignedTo: input.toEmployeeId };
    }),

  "offboarding.executeReassignment": publicProcedure
    .input(z.object({ employeeId: z.string(), reassignments: z.array(z.object({ type: z.string(), id: z.string(), toEmployeeId: z.string() })) }))
    .mutation(async ({ input }) => {
      // TODO: implement bulk reassignment
      return { employeeId: input.employeeId, reassigned: input.reassignments.length };
    }),

  // ── Payroll ───────────────────────────────────────────────────────────
  "payroll.getSummaries": publicProcedure
    .input(z.object({ limit: z.number().optional() }).optional())
    .query(async ({ input }) => {
      return db.payrollSummary.findMany({
        orderBy: { payPeriodEnd: "desc" },
        take: input?.limit ?? 12,
      });
    }),

  "payroll.getSummary": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return db.payrollSummary.findUniqueOrThrow({ where: { id: input.id } });
    }),

  "payroll.getCostAnalysis": publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      // TODO: implement cost analysis
      return { period: { start: input.startDate, end: input.endDate }, totalCost: 0, breakdown: [] };
    }),

  // ── Reports ───────────────────────────────────────────────────────────
  "reports.headcount": publicProcedure
    .input(z.object({ firmId: z.string().optional() }).optional())
    .query(async () => {
      return engine.getHeadcount();
    }),

  "reports.utilization": publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      return engine.generateUtilizationReport({ start: new Date(input.startDate), end: new Date(input.endDate) });
    }),

  "reports.profitability": publicProcedure
    .input(z.object({ employeeId: z.string(), startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      return engine.calculateProfitabilityPerEmployee(input.employeeId, { start: new Date(input.startDate), end: new Date(input.endDate) });
    }),

  "reports.workload": publicProcedure
    .input(z.object({ firmId: z.string().optional() }).optional())
    .query(async () => {
      return engine.getWorkloadDistribution();
    }),

  "reports.timeOff": publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      const requests = await db.timeOffRequest.findMany({
        where: { startDate: { gte: new Date(input.startDate) }, endDate: { lte: new Date(input.endDate) } },
      });
      const byStatus = requests.reduce((acc: any, r: any) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc; }, {});
      return { total: requests.length, byStatus };
    }),

  "reports.cle": publicProcedure
    .input(z.object({ employeeId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return engine.getCLETracking(input?.employeeId);
    }),

  "reports.turnover": publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ input }) => {
      const terminated = await db.firmEmployee.count({
        where: { isActive: false, updatedAt: { gte: new Date(input.startDate), lte: new Date(input.endDate) } },
      });
      const total = await db.firmEmployee.count({});
      return { terminated, total, turnoverRate: total > 0 ? terminated / total : 0 };
    }),

  "reports.compensation": publicProcedure
    .input(z.object({ firmId: z.string().optional() }).optional())
    .query(async () => {
      // TODO: implement compensation report
      return { averageSalary: 0, medianSalary: 0, byDepartment: [] };
    }),

  "reports.directory": publicProcedure
    .input(z.object({ firmId: z.string().optional() }).optional())
    .query(async () => {
      return engine.generateFirmDirectory();
    }),

  "reports.export": publicProcedure
    .input(z.object({ reportType: z.string(), format: z.enum(["csv", "pdf", "xlsx"]).optional() }))
    .query(async ({ input }) => {
      // TODO: implement report export
      return { reportType: input.reportType, format: input.format ?? "csv", url: null };
    }),
});
