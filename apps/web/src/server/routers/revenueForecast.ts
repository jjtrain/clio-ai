import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { generateForecast, getLatestForecast, getGoalProgress } from "@/lib/forecast-engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const revenueForecastRouter = router({
  generateForecast: publicProcedure
    .input(z.object({ periodType: z.string().optional() }))
    .mutation(async ({ input }) => { return generateForecast(DEFAULT_FIRM_ID, DEFAULT_USER_ID, input.periodType); }),

  getLatestForecast: publicProcedure.query(async () => { return getLatestForecast(DEFAULT_FIRM_ID); }),

  getForecasts: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.revenueForecast.findMany({ where: { firmId: DEFAULT_FIRM_ID }, orderBy: { generatedAt: "desc" }, take: 10 });
  }),

  getForecast: publicProcedure.input(z.object({ forecastId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.revenueForecast.findUnique({ where: { id: input.forecastId }, include: { dataPoints: { orderBy: { amount: "desc" } } } });
  }),

  getDataPoints: publicProcedure.input(z.object({ forecastId: z.string(), confidence: z.string().optional(), practiceArea: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { forecastId: input.forecastId };
      if (input.confidence) where.confidence = input.confidence;
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      return ctx.db.forecastDataPoint.findMany({ where, orderBy: { amount: "desc" } });
    }),

  // HISTORICAL
  getHistoricalRevenue: publicProcedure.input(z.object({ months: z.number().optional().default(12), practiceArea: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      else where.practiceArea = null; // firm totals
      return ctx.db.historicalRevenue.findMany({ where, orderBy: { period: "desc" }, take: input.months });
    }),

  // GOALS
  getGoals: publicProcedure.query(async () => { return getGoalProgress(DEFAULT_FIRM_ID); }),

  setGoal: publicProcedure
    .input(z.object({ period: z.string(), periodType: z.string(), practiceArea: z.string().optional(), attorneyId: z.string().optional(), goalAmount: z.number(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.revenueGoal.upsert({
        where: { period_practiceArea_attorneyId_firmId: { period: input.period, practiceArea: input.practiceArea || "", attorneyId: input.attorneyId || "", firmId: DEFAULT_FIRM_ID } },
        create: { ...input, practiceArea: input.practiceArea || null, attorneyId: input.attorneyId || null, firmId: DEFAULT_FIRM_ID },
        update: { goalAmount: input.goalAmount, notes: input.notes },
      });
    }),

  // ASSUMPTIONS
  getAssumptions: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.forecastAssumption.findMany({ where: { firmId: DEFAULT_FIRM_ID }, orderBy: [{ category: "asc" }, { name: "asc" }] });
  }),

  updateAssumption: publicProcedure
    .input(z.object({ name: z.string(), currentValue: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.forecastAssumption.update({ where: { name_firmId: { name: input.name, firmId: DEFAULT_FIRM_ID } }, data: { currentValue: input.currentValue } });
    }),

  // SCENARIOS
  getScenarios: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.forecastScenario.findMany({ where: { firmId: DEFAULT_FIRM_ID }, orderBy: { createdAt: "desc" } });
  }),

  createScenario: publicProcedure
    .input(z.object({ name: z.string(), forecastId: z.string().optional(), adjustments: z.any(), projectedTotal: z.number(), projectedByArea: z.any().optional(), comparedToBase: z.number().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { return ctx.db.forecastScenario.create({ data: { ...input, firmId: DEFAULT_FIRM_ID } }); }),

  // DASHBOARD STATS
  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const forecast = await getLatestForecast(DEFAULT_FIRM_ID);
    const goals = await ctx.db.revenueGoal.findMany({ where: { firmId: DEFAULT_FIRM_ID, periodType: "quarterly" }, orderBy: { period: "desc" }, take: 6 });
    const historical = await ctx.db.historicalRevenue.findMany({ where: { firmId: DEFAULT_FIRM_ID, practiceArea: null }, orderBy: { period: "desc" }, take: 6 });

    return { forecast, goals, recentRevenue: historical };
  }),
});
