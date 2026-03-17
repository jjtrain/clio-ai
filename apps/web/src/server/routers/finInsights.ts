import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import * as pwc from "@/lib/integrations/pwc-insights";
import * as rainmaker from "@/lib/integrations/rainmaker";
import * as engine from "@/lib/financial-insights-engine";

const FIN_PROVIDER = ["PWC_INSIGHTS", "RAINMAKER"] as const;
const PERIOD_TYPE = ["MONTHLY", "QUARTERLY", "ANNUAL"] as const;
const FORECAST_TYPE = ["REVENUE", "EXPENSE", "CASH_FLOW", "PROFITABILITY", "GROWTH"] as const;
const FORECAST_GRAN = ["MONTHLY", "QUARTERLY"] as const;
const BUDGET_TYPE = ["REVENUE", "EXPENSE", "PROFIT", "HOURS", "MATTERS", "COLLECTIONS"] as const;
const BUDGET_STATUS = ["ON_TRACK", "AT_RISK", "BEHIND", "EXCEEDED", "COMPLETED"] as const;
const ALERT_TYPE = ["REVENUE_DECLINE", "EXPENSE_SPIKE", "AR_AGING", "CASH_FLOW_WARNING", "UTILIZATION_DROP", "COLLECTION_RATE_DROP", "REALIZATION_DECLINE", "BENCHMARK_BELOW", "WIP_BUILDUP", "CLIENT_CONCENTRATION", "PROFITABILITY_RISK", "OPPORTUNITY", "CUSTOM"] as const;
const SEVERITY = ["INFO", "WARNING", "CRITICAL"] as const;

