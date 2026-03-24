import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { computeCAC, getCACTrend, getSourceBreakdown } from "@/lib/cac-engine";

const DEFAULT_FIRM_ID = "demo-firm";

export const cacRouter = router({
  compute: publicProcedure
    .input(z.object({ period: z.string() }))
    .mutation(async ({ input }) => {
      return computeCAC(DEFAULT_FIRM_ID, input.period);
    }),

  getByPracticeArea: publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.cACSnapshot.findMany({
        where: { firmId: DEFAULT_FIRM_ID, period: input.period, practiceArea: { not: null } },
        orderBy: { cac: "asc" },
      });
    }),

  getFirmWide: publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.cACSnapshot.findFirst({
        where: { firmId: DEFAULT_FIRM_ID, period: input.period, practiceArea: null },
      });
    }),

  getTrend: publicProcedure
    .input(z.object({ months: z.number().optional().default(6) }))
    .query(async ({ input }) => {
      return getCACTrend(DEFAULT_FIRM_ID, input.months);
    }),

  getSourceBreakdown: publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ input }) => {
      return getSourceBreakdown(DEFAULT_FIRM_ID, input.period);
    }),

  // Marketing Spend CRUD
  getSpend: publicProcedure
    .input(z.object({ period: z.string().optional(), source: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { OR: [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }] };
      if (input.period) where.period = input.period;
      if (input.source) where.source = input.source;
      return ctx.db.marketingSpend.findMany({ where, orderBy: { period: "desc" } });
    }),

  addSpend: publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), source: z.string(), amount: z.number(), period: z.string(), description: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.marketingSpend.create({
        data: { ...input, amount: input.amount, firmId: DEFAULT_FIRM_ID },
      });
    }),

  updateSpend: publicProcedure
    .input(z.object({ id: z.string(), amount: z.number().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.marketingSpend.update({ where: { id }, data });
    }),

  deleteSpend: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.marketingSpend.delete({ where: { id: input.id } });
    }),
});
