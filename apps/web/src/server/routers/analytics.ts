import { z } from "zod";
import { router, publicProcedure } from "../trpc";

const dateRangeInput = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

function getDateRange(startDate?: string, endDate?: string) {
  const end = endDate ? new Date(endDate) : new Date();
  end.setHours(23, 59, 59, 999);
  const start = startDate
    ? new Date(startDate)
    : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

function getPriorPeriod(start: Date, end: Date) {
  const duration = end.getTime() - start.getTime();
  const priorEnd = new Date(start.getTime() - 1);
  const priorStart = new Date(priorEnd.getTime() - duration);
  return { priorStart, priorEnd };
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return current > 0 ? 100 : null;
  return Math.round(((current - prior) / prior) * 100);
}

export const analyticsRouter = router({
  overview: publicProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    const { start, end } = getDateRange(input.startDate, input.endDate);
    const { priorStart, priorEnd } = getPriorPeriod(start, end);

    async function getMetrics(s: Date, e: Date) {
      const [leads, convertedLeads, clients, matters, paidInvoices, timeEntries] =
        await Promise.all([
          ctx.db.lead.count({ where: { createdAt: { gte: s, lte: e } } }),
          ctx.db.lead.findMany({
            where: { status: "CONVERTED", createdAt: { gte: s, lte: e } },
            select: { createdAt: true, convertedAt: true },
          }),
          ctx.db.client.count({ where: { createdAt: { gte: s, lte: e } } }),
          ctx.db.matter.count({ where: { createdAt: { gte: s, lte: e } } }),
          ctx.db.invoice.aggregate({
            where: { status: "PAID", paidAt: { gte: s, lte: e } },
            _sum: { total: true },
          }),
          ctx.db.timeEntry.aggregate({
            where: { date: { gte: s, lte: e } },
            _sum: { duration: true },
          }),
        ]);

      const totalLeads = leads;
      const conversionRate = totalLeads > 0 ? (convertedLeads.length / totalLeads) * 100 : 0;
      const revenue = Number(paidInvoices._sum.total || 0);
      const hoursLogged = Math.round((Number(timeEntries._sum.duration || 0) / 60) * 10) / 10;

      let avgDaysToConvert = 0;
      if (convertedLeads.length > 0) {
        const totalDays = convertedLeads.reduce((sum, l) => {
          if (!l.convertedAt) return sum;
          return sum + (l.convertedAt.getTime() - l.createdAt.getTime()) / (1000 * 60 * 60 * 24);
        }, 0);
        avgDaysToConvert = Math.round((totalDays / convertedLeads.length) * 10) / 10;
      }

      return {
        totalLeads,
        conversionRate: Math.round(conversionRate * 10) / 10,
        newClients: clients,
        newMatters: matters,
        revenue,
        hoursLogged,
        avgDaysToConvert,
      };
    }

    const [current, prior] = await Promise.all([
      getMetrics(start, end),
      getMetrics(priorStart, priorEnd),
    ]);

    return {
      ...current,
      changes: {
        totalLeads: pctChange(current.totalLeads, prior.totalLeads),
        conversionRate: pctChange(current.conversionRate, prior.conversionRate),
        newClients: pctChange(current.newClients, prior.newClients),
        newMatters: pctChange(current.newMatters, prior.newMatters),
        revenue: pctChange(current.revenue, prior.revenue),
        hoursLogged: pctChange(current.hoursLogged, prior.hoursLogged),
        avgDaysToConvert: pctChange(current.avgDaysToConvert, prior.avgDaysToConvert),
      },
    };
  }),

  leadsBySource: publicProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    const { start, end } = getDateRange(input.startDate, input.endDate);
    const leads = await ctx.db.lead.groupBy({
      by: ["source"],
      where: { createdAt: { gte: start, lte: end } },
      _count: true,
    });
    const total = leads.reduce((s, l) => s + l._count, 0);
    return leads.map((l) => ({
      source: l.source,
      count: l._count,
      percentage: total > 0 ? Math.round((l._count / total) * 1000) / 10 : 0,
    }));
  }),

  leadsByStatus: publicProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    const { start, end } = getDateRange(input.startDate, input.endDate);
    const leads = await ctx.db.lead.groupBy({
      by: ["status"],
      where: { createdAt: { gte: start, lte: end } },
      _count: true,
    });
    const total = leads.reduce((s, l) => s + l._count, 0);
    return leads.map((l) => ({
      status: l.status,
      count: l._count,
      percentage: total > 0 ? Math.round((l._count / total) * 1000) / 10 : 0,
    }));
  }),

  conversionFunnel: publicProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    const { start, end } = getDateRange(input.startDate, input.endDate);
    const stages = [
      "NEW",
      "CONTACTED",
      "QUALIFYING",
      "QUALIFIED",
      "PROPOSAL_SENT",
      "CONVERTED",
    ] as const;

    const counts = await Promise.all(
      stages.map((status) =>
        ctx.db.lead.count({
          where: {
            createdAt: { gte: start, lte: end },
            status: { in: stages.slice(stages.indexOf(status)) as any },
          },
        })
      )
    );

    return stages.map((stage, i) => ({
      stage,
      count: counts[i],
    }));
  }),

  pipelineByStage: publicProcedure.query(async ({ ctx }) => {
    const stages = [
      "NEW",
      "CONSULTATION",
      "CONFLICT_CHECK",
      "RETAINER_SENT",
      "RETAINED",
      "ACTIVE",
    ] as const;

    const results = await Promise.all(
      stages.map(async (stage) => {
        const matters = await ctx.db.matter.findMany({
          where: { pipelineStage: stage, status: { not: "CLOSED" } },
          include: {
            invoices: {
              where: { status: "PAID" },
              select: { total: true },
            },
          },
        });
        const value = matters.reduce(
          (sum, m) => sum + m.invoices.reduce((s, inv) => s + Number(inv.total), 0),
          0
        );
        return { stage, count: matters.length, value: Math.round(value * 100) / 100 };
      })
    );

    return results;
  }),

  revenueOverTime: publicProcedure.query(async ({ ctx }) => {
    const months: { month: string; revenue: number }[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      const label = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`;

      const result = await ctx.db.invoice.aggregate({
        where: { status: "PAID", paidAt: { gte: start, lte: end } },
        _sum: { total: true },
      });

      months.push({ month: label, revenue: Number(result._sum.total || 0) });
    }

    return months;
  }),

  leadsOverTime: publicProcedure.query(async ({ ctx }) => {
    const weeks: { week: string; count: number }[] = [];
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const end = new Date(now);
      end.setDate(end.getDate() - i * 7);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      const weekNum = Math.ceil(
        ((start.getTime() - new Date(start.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7
      );
      const label = `${start.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;

      const count = await ctx.db.lead.count({
        where: { createdAt: { gte: start, lte: end } },
      });

      weeks.push({ week: label, count });
    }

    return weeks;
  }),

  topPracticeAreas: publicProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    const { start, end } = getDateRange(input.startDate, input.endDate);

    const matters = await ctx.db.matter.findMany({
      where: { createdAt: { gte: start, lte: end }, practiceArea: { not: null } },
      include: {
        invoices: {
          where: { status: "PAID" },
          select: { total: true },
        },
      },
    });

    const areaMap = new Map<string, { count: number; billed: number }>();
    for (const m of matters) {
      const area = m.practiceArea || "Other";
      const existing = areaMap.get(area) || { count: 0, billed: 0 };
      existing.count++;
      existing.billed += m.invoices.reduce((s, inv) => s + Number(inv.total), 0);
      areaMap.set(area, existing);
    }

    return Array.from(areaMap.entries())
      .map(([area, data]) => ({
        area,
        count: data.count,
        billed: Math.round(data.billed * 100) / 100,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }),

  appointmentStats: publicProcedure.input(dateRangeInput).query(async ({ ctx, input }) => {
    const { start, end } = getDateRange(input.startDate, input.endDate);

    const [total, completed, noShow, cancelled, fees] = await Promise.all([
      ctx.db.appointment.count({ where: { startTime: { gte: start, lte: end } } }),
      ctx.db.appointment.count({
        where: { startTime: { gte: start, lte: end }, status: "COMPLETED" },
      }),
      ctx.db.appointment.count({
        where: { startTime: { gte: start, lte: end }, status: "NO_SHOW" },
      }),
      ctx.db.appointment.count({
        where: { startTime: { gte: start, lte: end }, status: "CANCELLED" },
      }),
      ctx.db.appointment.aggregate({
        where: {
          startTime: { gte: start, lte: end },
          paymentStatus: "PAID",
        },
        _sum: { consultationFee: true },
      }),
    ]);

    return {
      total,
      completed,
      noShow,
      cancelled,
      confirmed: total - completed - noShow - cancelled,
      feesCollected: Number(fees._sum.consultationFee || 0),
    };
  }),

  intakeFormStats: publicProcedure.query(async ({ ctx }) => {
    const templates = await ctx.db.intakeFormTemplate.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { submissions: true } },
        submissions: {
          where: { clientId: { not: null } },
          select: { id: true },
        },
      },
    });

    return templates.map((t) => ({
      templateId: t.id,
      templateName: t.name,
      submissions: t._count.submissions,
      conversions: t.submissions.length,
      conversionRate:
        t._count.submissions > 0
          ? Math.round((t.submissions.length / t._count.submissions) * 1000) / 10
          : 0,
    }));
  }),
});
