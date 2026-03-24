import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { computePeriod, computeScenario } from "@/lib/profitability-engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const profitabilityRouter = router({
  computePeriod: publicProcedure
    .input(z.object({ period: z.string(), periodType: z.string().optional().default("monthly"), startDate: z.date(), endDate: z.date() }))
    .mutation(async ({ input }) => { return computePeriod(DEFAULT_FIRM_ID, input.period, input.periodType, input.startDate, input.endDate); }),

  getPeriods: publicProcedure.input(z.object({ periodType: z.string().optional() })).query(async ({ ctx, input }) => {
    const where: any = { firmId: DEFAULT_FIRM_ID };
    if (input.periodType) where.periodType = input.periodType;
    return ctx.db.profitabilityPeriod.findMany({ where, orderBy: { period: "desc" }, take: 12 });
  }),

  getPeriod: publicProcedure.input(z.object({ periodId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.profitabilityPeriod.findUnique({ where: { id: input.periodId }, include: { practiceAreas: { orderBy: { netProfit: "desc" } } } });
  }),

  getLatest: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.profitabilityPeriod.findFirst({ where: { firmId: DEFAULT_FIRM_ID, status: "computed" }, orderBy: { period: "desc" }, include: { practiceAreas: { orderBy: { netProfit: "desc" } } } });
  }),

  getPADetail: publicProcedure
    .input(z.object({ practiceArea: z.string(), periodType: z.string().optional().default("monthly"), limit: z.number().optional().default(12) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.profitabilityByPA.findMany({
        where: { firmId: DEFAULT_FIRM_ID, practiceArea: input.practiceArea },
        include: { period: { select: { period: true, periodType: true } } },
        orderBy: { period: { period: "desc" } }, take: input.limit,
      });
    }),

  // OVERHEAD
  getOverhead: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.overheadConfig.findUnique({ where: { firmId: DEFAULT_FIRM_ID } });
  }),

  updateOverhead: publicProcedure
    .input(z.object({ lineItems: z.any(), totalMonthly: z.number(), allocationMethod: z.string().optional(), customWeights: z.any().optional(), attorneyCosts: z.any().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.overheadConfig.upsert({ where: { firmId: DEFAULT_FIRM_ID }, create: { firmId: DEFAULT_FIRM_ID, ...input }, update: input });
    }),

  // SCENARIOS
  getScenarios: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.profitabilityScenario.findMany({ where: { firmId: DEFAULT_FIRM_ID }, orderBy: { createdAt: "desc" } });
  }),

  createScenario: publicProcedure
    .input(z.object({ name: z.string(), baselinePeriod: z.string(), assumptions: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const scenario = await ctx.db.profitabilityScenario.create({ data: { ...input, firmId: DEFAULT_FIRM_ID, createdBy: DEFAULT_USER_ID } });
      await computeScenario(scenario.id);
      return ctx.db.profitabilityScenario.findUnique({ where: { id: scenario.id } });
    }),

  deleteScenario: publicProcedure.input(z.object({ scenarioId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.profitabilityScenario.delete({ where: { id: input.scenarioId } });
  }),

  // DASHBOARD
  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const latest = await ctx.db.profitabilityPeriod.findFirst({ where: { firmId: DEFAULT_FIRM_ID, status: "computed" }, orderBy: { period: "desc" }, include: { practiceAreas: { orderBy: { netMargin: "desc" } } } });
    if (!latest) return null;

    const topPA = latest.practiceAreas[0];
    const bottomPA = latest.practiceAreas[latest.practiceAreas.length - 1];
    const totalRevenue = latest.practiceAreas.reduce((s, p) => s + p.collected, 0);
    const totalProfit = latest.practiceAreas.reduce((s, p) => s + p.netProfit, 0);

    return {
      period: latest.period,
      totalRevenue, totalProfit,
      firmMargin: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0,
      topPA: topPA ? { name: topPA.practiceArea, margin: topPA.netMargin } : null,
      bottomPA: bottomPA ? { name: bottomPA.practiceArea, margin: bottomPA.netMargin } : null,
      paCount: latest.practiceAreas.length,
      aiSummary: latest.aiSummary,
    };
  }),
});
