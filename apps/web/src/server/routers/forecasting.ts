import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { estimateMatterValue, generateBillingForecast, analyzeMatterProfitability } from "@/lib/ai-forecasting";

function toNum(v: any): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : parseFloat(v.toString()) || 0;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const forecastingRouter = router({
  // ── Valuations ────────────────────────────────────────────────────────
  getValuation: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.matterValuation.findUnique({ where: { matterId: input.matterId } });
    }),

  setValuation: publicProcedure
    .input(z.object({
      matterId: z.string(),
      estimatedValue: z.number(),
      estimatedHours: z.number().optional(),
      estimatedFees: z.number().optional(),
      estimatedCosts: z.number().optional(),
      feeType: z.string(),
      contingencyPercentage: z.number().optional(),
      retainerAmount: z.number().optional(),
      hourlyRate: z.number().optional(),
      estimatedDurationMonths: z.number().optional(),
      confidenceLevel: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { matterId, ...data } = input;
      return ctx.db.matterValuation.upsert({
        where: { matterId },
        update: { ...data, feeType: data.feeType as any, confidenceLevel: data.confidenceLevel as any },
        create: { matterId, ...data, feeType: data.feeType as any, confidenceLevel: data.confidenceLevel as any },
      });
    }),

  aiEstimate: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.findUniqueOrThrow({
        where: { id: input.matterId },
        include: { timeEntries: true, invoices: true, client: true },
      });

      // Get historical data for same practice area
      const similarMatters = await ctx.db.matter.findMany({
        where: { practiceArea: matter.practiceArea, id: { not: matter.id }, status: "CLOSED" },
        include: { timeEntries: true, invoices: { where: { status: { in: ["SENT", "PAID", "OVERDUE"] } } } },
        take: 10,
      });

      const historicalData = {
        avgHours: similarMatters.length > 0
          ? similarMatters.reduce((s, m) => s + m.timeEntries.reduce((h, t) => h + t.duration / 60, 0), 0) / similarMatters.length
          : 40,
        avgFees: similarMatters.length > 0
          ? similarMatters.reduce((s, m) => s + m.invoices.reduce((f, i) => f + toNum(i.total), 0), 0) / similarMatters.length
          : 5000,
        avgDuration: similarMatters.length > 0
          ? similarMatters.filter((m) => m.closeDate).reduce((s, m) => s + Math.max(1, Math.round((new Date(m.closeDate!).getTime() - new Date(m.openDate).getTime()) / (30 * 86400000))), 0) / Math.max(1, similarMatters.filter((m) => m.closeDate).length)
          : 6,
        similarMatters: similarMatters.map((m) => ({
          name: m.name,
          totalBilled: m.invoices.reduce((s, i) => s + toNum(i.total), 0),
          hours: Math.round(m.timeEntries.reduce((s, t) => s + t.duration / 60, 0) * 100) / 100,
          duration: m.closeDate ? Math.max(1, Math.round((new Date(m.closeDate).getTime() - new Date(m.openDate).getTime()) / (30 * 86400000))) : 0,
        })),
      };

      const existingVal = await ctx.db.matterValuation.findUnique({ where: { matterId: input.matterId } });

      const estimate = await estimateMatterValue(
        {
          name: matter.name,
          practiceArea: matter.practiceArea || undefined,
          description: matter.description || undefined,
          feeType: existingVal?.feeType || "HOURLY",
          hourlyRate: existingVal ? toNum(existingVal.hourlyRate) : undefined,
          estimatedHours: existingVal ? toNum(existingVal.estimatedHours) : undefined,
        },
        historicalData
      );

      return ctx.db.matterValuation.upsert({
        where: { matterId: input.matterId },
        update: {
          estimatedValue: estimate.estimatedValue,
          estimatedHours: estimate.estimatedHours,
          estimatedFees: estimate.estimatedFees,
          estimatedCosts: estimate.estimatedCosts,
          estimatedDurationMonths: estimate.estimatedDurationMonths,
          confidenceLevel: estimate.confidence as any,
          aiEstimate: true,
          aiReasoning: estimate.reasoning,
        },
        create: {
          matterId: input.matterId,
          estimatedValue: estimate.estimatedValue,
          estimatedHours: estimate.estimatedHours,
          estimatedFees: estimate.estimatedFees,
          estimatedCosts: estimate.estimatedCosts,
          estimatedDurationMonths: estimate.estimatedDurationMonths,
          feeType: existingVal?.feeType || ("HOURLY" as any),
          confidenceLevel: estimate.confidence as any,
          aiEstimate: true,
          aiReasoning: estimate.reasoning,
        },
      });
    }),

  listValuations: publicProcedure
    .input(z.object({
      practiceArea: z.string().optional(),
      feeType: z.string().optional(),
      confidenceLevel: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { status: { not: "CLOSED" } };
      if (input?.practiceArea) where.practiceArea = input.practiceArea;

      const matters = await ctx.db.matter.findMany({
        where,
        include: {
          client: true,
          valuation: true,
          invoices: { where: { status: { in: ["SENT", "PAID", "OVERDUE"] } } },
          timeEntries: true,
        },
        orderBy: { openDate: "desc" },
      });

      return matters.map((m) => {
        const actualBilled = m.invoices.reduce((s, i) => s + toNum(i.total), 0);
        const actualHours = Math.round(m.timeEntries.reduce((s, t) => s + t.duration / 60, 0) * 100) / 100;
        const estValue = m.valuation ? toNum(m.valuation.estimatedValue) : 0;
        const variance = estValue > 0 ? actualBilled - estValue : 0;
        const variancePct = estValue > 0 ? Math.round((variance / estValue) * 1000) / 10 : 0;

        return {
          matterId: m.id,
          matterName: m.name,
          clientName: m.client?.name || "Unknown",
          practiceArea: m.practiceArea,
          feeType: m.valuation?.feeType || null,
          estimatedValue: estValue,
          actualBilled: Math.round(actualBilled * 100) / 100,
          actualHours,
          variance: Math.round(variance * 100) / 100,
          variancePercentage: variancePct,
          confidence: m.valuation?.confidenceLevel || null,
          isOverBudget: variance > 0 && estValue > 0,
          hasValuation: !!m.valuation,
          percentConsumed: estValue > 0 ? Math.min(Math.round((actualBilled / estValue) * 1000) / 10, 999) : 0,
          aiReasoning: m.valuation?.aiReasoning || null,
        };
      }).filter((m) => {
        if (input?.feeType && m.feeType !== input.feeType) return false;
        if (input?.confidenceLevel && m.confidence !== input.confidenceLevel) return false;
        return true;
      });
    }),

  getValuationSummary: publicProcedure.query(async ({ ctx }) => {
    const matters = await ctx.db.matter.findMany({
      where: { status: { not: "CLOSED" } },
      include: {
        valuation: true,
        invoices: { where: { status: { in: ["SENT", "PAID", "OVERDUE"] } } },
      },
    });

    let totalPipeline = 0;
    let totalBilled = 0;
    let weightedPipeline = 0;
    let overBudget = 0;
    let underBudget = 0;
    let valuedCount = 0;
    let accuracySum = 0;
    let closedValued = 0;

    for (const m of matters) {
      const billed = m.invoices.reduce((s, i) => s + toNum(i.total), 0);
      totalBilled += billed;
      if (m.valuation) {
        const est = toNum(m.valuation.estimatedValue);
        totalPipeline += est;
        valuedCount++;
        const weight = m.valuation.confidenceLevel === "HIGH" ? 1.0 : m.valuation.confidenceLevel === "MEDIUM" ? 0.6 : 0.3;
        weightedPipeline += est * weight;
        if (billed > est && est > 0) overBudget++;
        else if (est > 0) underBudget++;
      }
    }

    // Accuracy from closed matters with valuations
    const closedMatters = await ctx.db.matter.findMany({
      where: { status: "CLOSED" },
      include: { valuation: true, invoices: { where: { status: { in: ["SENT", "PAID", "OVERDUE"] } } } },
    });
    for (const m of closedMatters) {
      if (m.valuation) {
        const est = toNum(m.valuation.estimatedValue);
        const actual = m.invoices.reduce((s, i) => s + toNum(i.total), 0);
        if (est > 0) {
          accuracySum += Math.max(0, (1 - Math.abs(actual - est) / est)) * 100;
          closedValued++;
        }
      }
    }

    return {
      totalPipeline: Math.round(totalPipeline * 100) / 100,
      totalBilled: Math.round(totalBilled * 100) / 100,
      remaining: Math.round((totalPipeline - totalBilled) * 100) / 100,
      overBudget,
      underBudget,
      weightedPipeline: Math.round(weightedPipeline * 100) / 100,
      avgAccuracy: closedValued > 0 ? Math.round((accuracySum / closedValued) * 10) / 10 : 0,
      valuedMatters: valuedCount,
    };
  }),

  // ── Forecasting ───────────────────────────────────────────────────────
  generateFirmForecast: publicProcedure
    .input(z.object({ months: z.number().default(6) }).optional())
    .mutation(async ({ ctx }) => {
      // Gather last 12 months revenue
      const twelveMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1);
      const invoices = await ctx.db.invoice.findMany({
        where: { status: { in: ["SENT", "PAID", "OVERDUE"] }, issueDate: { gte: twelveMonthsAgo } },
      });
      const monthlyMap: Record<string, number> = {};
      for (let i = 11; i >= 0; i--) {
        const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
        monthlyMap[monthKey(d)] = 0;
      }
      for (const inv of invoices) {
        const mk = monthKey(new Date(inv.issueDate));
        if (monthlyMap[mk] !== undefined) monthlyMap[mk] += toNum(inv.total);
      }
      const monthlyRevenue = Object.entries(monthlyMap).map(([month, revenue]) => ({ month, revenue: Math.round(revenue * 100) / 100 }));

      // Active matters with valuations
      const matters = await ctx.db.matter.findMany({
        where: { status: { not: "CLOSED" } },
        include: { valuation: true, invoices: { where: { status: { in: ["SENT", "PAID", "OVERDUE"] } } }, timeEntries: true },
      });
      const activeMatters = matters.map((m) => {
        const billed = m.invoices.reduce((s, i) => s + toNum(i.total), 0);
        const est = m.valuation ? toNum(m.valuation.estimatedValue) : billed * 1.5;
        const monthsActive = Math.max(1, Math.round((Date.now() - new Date(m.openDate).getTime()) / (30 * 86400000)));
        return {
          practiceArea: m.practiceArea || "Other",
          feeType: m.valuation?.feeType || "HOURLY",
          estimatedValue: est,
          remainingValue: Math.max(0, est - billed),
          avgMonthlyBilling: Math.round((billed / monthsActive) * 100) / 100,
        };
      });

      // Lead pipeline
      const pendingLeads = await ctx.db.lead.count({ where: { status: { in: ["NEW", "CONTACTED", "QUALIFYING", "QUALIFIED"] } } });
      const allLeads = await ctx.db.lead.findMany({ select: { status: true } });
      const converted = allLeads.filter((l) => l.status === "CONVERTED").length;
      const avgConversionRate = allLeads.length > 0 ? Math.round((converted / allLeads.length) * 1000) / 10 : 15;
      const avgNewMatterValue = activeMatters.length > 0 ? Math.round(activeMatters.reduce((s, m) => s + m.estimatedValue, 0) / activeMatters.length) : 5000;

      const forecasts = await generateBillingForecast({ monthlyRevenue, activeMatters, pendingLeads, avgConversionRate, avgNewMatterValue });

      // Save forecasts
      for (const f of forecasts) {
        await ctx.db.billingForecast.upsert({
          where: { id: `firm-${f.period}` },
          update: {
            projectedRevenue: f.projectedRevenue,
            projectedHours: f.projectedHours,
            projectedExpenses: f.projectedExpenses,
            methodology: f.methodology,
            aiGenerated: true,
          },
          create: {
            id: `firm-${f.period}`,
            forecastType: "MONTHLY",
            period: f.period,
            projectedRevenue: f.projectedRevenue,
            projectedHours: f.projectedHours,
            projectedExpenses: f.projectedExpenses,
            methodology: f.methodology,
            aiGenerated: true,
          },
        });
      }

      return forecasts;
    }),

  getMatterForecast: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.findUniqueOrThrow({
        where: { id: input.matterId },
        include: { valuation: true, invoices: { where: { status: { in: ["SENT", "PAID", "OVERDUE"] } } }, timeEntries: true },
      });

      const billed = matter.invoices.reduce((s, i) => s + toNum(i.total), 0);
      const est = matter.valuation ? toNum(matter.valuation.estimatedValue) : 0;
      const remaining = Math.max(0, est - billed);
      const monthsActive = Math.max(1, Math.round((Date.now() - new Date(matter.openDate).getTime()) / (30 * 86400000)));
      const monthlyBurnRate = billed / monthsActive;
      const monthsRemaining = monthlyBurnRate > 0 ? Math.ceil(remaining / monthlyBurnRate) : 0;
      const estimatedCompletion = new Date(Date.now() + monthsRemaining * 30 * 86400000);

      return {
        matterId: matter.id,
        estimatedValue: est,
        actualBilled: Math.round(billed * 100) / 100,
        remaining: Math.round(remaining * 100) / 100,
        monthlyBurnRate: Math.round(monthlyBurnRate * 100) / 100,
        monthsRemaining,
        estimatedCompletion,
        percentComplete: est > 0 ? Math.min(Math.round((billed / est) * 1000) / 10, 100) : 0,
      };
    }),

  getFirmForecasts: publicProcedure.query(async ({ ctx }) => {
    const forecasts = await ctx.db.billingForecast.findMany({
      where: { matterId: null, forecastType: "MONTHLY" },
      orderBy: { period: "asc" },
    });

    // Fill in actuals for past periods
    const now = monthKey(new Date());
    for (const f of forecasts) {
      if (f.period < now && f.actualRevenue === null) {
        const { start, end } = periodToRange(f.period);
        const invoices = await ctx.db.invoice.findMany({
          where: { status: { in: ["SENT", "PAID", "OVERDUE"] }, issueDate: { gte: start, lte: end } },
        });
        const entries = await ctx.db.timeEntry.findMany({ where: { date: { gte: start, lte: end } } });
        const actual = invoices.reduce((s, i) => s + toNum(i.total), 0);
        const actualHours = entries.reduce((s, e) => s + e.duration / 60, 0);
        const projected = toNum(f.projectedRevenue);
        const variance = actual - projected;
        const variancePct = projected > 0 ? Math.round((variance / projected) * 1000) / 10 : 0;

        await ctx.db.billingForecast.update({
          where: { id: f.id },
          data: { actualRevenue: actual, actualHours, variance, variancePercentage: variancePct },
        });
        (f as any).actualRevenue = actual;
        (f as any).actualHours = actualHours;
        (f as any).variance = variance;
        (f as any).variancePercentage = variancePct;
      }
    }

    return forecasts;
  }),

  getAccuracy: publicProcedure.query(async ({ ctx }) => {
    const forecasts = await ctx.db.billingForecast.findMany({
      where: { matterId: null, actualRevenue: { not: null } },
      orderBy: { period: "asc" },
    });

    const accuracies = forecasts.map((f) => {
      const projected = toNum(f.projectedRevenue);
      const actual = toNum(f.actualRevenue);
      const accuracy = projected > 0 ? Math.max(0, (1 - Math.abs(actual - projected) / projected)) * 100 : 0;
      return { period: f.period, projected, actual, variance: toNum(f.variance), accuracy: Math.round(accuracy * 10) / 10 };
    });

    const avg = accuracies.length > 0 ? Math.round(accuracies.reduce((s, a) => s + a.accuracy, 0) / accuracies.length * 10) / 10 : 0;
    const overEstimates = accuracies.filter((a) => a.projected > a.actual);
    const underEstimates = accuracies.filter((a) => a.actual > a.projected);

    return {
      overallAccuracy: avg,
      avgOverestimation: overEstimates.length > 0 ? Math.round(overEstimates.reduce((s, a) => s + (a.projected - a.actual), 0) / overEstimates.length) : 0,
      avgUnderestimation: underEstimates.length > 0 ? Math.round(underEstimates.reduce((s, a) => s + (a.actual - a.projected), 0) / underEstimates.length) : 0,
      byPeriod: accuracies,
    };
  }),

  // ── Profitability ─────────────────────────────────────────────────────
  matterProfitability: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.findUniqueOrThrow({
        where: { id: input.matterId },
        include: { valuation: true, invoices: { where: { status: { in: ["SENT", "PAID", "OVERDUE"] } } }, timeEntries: true, client: true },
      });

      const billed = matter.invoices.reduce((s, i) => s + toNum(i.total), 0);
      const hours = matter.timeEntries.reduce((s, t) => s + t.duration / 60, 0);
      const est = matter.valuation ? toNum(matter.valuation.estimatedValue) : 0;
      const rate = matter.valuation ? toNum(matter.valuation.hourlyRate) : (hours > 0 ? billed / hours : 250);
      const months = Math.max(1, Math.round((Date.now() - new Date(matter.openDate).getTime()) / (30 * 86400000)));

      const analysis = await analyzeMatterProfitability({
        name: matter.name,
        feeType: matter.valuation?.feeType || "HOURLY",
        estimatedValue: est,
        actualBilled: billed,
        hoursLogged: Math.round(hours * 100) / 100,
        rate,
        expenses: 0,
        durationMonths: months,
      });

      return {
        matterId: matter.id,
        matterName: matter.name,
        clientName: matter.client?.name,
        estimatedValue: est,
        actualBilled: Math.round(billed * 100) / 100,
        hoursLogged: Math.round(hours * 100) / 100,
        ...analysis,
      };
    }),

  firmProfitability: publicProcedure.query(async ({ ctx }) => {
    const matters = await ctx.db.matter.findMany({
      where: { valuation: { isNot: null } },
      include: { valuation: true, invoices: { where: { status: { in: ["SENT", "PAID", "OVERDUE"] } } }, timeEntries: true },
    });

    let totalEstimated = 0;
    let totalActual = 0;
    let onTrack = 0;
    let offTrack = 0;

    const byPA: Record<string, { estimated: number; actual: number; count: number }> = {};

    for (const m of matters) {
      const est = toNum(m.valuation!.estimatedValue);
      const actual = m.invoices.reduce((s, i) => s + toNum(i.total), 0);
      totalEstimated += est;
      totalActual += actual;
      if (actual <= est || est === 0) onTrack++;
      else offTrack++;

      const pa = m.practiceArea || "Other";
      if (!byPA[pa]) byPA[pa] = { estimated: 0, actual: 0, count: 0 };
      byPA[pa].estimated += est;
      byPA[pa].actual += actual;
      byPA[pa].count++;
    }

    const byPracticeArea = Object.entries(byPA).map(([practiceArea, d]) => ({
      practiceArea,
      estimated: Math.round(d.estimated * 100) / 100,
      actual: Math.round(d.actual * 100) / 100,
      margin: d.estimated > 0 ? Math.round(((d.estimated - d.actual) / d.estimated) * 1000) / 10 : 0,
      count: d.count,
    })).sort((a, b) => b.margin - a.margin);

    return {
      totalEstimated: Math.round(totalEstimated * 100) / 100,
      totalActual: Math.round(totalActual * 100) / 100,
      variance: Math.round((totalActual - totalEstimated) * 100) / 100,
      onTrack,
      offTrack,
      byPracticeArea,
    };
  }),

  practiceAreaProfitability: publicProcedure.query(async ({ ctx }) => {
    const matters = await ctx.db.matter.findMany({
      where: { valuation: { isNot: null } },
      include: { valuation: true, invoices: { where: { status: { in: ["SENT", "PAID", "OVERDUE"] } } }, timeEntries: true },
    });

    const paMap: Record<string, { values: number[]; actuals: number[]; durations: number[]; hours: number[] }> = {};
    for (const m of matters) {
      const pa = m.practiceArea || "Other";
      if (!paMap[pa]) paMap[pa] = { values: [], actuals: [], durations: [], hours: [] };
      paMap[pa].values.push(toNum(m.valuation!.estimatedValue));
      paMap[pa].actuals.push(m.invoices.reduce((s, i) => s + toNum(i.total), 0));
      paMap[pa].hours.push(m.timeEntries.reduce((s, t) => s + t.duration / 60, 0));
      const months = m.closeDate
        ? Math.max(1, Math.round((new Date(m.closeDate).getTime() - new Date(m.openDate).getTime()) / (30 * 86400000)))
        : Math.max(1, Math.round((Date.now() - new Date(m.openDate).getTime()) / (30 * 86400000)));
      paMap[pa].durations.push(months);
    }

    return Object.entries(paMap).map(([practiceArea, d]) => {
      const n = d.values.length;
      const avgEst = d.values.reduce((s, v) => s + v, 0) / n;
      const avgActual = d.actuals.reduce((s, v) => s + v, 0) / n;
      return {
        practiceArea,
        count: n,
        avgEstimatedValue: Math.round(avgEst * 100) / 100,
        avgActualBilled: Math.round(avgActual * 100) / 100,
        avgMargin: avgEst > 0 ? Math.round(((avgEst - avgActual) / avgEst) * 1000) / 10 : 0,
        avgDuration: Math.round(d.durations.reduce((s, v) => s + v, 0) / n * 10) / 10,
        avgHours: Math.round(d.hours.reduce((s, v) => s + v, 0) / n * 10) / 10,
      };
    }).sort((a, b) => b.avgMargin - a.avgMargin);
  }),
});

function periodToRange(period: string) {
  const [y, m] = period.split("-").map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0, 23, 59, 59) };
}
