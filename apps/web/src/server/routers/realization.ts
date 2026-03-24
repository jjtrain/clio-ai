import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  getFirmWideSummary,
  getTrailing12,
  calculateRealization,
} from "@/lib/realization-engine";

export const realizationRouter = router({
  // Firm-wide summary for a given period
  getSummary: publicProcedure
    .input(z.object({ period: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const firmId = ctx.session?.firmId || "demo-firm";
      const now = new Date();
      const period = input?.period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const current = await getFirmWideSummary(firmId, period);

      // Get prior month for trend
      const [y, m] = period.split("-").map(Number);
      const priorDate = new Date(y, m - 2, 1);
      const priorPeriod = `${priorDate.getFullYear()}-${String(priorDate.getMonth() + 1).padStart(2, "0")}`;
      const prior = await getFirmWideSummary(firmId, priorPeriod);

      return { current, prior, period };
    }),

  // By dimension with sorting
  getByDimension: publicProcedure
    .input(z.object({
      dimension: z.enum(["ATTORNEY", "PRACTICE_AREA", "CLIENT", "MATTER_TYPE"]),
      period: z.string().optional(),
      sortBy: z.string().optional(),
      sortDir: z.enum(["asc", "desc"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const firmId = ctx.session?.firmId || "demo-firm";
      const now = new Date();
      const period = input.period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      const orderField = input.sortBy || "combinedRealizationRate";
      const orderDir = input.sortDir || "asc"; // worst first by default

      const snapshots = await ctx.db.realizationSnapshot.findMany({
        where: { firmId, dimension: input.dimension, period },
        orderBy: { [orderField]: orderDir },
      });

      return snapshots;
    }),

  // Trailing 12 trend data for sparklines
  getTrend: publicProcedure.query(async ({ ctx }) => {
    const firmId = ctx.session?.firmId || "demo-firm";
    return getTrailing12(firmId);
  }),

  // Drill-down: matter-level breakdown for a given dimension
  getDrillDown: publicProcedure
    .input(z.object({
      dimension: z.enum(["ATTORNEY", "PRACTICE_AREA", "CLIENT", "MATTER_TYPE"]),
      dimensionId: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const start = input.startDate ? new Date(input.startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
      const end = input.endDate ? new Date(input.endDate) : new Date(now.getFullYear(), now.getMonth() + 1, 1);

      // Get matters for this dimension
      const matterWhere: any = {};
      switch (input.dimension) {
        case "ATTORNEY":
          matterWhere.timeEntries = { some: { userId: input.dimensionId, date: { gte: start, lt: end } } };
          break;
        case "PRACTICE_AREA":
        case "MATTER_TYPE":
          matterWhere.practiceArea = input.dimensionId;
          matterWhere.timeEntries = { some: { date: { gte: start, lt: end } } };
          break;
        case "CLIENT":
          matterWhere.clientId = input.dimensionId;
          matterWhere.timeEntries = { some: { date: { gte: start, lt: end } } };
          break;
      }

      const matters = await ctx.db.matter.findMany({
        where: matterWhere,
        select: {
          id: true,
          name: true,
          practiceArea: true,
          client: { select: { name: true } },
          timeEntries: {
            where: { date: { gte: start, lt: end } },
            select: { hours: true, duration: true, rate: true, billable: true, invoiceLineItemId: true },
          },
          invoices: {
            where: { issueDate: { gte: start, lt: end } },
            select: { total: true, amountPaid: true },
          },
        },
      });

      return matters.map((m) => {
        const hoursWorked = m.timeEntries.reduce((s, e) => s + (e.hours || e.duration / 60), 0);
        const hoursBilled = m.timeEntries
          .filter((e) => e.billable && e.invoiceLineItemId)
          .reduce((s, e) => s + (e.hours || e.duration / 60), 0);
        const rateSum = m.timeEntries.reduce((s, e) => s + (e.hours || e.duration / 60) * Number(e.rate || 0), 0);
        const avgRate = hoursWorked > 0 ? rateSum / hoursWorked : 0;
        const amountBilled = m.invoices.reduce((s, i) => s + Number(i.total), 0);
        const amountCollected = m.invoices.reduce((s, i) => s + Number(i.amountPaid), 0);
        const potentialRevenue = hoursWorked * avgRate;

        return {
          matterId: m.id,
          matterName: m.name,
          clientName: m.client?.name || "—",
          practiceArea: m.practiceArea,
          hoursWorked: Math.round(hoursWorked * 10) / 10,
          hoursBilled: Math.round(hoursBilled * 10) / 10,
          amountBilled: Math.round(amountBilled),
          amountCollected: Math.round(amountCollected),
          billingRealization: hoursWorked > 0 ? Math.round((hoursBilled / hoursWorked) * 1000) / 10 : 0,
          collectionRealization: amountBilled > 0 ? Math.round((amountCollected / amountBilled) * 1000) / 10 : 0,
          combinedRealization: potentialRevenue > 0 ? Math.round((amountCollected / potentialRevenue) * 1000) / 10 : 0,
        };
      }).sort((a, b) => a.combinedRealization - b.combinedRealization);
    }),

  // Worst performers across all dimensions
  getWorstPerformers: publicProcedure
    .input(z.object({ period: z.string().optional(), limit: z.number().default(5) }).optional())
    .query(async ({ ctx, input }) => {
      const firmId = ctx.session?.firmId || "demo-firm";
      const now = new Date();
      const period = input?.period || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      return ctx.db.realizationSnapshot.findMany({
        where: {
          firmId,
          period,
          combinedRealizationRate: { lt: 70 },
        },
        orderBy: { combinedRealizationRate: "asc" },
        take: input?.limit || 5,
      });
    }),

  // Available periods
  getAvailablePeriods: publicProcedure.query(async ({ ctx }) => {
    const firmId = ctx.session?.firmId || "demo-firm";
    const snapshots = await ctx.db.realizationSnapshot.findMany({
      where: { firmId },
      select: { period: true },
      distinct: ["period"],
      orderBy: { period: "desc" },
    });
    return snapshots.map((s) => s.period);
  }),
});