export const finInsightsRouter = router({
  // ─── Settings ──────────────────────────────────────────────
  "settings.list": publicProcedure.query(async ({ ctx }) => {
    return ctx.db.finInsightsIntegration.findMany();
  }),

  "settings.get": publicProcedure
    .input(z.object({ provider: z.enum(FIN_PROVIDER) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.finInsightsIntegration.findUnique({ where: { provider: input.provider } });
    }),

  "settings.update": publicProcedure
    .input(z.object({
      provider: z.enum(FIN_PROVIDER),
      displayName: z.string().optional(),
      apiKey: z.string().nullable().optional(),
      apiSecret: z.string().nullable().optional(),
      baseUrl: z.string().nullable().optional(),
      accountId: z.string().nullable().optional(),
      firmId: z.string().nullable().optional(),
      isEnabled: z.boolean().optional(),
      autoSyncAccounting: z.boolean().optional(),
      syncFrequency: z.string().optional(),
      reportingPeriod: z.string().optional(),
      fiscalYearStart: z.number().optional(),
      benchmarkIndustry: z.string().optional(),
      benchmarkFirmSize: z.string().optional(),
      settings: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { provider, ...data } = input;
      return ctx.db.finInsightsIntegration.upsert({
        where: { provider },
        create: { provider, displayName: data.displayName || provider, ...data },
        update: data,
      });
    }),

  "settings.test": publicProcedure
    .input(z.object({ provider: z.enum(FIN_PROVIDER) }))
    .mutation(async ({ input }) => {
      if (input.provider === "PWC_INSIGHTS") return pwc.testConnection();
      return rainmaker.testConnection();
    }),

  // ─── Snapshots ─────────────────────────────────────────────
  "snapshots.getCurrent": publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const period = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    let snap = await ctx.db.financialSnapshot.findFirst({ where: { period, periodType: "MONTHLY" }, orderBy: { createdAt: "desc" } });
    if (!snap) snap = await engine.generateSnapshot(period, "MONTHLY");
    return snap;
  }),

  "snapshots.get": publicProcedure
    .input(z.object({ period: z.string(), periodType: z.enum(PERIOD_TYPE) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.financialSnapshot.findFirst({ where: { period: input.period, periodType: input.periodType }, orderBy: { createdAt: "desc" } });
    }),

  "snapshots.generate": publicProcedure
    .input(z.object({ period: z.string(), periodType: z.enum(PERIOD_TYPE) }))
    .mutation(async ({ input }) => {
      return engine.generateSnapshot(input.period, input.periodType);
    }),

  "snapshots.generateYear": publicProcedure
    .input(z.object({ year: z.number() }))
    .mutation(async ({ input }) => {
      return engine.generateAllSnapshots(input.year);
    }),

  "snapshots.trend": publicProcedure
    .input(z.object({ metric: z.string(), periods: z.number().default(12) }))
    .query(async ({ ctx, input }) => {
      const snapshots = await ctx.db.financialSnapshot.findMany({
        where: { periodType: "MONTHLY" },
        orderBy: { periodStart: "desc" },
        take: input.periods,
      });
      return snapshots.reverse().map((s: any) => ({ period: s.period, value: Number(s[input.metric] || 0) }));
    }),

  "snapshots.compare": publicProcedure
    .input(z.object({ period1: z.string(), period2: z.string() }))
    .query(async ({ ctx, input }) => {
      const s1 = await ctx.db.financialSnapshot.findFirst({ where: { period: input.period1 }, orderBy: { createdAt: "desc" } });
      const s2 = await ctx.db.financialSnapshot.findFirst({ where: { period: input.period2 }, orderBy: { createdAt: "desc" } });
      return { period1: s1, period2: s2 };
    }),

  // ─── PwC InsightsOfficer ───────────────────────────────────
  "pwc.pushData": publicProcedure
    .input(z.object({ period: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const payments = await ctx.db.payment.findMany({ where: { paymentDate: { gte: new Date(input.period + "-01") } }, include: { invoice: true } });
      const revenue = payments.reduce((s, p) => s + Number(p.amount), 0);
      const expenses = await ctx.db.expense.findMany({ where: { date: { gte: new Date(input.period + "-01") } } });
      const invoices = await ctx.db.invoice.findMany({ where: { createdAt: { gte: new Date(input.period + "-01") } } });
      const timeEntries = await ctx.db.timeEntry.findMany({ where: { date: { gte: new Date(input.period + "-01") } } });
      const trustAccounts = await ctx.db.trustAccount.findMany();

      return pwc.pushFinancialData({
        period: input.period,
        revenue,
        expenses: expenses.map((e) => ({ category: e.category, amount: Number(e.amount) })),
        invoices: invoices.map((i) => ({ id: i.id, amount: Number(i.total), paidAmount: Number(i.amountPaid || 0), dueDate: i.dueDate.toISOString(), status: i.status })),
        timeEntries: timeEntries.map((t) => ({ hours: Number(t.duration) / 60, billingRate: Number(t.rate || 0), matterId: t.matterId, billed: t.invoiceLineItemId != null })),
        trustBalances: trustAccounts.map((t) => ({ account: t.name, balance: Number(t.bankBalance) })),
      });
    }),

  "pwc.getInsights": publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ input }) => pwc.getInsightsReport(input.period)),

  "pwc.getBookkeeping": publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ input }) => pwc.getBookkeepingReview(input.period)),

  "pwc.getBenchmarks": publicProcedure
    .input(z.object({ metrics: z.array(z.string()) }))
    .query(async ({ input }) => pwc.getBenchmarks({ metrics: input.metrics })),

  "pwc.getCashFlowForecast": publicProcedure
    .input(z.object({ months: z.number().default(6) }))
    .query(async ({ input }) => pwc.getCashFlowForecast(input.months)),

  "pwc.getRevenueForecast": publicProcedure
    .input(z.object({ months: z.number().default(6) }))
    .query(async ({ input }) => pwc.getRevenueForecast(input.months)),

  "pwc.getProfitability": publicProcedure
    .input(z.object({ by: z.enum(["client", "matter", "practice_area", "attorney"]), period: z.string() }))
    .query(async ({ input }) => pwc.getProfitabilityAnalysis(input)),

  "pwc.getTrustCompliance": publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ input }) => pwc.getTrustCompliance(input.period)),

  "pwc.getExpenseAnalysis": publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ input }) => pwc.getExpenseAnalysis(input.period)),

  "pwc.getKPIs": publicProcedure.query(async () => pwc.getKPIDashboard()),

  "pwc.getTaxPrep": publicProcedure
    .input(z.object({ taxYear: z.number() }))
    .query(async ({ input }) => pwc.generateTaxPrep(input.taxYear)),

  "pwc.getAlerts": publicProcedure.query(async () => pwc.getAlerts()),

  // ─── Rainmaker ─────────────────────────────────────────────
  "rainmaker.runDiagnostic": publicProcedure
    .input(z.object({ clientId: z.string(), diagnosticType: z.string(), additionalContext: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.db.client.findUniqueOrThrow({ where: { id: input.clientId } });
      const matters = await ctx.db.matter.findMany({ where: { clientId: input.clientId }, take: 20 });
      const result = await rainmaker.runDiagnostic({
        clientId: input.clientId,
        clientName: client.name,
        diagnosticType: input.diagnosticType,
        existingMatters: matters.map((m) => ({ name: m.name, practiceArea: m.practiceArea || "", status: m.status })),
        additionalContext: input.additionalContext,
      });
      if (result.success && result.diagnosticId) {
        await ctx.db.rainmakerDiagnostic.create({
          data: { id: result.diagnosticId, clientId: input.clientId, diagnosticType: input.diagnosticType as any, status: "PENDING" },
        });
      }
      return result;
    }),

  "rainmaker.getDiagnostic": publicProcedure
    .input(z.object({ diagnosticId: z.string() }))
    .query(async ({ ctx, input }) => {
      const local = await ctx.db.rainmakerDiagnostic.findUnique({ where: { id: input.diagnosticId } });
      const remote = await rainmaker.getDiagnostic(input.diagnosticId);
      return { local, remote: remote.success ? remote.data : null };
    }),

  "rainmaker.getDiagnostics": publicProcedure
    .input(z.object({ clientId: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.clientId) where.clientId = input.clientId;
      if (input?.status) where.status = input.status;
      return ctx.db.rainmakerDiagnostic.findMany({ where, orderBy: { createdAt: "desc" } });
    }),

  "rainmaker.getFindings": publicProcedure
    .input(z.object({ diagnosticId: z.string() }))
    .query(async ({ input }) => rainmaker.getFindings(input.diagnosticId)),

  "rainmaker.getOpportunities": publicProcedure
    .input(z.object({ diagnosticId: z.string() }))
    .query(async ({ input }) => rainmaker.getOpportunities(input.diagnosticId)),

  "rainmaker.generateWorkPlan": publicProcedure
    .input(z.object({ diagnosticId: z.string() }))
    .mutation(async ({ input }) => rainmaker.generateWorkPlan(input.diagnosticId)),

  "rainmaker.getWorkPlan": publicProcedure
    .input(z.object({ diagnosticId: z.string() }))
    .query(async ({ input }) => rainmaker.getWorkPlan(input.diagnosticId)),

  "rainmaker.updateWorkPlanTask": publicProcedure
    .input(z.object({ diagnosticId: z.string(), taskId: z.string(), status: z.string().optional(), assignedTo: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ input }) => rainmaker.updateWorkPlanTask(input.diagnosticId, input.taskId, { status: input.status, assignedTo: input.assignedTo, notes: input.notes })),

  "rainmaker.convertOpportunity": publicProcedure
    .input(z.object({ diagnosticId: z.string(), opportunityId: z.string(), matterName: z.string(), practiceArea: z.string(), assignedTo: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const result = await rainmaker.convertOpportunityToMatter(input.diagnosticId, input.opportunityId, { matterName: input.matterName, practiceArea: input.practiceArea, assignedTo: input.assignedTo });
      if (result.success) {
        // Create matter in Clio AI
        const diag = await ctx.db.rainmakerDiagnostic.findFirst({ where: { id: input.diagnosticId } });
        if (diag?.clientId) {
          const lastMatter = await ctx.db.matter.findFirst({ orderBy: { matterNumber: "desc" } });
          const num = lastMatter ? parseInt(lastMatter.matterNumber.replace("M-", "")) + 1 : 1;
          await ctx.db.matter.create({ data: { name: input.matterName, clientId: diag.clientId, practiceArea: input.practiceArea, matterNumber: `M-${num.toString().padStart(4, "0")}`, status: "OPEN" } });
        }
      }
      return result;
    }),

  "rainmaker.getClientHealth": publicProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ input }) => rainmaker.getClientHealthScore(input.clientId)),

  "rainmaker.getAnnualReviewTemplate": publicProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ input }) => rainmaker.getAnnualReviewTemplate(input.clientId)),

  "rainmaker.getIndustryInsights": publicProcedure
    .input(z.object({ industry: z.string() }))
    .query(async ({ input }) => rainmaker.getIndustryInsights(input.industry)),

  "rainmaker.getRiskReport": publicProcedure
    .input(z.object({ clientId: z.string().optional(), firmWide: z.boolean().optional() }))
    .query(async ({ input }) => rainmaker.getRiskReport(input)),

  "rainmaker.getOpportunityPipeline": publicProcedure.query(async () => rainmaker.getOpportunityPipeline()),

  // ─── Profitability ─────────────────────────────────────────
  "profitability.client": publicProcedure
    .input(z.object({ clientId: z.string(), period: z.string(), periodType: z.enum(PERIOD_TYPE) }))
    .query(async ({ input }) => engine.calculateClientProfitability(input.clientId, input.period, input.periodType)),

  "profitability.clientAll": publicProcedure
    .input(z.object({ period: z.string() }))
    .mutation(async ({ input }) => engine.calculateAllProfitability(input.period)),

  "profitability.clientRankings": publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.clientProfitability.findMany({
        where: { period: input.period },
        include: { client: true },
        orderBy: { netProfit: "desc" },
      });
    }),

  "profitability.matter": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => engine.calculateMatterProfitability(input.matterId)),

  "profitability.matterAll": publicProcedure.mutation(async ({ ctx }) => {
    const matters = await ctx.db.matter.findMany({ where: { status: "OPEN" } });
    const results = [];
    for (const m of matters) results.push(await engine.calculateMatterProfitability(m.id));
    return results;
  }),

  "profitability.matterRankings": publicProcedure
    .input(z.object({ period: z.string().optional(), practiceArea: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.practiceArea) where.practiceArea = input.practiceArea;
      return ctx.db.matterProfitability.findMany({ where, include: { matter: true, client: true }, orderBy: { netProfit: "desc" } });
    }),

  "profitability.practiceArea": publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ ctx, input }) => {
      const data = await ctx.db.matterProfitability.groupBy({
        by: ["practiceArea"],
        _sum: { totalRevenue: true, totalCosts: true, grossProfit: true, netProfit: true, hoursWorked: true },
        _count: true,
        _avg: { profitMargin: true, realizationRate: true },
      });
      return data;
    }),

  "profitability.attorney": publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ ctx, input }) => {
      const snapshot = await ctx.db.financialSnapshot.findFirst({ where: { period: input.period }, orderBy: { createdAt: "desc" } });
      return snapshot?.revenueByAttorney ? JSON.parse(snapshot.revenueByAttorney) : [];
    }),

  "profitability.segment": publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ ctx, input }) => {
      const all = await ctx.db.clientProfitability.findMany({ where: { period: input.period }, include: { client: true } });
      const segments: Record<string, { count: number; revenue: number; clients: any[] }> = { A: { count: 0, revenue: 0, clients: [] }, B: { count: 0, revenue: 0, clients: [] }, C: { count: 0, revenue: 0, clients: [] }, D: { count: 0, revenue: 0, clients: [] } };
      for (const cp of all) {
        const seg = cp.segment || "D";
        if (segments[seg]) {
          segments[seg].count++;
          segments[seg].revenue += Number(cp.revenue);
          segments[seg].clients.push({ name: cp.client.name, revenue: Number(cp.revenue), margin: Number(cp.profitMargin) });
        }
      }
      return segments;
    }),

  "profitability.lifetimeValue": publicProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ ctx, input }) => {
      const payments = await ctx.db.payment.aggregate({ where: { invoice: { matter: { clientId: input.clientId } } }, _sum: { amount: true } });
      const costs = await ctx.db.expense.aggregate({ where: { clientId: input.clientId }, _sum: { amount: true } });
      const revenue = Number(payments._sum.amount || 0);
      const totalCosts = Number(costs._sum.amount || 0);
      return { clientId: input.clientId, lifetimeRevenue: revenue, lifetimeCosts: totalCosts, lifetimeValue: revenue - totalCosts };
    }),

  // ─── Forecasting ───────────────────────────────────────────
  "forecasts.generate": publicProcedure
    .input(z.object({ forecastType: z.enum(FORECAST_TYPE), periods: z.number().default(6), granularity: z.enum(FORECAST_GRAN).default("MONTHLY") }))
    .mutation(async ({ input }) => engine.generateForecast(input.forecastType, input.periods, input.granularity)),

  "forecasts.getLatest": publicProcedure
    .input(z.object({ forecastType: z.enum(FORECAST_TYPE) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.financialForecast.findFirst({ where: { forecastType: input.forecastType }, orderBy: { createdAt: "desc" } });
    }),

  "forecasts.getAll": publicProcedure.query(async ({ ctx }) => {
    return ctx.db.financialForecast.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  }),

  "forecasts.accuracy": publicProcedure
    .input(z.object({ forecastType: z.enum(FORECAST_TYPE) }))
    .query(async ({ ctx, input }) => {
      const forecasts = await ctx.db.financialForecast.findMany({ where: { forecastType: input.forecastType }, orderBy: { createdAt: "desc" }, take: 5 });
      return forecasts.map((f) => ({ id: f.id, accuracy: f.accuracy ? Number(f.accuracy) : null, methodology: f.methodology, createdAt: f.createdAt }));
    }),

  // ─── Budgets ───────────────────────────────────────────────
  "budgets.list": publicProcedure
    .input(z.object({ targetType: z.enum(BUDGET_TYPE).optional(), period: z.string().optional(), status: z.enum(BUDGET_STATUS).optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.targetType) where.targetType = input.targetType;
      if (input?.period) where.period = input.period;
      if (input?.status) where.status = input.status;
      return ctx.db.budgetTarget.findMany({ where, orderBy: { createdAt: "desc" } });
    }),

  "budgets.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.budgetTarget.findUniqueOrThrow({ where: { id: input.id } })),

  "budgets.create": publicProcedure
    .input(z.object({
      name: z.string(), targetType: z.enum(BUDGET_TYPE), period: z.string(),
      periodType: z.enum(PERIOD_TYPE), targetAmount: z.number(),
      practiceArea: z.string().optional(), attorneyId: z.string().optional(), notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.budgetTarget.create({ data: input })),

  "budgets.update": publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), targetAmount: z.number().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { const { id, ...data } = input; return ctx.db.budgetTarget.update({ where: { id }, data }); }),

  "budgets.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.budgetTarget.delete({ where: { id: input.id } })),

  "budgets.evaluate": publicProcedure.mutation(async () => engine.evaluateBudgets()),

  "budgets.getVariance": publicProcedure.query(async ({ ctx }) => {
    const budgets = await ctx.db.budgetTarget.findMany();
    return {
      onTrack: budgets.filter((b) => b.status === "ON_TRACK").length,
      atRisk: budgets.filter((b) => b.status === "AT_RISK").length,
      behind: budgets.filter((b) => b.status === "BEHIND").length,
      exceeded: budgets.filter((b) => b.status === "EXCEEDED").length,
      budgets,
    };
  }),

  // ─── Alerts ────────────────────────────────────────────────
  "alerts.list": publicProcedure
    .input(z.object({ alertType: z.enum(ALERT_TYPE).optional(), severity: z.enum(SEVERITY).optional(), isRead: z.boolean().optional(), isDismissed: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.alertType) where.alertType = input.alertType;
      if (input?.severity) where.severity = input.severity;
      if (input?.isRead !== undefined) where.isRead = input.isRead;
      if (input?.isDismissed !== undefined) where.isDismissed = input.isDismissed;
      return ctx.db.financialAlert.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
    }),

  "alerts.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.financialAlert.findUniqueOrThrow({ where: { id: input.id } })),

  "alerts.markRead": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.financialAlert.update({ where: { id: input.id }, data: { isRead: true } })),

  "alerts.dismiss": publicProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.financialAlert.update({ where: { id: input.id }, data: { isDismissed: true, dismissedAt: new Date(), dismissedBy: input.reason } })),

  "alerts.check": publicProcedure.mutation(async () => engine.checkFinancialAlerts()),

  "alerts.configure": publicProcedure
    .input(z.object({ alertType: z.enum(ALERT_TYPE), threshold: z.number().optional(), enabled: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const config = await ctx.db.finInsightsIntegration.findFirst();
      const settings = config?.settings ? JSON.parse(config.settings) : {};
      if (!settings.alertThresholds) settings.alertThresholds = {};
      settings.alertThresholds[input.alertType] = { threshold: input.threshold, enabled: input.enabled };
      if (config) {
        return ctx.db.finInsightsIntegration.update({ where: { id: config.id }, data: { settings: JSON.stringify(settings) } });
      }
      return settings;
    }),

  // ─── Reports ───────────────────────────────────────────────
  "reports.executiveSummary": publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ input }) => engine.generateExecutiveSummary(input.period)),

  "reports.benchmark": publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ input }) => engine.generateBenchmarkComparison(input.period)),

  "reports.clientAdvisory": publicProcedure
    .input(z.object({ clientId: z.string() }))
    .query(async ({ input }) => engine.generateClientAdvisory(input.clientId)),

  "reports.revenueBySource": publicProcedure.query(async () => engine.getRevenueBySource()),

  "reports.kpiDashboard": publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const period = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
    const snapshot = await ctx.db.financialSnapshot.findFirst({ where: { period }, orderBy: { createdAt: "desc" } });
    const pwcKpis = await pwc.getKPIDashboard();
    return { snapshot, pwcKpis: pwcKpis.success ? pwcKpis.data : null };
  }),

  "reports.cashFlow": publicProcedure.query(async ({ ctx }) => {
    const bankAccounts = await ctx.db.bankAccount.findMany({ where: { isActive: true } });
    const cash = bankAccounts.reduce((s, a) => s + Number(a.currentBalance), 0);
    const ar = await ctx.db.invoice.findMany({ where: { status: { in: ["SENT", "OVERDUE"] } } });
    const arTotal = ar.reduce((s, i) => s + Number(i.total) - Number(i.amountPaid || 0), 0);
    return { currentCash: cash, arOutstanding: arTotal, projectedCollections: arTotal * 0.85 };
  }),

  "reports.wipAnalysis": publicProcedure.query(async ({ ctx }) => {
    const unbilled = await ctx.db.timeEntry.findMany({
      where: { billable: true, invoiceLineItemId: null },
      include: { matter: { include: { client: true } } },
      orderBy: { date: "asc" },
    });
    const totalWip = unbilled.reduce((s, t) => s + (Number(t.duration) / 60) * Number(t.rate || 0), 0);
    const byMatter: Record<string, { matter: string; client: string; hours: number; value: number }> = {};
    for (const t of unbilled) {
      const key = t.matterId;
      if (!byMatter[key]) byMatter[key] = { matter: t.matter?.name || "Unknown", client: t.matter?.client?.name || "Unknown", hours: 0, value: 0 };
      byMatter[key].hours += Number(t.duration) / 60;
      byMatter[key].value += (Number(t.duration) / 60) * Number(t.rate || 0);
    }
    return { totalWip, byMatter: Object.values(byMatter).sort((a, b) => b.value - a.value) };
  }),

  "reports.export": publicProcedure
    .input(z.object({ reportType: z.string(), period: z.string().optional(), format: z.enum(["pdf", "xlsx"]).default("pdf") }))
    .mutation(async ({ input }) => {
      return { message: `Export of ${input.reportType} in ${input.format} format will be generated.`, status: "pending" };
    }),
});
