import { z } from "zod";
import { router, publicProcedure } from "../trpc";

function getDateRange(startDate?: string, endDate?: string) {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 86400000);
  return { start, end };
}

function getPreviousPeriod(start: Date, end: Date) {
  const durationMs = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - durationMs),
    end: new Date(start.getTime() - 1),
  };
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function toNum(val: any): number {
  if (val === null || val === undefined) return 0;
  return typeof val === "number" ? val : parseFloat(val.toString()) || 0;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export const dashboardsRouter = router({
  revenueOverview: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        compareWithPrevious: z.boolean().default(true),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { start, end } = getDateRange(input?.startDate, input?.endDate);
      const prev = getPreviousPeriod(start, end);

      async function getMetrics(from: Date, to: Date) {
        const paidInvoices = await ctx.db.invoice.findMany({
          where: { status: "PAID", paidAt: { gte: from, lte: to } },
          include: { matter: { include: { client: true } } },
        });

        const billedInvoices = await ctx.db.invoice.findMany({
          where: { status: { in: ["SENT", "PAID", "OVERDUE"] }, issueDate: { gte: from, lte: to } },
          include: { matter: { include: { client: true } } },
        });

        const payments = await ctx.db.payment.findMany({
          where: { paymentDate: { gte: from, lte: to } },
        });

        const outstandingInvoices = await ctx.db.invoice.findMany({
          where: { status: { in: ["SENT", "OVERDUE"] } },
        });

        const totalRevenue = paidInvoices.reduce((s, i) => s + toNum(i.total), 0);
        const totalBilled = billedInvoices.reduce((s, i) => s + toNum(i.total), 0);
        const totalCollected = payments.reduce((s, p) => s + toNum(p.amount), 0);
        const totalOutstanding = outstandingInvoices.reduce((s, i) => s + toNum(i.total) - toNum(i.amountPaid), 0);
        const collectionRate = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 1000) / 10 : 0;
        const averageInvoice = billedInvoices.length > 0 ? Math.round(totalBilled / billedInvoices.length * 100) / 100 : 0;

        const paidWithDates = paidInvoices.filter((i) => i.paidAt && i.issueDate);
        const avgDays = paidWithDates.length > 0
          ? Math.round(paidWithDates.reduce((s, i) => s + (new Date(i.paidAt!).getTime() - new Date(i.issueDate).getTime()) / 86400000, 0) / paidWithDates.length)
          : 0;

        return {
          totalRevenue: Math.round(totalRevenue * 100) / 100,
          totalBilled: Math.round(totalBilled * 100) / 100,
          totalCollected: Math.round(totalCollected * 100) / 100,
          totalOutstanding: Math.round(totalOutstanding * 100) / 100,
          collectionRate,
          averageInvoice,
          averageDaysToPayment: avgDays,
          invoiceCount: billedInvoices.length,
          billedInvoices,
          payments,
        };
      }

      const current = await getMetrics(start, end);
      const previous = input?.compareWithPrevious !== false ? await getMetrics(prev.start, prev.end) : null;

      // Revenue by month (last 12 months)
      const allInvoices12 = await ctx.db.invoice.findMany({
        where: {
          issueDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1) },
          status: { in: ["SENT", "PAID", "OVERDUE"] },
        },
      });
      const allPayments12 = await ctx.db.payment.findMany({
        where: { paymentDate: { gte: new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1) } },
      });

      const monthMap: Record<string, { billed: number; collected: number; outstanding: number }> = {};
      for (let i = 11; i >= 0; i--) {
        const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
        monthMap[monthKey(d)] = { billed: 0, collected: 0, outstanding: 0 };
      }
      for (const inv of allInvoices12) {
        const mk = monthKey(new Date(inv.issueDate));
        if (monthMap[mk]) {
          monthMap[mk].billed += toNum(inv.total);
          if (inv.status === "SENT" || inv.status === "OVERDUE") {
            monthMap[mk].outstanding += toNum(inv.total) - toNum(inv.amountPaid);
          }
        }
      }
      for (const p of allPayments12) {
        const mk = monthKey(new Date(p.paymentDate));
        if (monthMap[mk]) monthMap[mk].collected += toNum(p.amount);
      }
      const revenueByMonth = Object.entries(monthMap).map(([month, data]) => ({
        month,
        billed: Math.round(data.billed * 100) / 100,
        collected: Math.round(data.collected * 100) / 100,
        outstanding: Math.round(data.outstanding * 100) / 100,
      }));

      // Revenue by practice area
      const paMap: Record<string, number> = {};
      for (const inv of current.billedInvoices) {
        const pa = inv.matter?.practiceArea || "Other";
        paMap[pa] = (paMap[pa] || 0) + toNum(inv.total);
      }
      const totalPA = Object.values(paMap).reduce((s, v) => s + v, 0);
      const revenueByPracticeArea = Object.entries(paMap)
        .map(([practiceArea, total]) => ({
          practiceArea,
          total: Math.round(total * 100) / 100,
          percentage: totalPA > 0 ? Math.round((total / totalPA) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.total - a.total);

      // Revenue by client (top 10)
      const clientMap: Record<string, { clientName: string; total: number; matters: Set<string> }> = {};
      for (const inv of current.billedInvoices) {
        const name = inv.matter?.client?.name || "Unknown";
        if (!clientMap[name]) clientMap[name] = { clientName: name, total: 0, matters: new Set() };
        clientMap[name].total += toNum(inv.total);
        if (inv.matter) clientMap[name].matters.add(inv.matterId);
      }
      const revenueByClient = Object.values(clientMap)
        .map((c) => ({ clientName: c.clientName, total: Math.round(c.total * 100) / 100, matterCount: c.matters.size }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      return {
        totalRevenue: current.totalRevenue,
        totalBilled: current.totalBilled,
        totalCollected: current.totalCollected,
        totalOutstanding: current.totalOutstanding,
        collectionRate: current.collectionRate,
        averageInvoice: current.averageInvoice,
        averageDaysToPayment: current.averageDaysToPayment,
        revenueByMonth,
        revenueByPracticeArea,
        revenueByClient,
        previousPeriod: previous
          ? {
              totalRevenue: previous.totalRevenue,
              totalBilled: previous.totalBilled,
              totalCollected: previous.totalCollected,
              totalOutstanding: previous.totalOutstanding,
              collectionRate: previous.collectionRate,
              averageDaysToPayment: previous.averageDaysToPayment,
              revenueChange: pctChange(current.totalRevenue, previous.totalRevenue),
              billedChange: pctChange(current.totalBilled, previous.totalBilled),
              collectedChange: pctChange(current.totalCollected, previous.totalCollected),
              outstandingChange: pctChange(current.totalOutstanding, previous.totalOutstanding),
              collectionRateChange: pctChange(current.collectionRate, previous.collectionRate),
              daysToPaymentChange: pctChange(current.averageDaysToPayment, previous.averageDaysToPayment),
            }
          : null,
      };
    }),

  productivityOverview: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        userId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { start, end } = getDateRange(input?.startDate, input?.endDate);
      const prev = getPreviousPeriod(start, end);

      async function getMetrics(from: Date, to: Date) {
        const where: any = { date: { gte: from, lte: to } };
        if (input?.userId) where.userId = input.userId;

        const entries = await ctx.db.timeEntry.findMany({
          where,
          include: { matter: { include: { client: true } }, user: true },
        });

        const payments = await ctx.db.payment.findMany({
          where: { paymentDate: { gte: from, lte: to } },
        });

        const totalMinutes = entries.reduce((s, e) => s + e.duration, 0);
        const billableEntries = entries.filter((e) => e.billable);
        const nonBillableEntries = entries.filter((e) => !e.billable);
        const billableMinutes = billableEntries.reduce((s, e) => s + e.duration, 0);
        const nonBillableMinutes = nonBillableEntries.reduce((s, e) => s + e.duration, 0);
        const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
        const billableHours = Math.round((billableMinutes / 60) * 100) / 100;
        const nonBillableHours = Math.round((nonBillableMinutes / 60) * 100) / 100;
        const utilizationRate = totalHours > 0 ? Math.round((billableHours / totalHours) * 1000) / 10 : 0;
        const billableValue = billableEntries.reduce((s, e) => s + (e.duration / 60) * toNum(e.rate), 0);
        const totalCollected = payments.reduce((s, p) => s + toNum(p.amount), 0);
        const realizationRate = billableValue > 0 ? Math.round((totalCollected / billableValue) * 1000) / 10 : 0;
        const averageHourlyRate = billableHours > 0 ? Math.round((billableValue / billableHours) * 100) / 100 : 0;

        return { totalHours, billableHours, nonBillableHours, utilizationRate, billableValue: Math.round(billableValue * 100) / 100, realizationRate, averageHourlyRate, entries };
      }

      const current = await getMetrics(start, end);
      const previous = await getMetrics(prev.start, prev.end);

      // Hours by day (last 30 days)
      const last30 = new Date(Date.now() - 30 * 86400000);
      const dayWhere: any = { date: { gte: last30 } };
      if (input?.userId) dayWhere.userId = input.userId;
      const dayEntries = await ctx.db.timeEntry.findMany({ where: dayWhere });
      const dayMap: Record<string, { billable: number; nonBillable: number }> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toISOString().split("T")[0];
        dayMap[key] = { billable: 0, nonBillable: 0 };
      }
      for (const e of dayEntries) {
        const key = new Date(e.date).toISOString().split("T")[0];
        if (dayMap[key]) {
          if (e.billable) dayMap[key].billable += e.duration / 60;
          else dayMap[key].nonBillable += e.duration / 60;
        }
      }
      const hoursByDay = Object.entries(dayMap).map(([date, data]) => ({
        date,
        billable: Math.round(data.billable * 100) / 100,
        nonBillable: Math.round(data.nonBillable * 100) / 100,
      }));

      // Hours by matter (top 10)
      const matterMap: Record<string, { matterName: string; clientName: string; hours: number; value: number }> = {};
      for (const e of current.entries) {
        const key = e.matterId;
        if (!matterMap[key]) matterMap[key] = { matterName: e.matter?.name || "Unknown", clientName: e.matter?.client?.name || "Unknown", hours: 0, value: 0 };
        matterMap[key].hours += e.duration / 60;
        if (e.billable) matterMap[key].value += (e.duration / 60) * toNum(e.rate);
      }
      const hoursByMatter = Object.values(matterMap)
        .map((m) => ({ ...m, hours: Math.round(m.hours * 100) / 100, value: Math.round(m.value * 100) / 100 }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 10);

      // Hours by timekeeper
      const tkMap: Record<string, { userName: string; billableHours: number; nonBillableHours: number; value: number }> = {};
      for (const e of current.entries) {
        const name = e.user?.name || "Unknown";
        if (!tkMap[name]) tkMap[name] = { userName: name, billableHours: 0, nonBillableHours: 0, value: 0 };
        if (e.billable) {
          tkMap[name].billableHours += e.duration / 60;
          tkMap[name].value += (e.duration / 60) * toNum(e.rate);
        } else {
          tkMap[name].nonBillableHours += e.duration / 60;
        }
      }
      const hoursByTimekeeper = Object.values(tkMap).map((t) => ({
        ...t,
        billableHours: Math.round(t.billableHours * 100) / 100,
        nonBillableHours: Math.round(t.nonBillableHours * 100) / 100,
        value: Math.round(t.value * 100) / 100,
        utilization: (t.billableHours + t.nonBillableHours) > 0
          ? Math.round((t.billableHours / (t.billableHours + t.nonBillableHours)) * 1000) / 10
          : 0,
      })).sort((a, b) => b.billableHours - a.billableHours);

      // Hours by practice area
      const paMap: Record<string, { hours: number; value: number }> = {};
      for (const e of current.entries) {
        const pa = e.matter?.practiceArea || "Other";
        if (!paMap[pa]) paMap[pa] = { hours: 0, value: 0 };
        paMap[pa].hours += e.duration / 60;
        if (e.billable) paMap[pa].value += (e.duration / 60) * toNum(e.rate);
      }
      const hoursByPracticeArea = Object.entries(paMap)
        .map(([practiceArea, data]) => ({ practiceArea, hours: Math.round(data.hours * 100) / 100, value: Math.round(data.value * 100) / 100 }))
        .sort((a, b) => b.hours - a.hours);

      return {
        totalHours: current.totalHours,
        billableHours: current.billableHours,
        nonBillableHours: current.nonBillableHours,
        utilizationRate: current.utilizationRate,
        billableValue: current.billableValue,
        realizationRate: current.realizationRate,
        averageHourlyRate: current.averageHourlyRate,
        hoursByDay,
        hoursByMatter,
        hoursByTimekeeper,
        hoursByPracticeArea,
        previousPeriod: {
          totalHours: previous.totalHours,
          billableHours: previous.billableHours,
          utilizationRate: previous.utilizationRate,
          billableValue: previous.billableValue,
          realizationRate: previous.realizationRate,
          averageHourlyRate: previous.averageHourlyRate,
          hoursChange: pctChange(current.totalHours, previous.totalHours),
          billableHoursChange: pctChange(current.billableHours, previous.billableHours),
          utilizationChange: pctChange(current.utilizationRate, previous.utilizationRate),
          valueChange: pctChange(current.billableValue, previous.billableValue),
          realizationChange: pctChange(current.realizationRate, previous.realizationRate),
          rateChange: pctChange(current.averageHourlyRate, previous.averageHourlyRate),
        },
      };
    }),

  matterProductivity: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { start, end } = getDateRange(input?.startDate, input?.endDate);

      const totalOpenMatters = await ctx.db.matter.count({ where: { status: { not: "CLOSED" } } });
      const newMattersOpened = await ctx.db.matter.count({ where: { openDate: { gte: start, lte: end } } });
      const closedMatters = await ctx.db.matter.findMany({ where: { closeDate: { gte: start, lte: end } } });
      const mattersClosed = closedMatters.length;

      const closedWithDates = closedMatters.filter((m) => m.closeDate && m.openDate);
      const avgMatterDuration = closedWithDates.length > 0
        ? Math.round(closedWithDates.reduce((s, m) => s + (new Date(m.closeDate!).getTime() - new Date(m.openDate).getTime()) / 86400000, 0) / closedWithDates.length)
        : 0;

      // Matters by stage
      const allOpen = await ctx.db.matter.findMany({ where: { status: { not: "CLOSED" } }, select: { pipelineStage: true } });
      const stageMap: Record<string, number> = {};
      for (const m of allOpen) {
        stageMap[m.pipelineStage] = (stageMap[m.pipelineStage] || 0) + 1;
      }
      const mattersByStage = Object.entries(stageMap).map(([stage, count]) => ({ stage, count }));

      // Matters by practice area
      const allMatters = await ctx.db.matter.findMany({ select: { practiceArea: true, status: true } });
      const paMap: Record<string, { open: number; closed: number }> = {};
      for (const m of allMatters) {
        const pa = m.practiceArea || "Other";
        if (!paMap[pa]) paMap[pa] = { open: 0, closed: 0 };
        if (m.status === "CLOSED") paMap[pa].closed++;
        else paMap[pa].open++;
      }
      const mattersByPracticeArea = Object.entries(paMap)
        .map(([practiceArea, data]) => ({ practiceArea, open: data.open, closed: data.closed, total: data.open + data.closed }))
        .sort((a, b) => b.total - a.total);

      // Stale matters (no time entry in 30+ days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
      const openMatters = await ctx.db.matter.findMany({
        where: { status: { not: "CLOSED" } },
        include: { client: true, timeEntries: { orderBy: { date: "desc" }, take: 1 } },
      });
      const staleMatters = openMatters
        .map((m) => {
          const lastEntry = m.timeEntries[0];
          const lastActivity = lastEntry ? new Date(lastEntry.date) : new Date(m.openDate);
          const daysSince = Math.floor((Date.now() - lastActivity.getTime()) / 86400000);
          return { name: m.name, client: m.client?.name || "Unknown", lastActivity, daysSinceActivity: daysSince };
        })
        .filter((m) => m.daysSinceActivity >= 30)
        .sort((a, b) => b.daysSinceActivity - a.daysSinceActivity)
        .slice(0, 20);

      return { totalOpenMatters, newMattersOpened, mattersClosed, avgMatterDuration, mattersByStage, mattersByPracticeArea, staleMatters };
    }),

  cashFlowSummary: publicProcedure
    .input(z.object({ months: z.number().default(12) }).optional())
    .query(async ({ ctx, input }) => {
      const months = input?.months || 12;
      const startDate = new Date(new Date().getFullYear(), new Date().getMonth() - (months - 1), 1);

      const invoices = await ctx.db.invoice.findMany({
        where: { issueDate: { gte: startDate }, status: { in: ["SENT", "PAID", "OVERDUE"] } },
      });
      const payments = await ctx.db.payment.findMany({
        where: { paymentDate: { gte: startDate } },
      });
      const trustTxns = await ctx.db.trustTransaction.findMany({
        where: { transactionDate: { gte: startDate }, isVoided: false },
      });

      const monthlyMap: Record<string, { invoicesSent: number; paymentsReceived: number; trustDeposits: number; trustWithdrawals: number }> = {};
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
        monthlyMap[monthKey(d)] = { invoicesSent: 0, paymentsReceived: 0, trustDeposits: 0, trustWithdrawals: 0 };
      }

      for (const inv of invoices) {
        const mk = monthKey(new Date(inv.issueDate));
        if (monthlyMap[mk]) monthlyMap[mk].invoicesSent += toNum(inv.total);
      }
      for (const p of payments) {
        const mk = monthKey(new Date(p.paymentDate));
        if (monthlyMap[mk]) monthlyMap[mk].paymentsReceived += toNum(p.amount);
      }
      for (const t of trustTxns) {
        const mk = monthKey(new Date(t.transactionDate));
        if (!monthlyMap[mk]) continue;
        if (t.type === "DEPOSIT" || t.type === "TRANSFER_IN") {
          monthlyMap[mk].trustDeposits += toNum(t.amount);
        } else if (t.type === "WITHDRAWAL" || t.type === "TRANSFER_OUT") {
          monthlyMap[mk].trustWithdrawals += toNum(t.amount);
        }
      }

      const monthlyData = Object.entries(monthlyMap).map(([month, data]) => ({
        month,
        invoicesSent: Math.round(data.invoicesSent * 100) / 100,
        paymentsReceived: Math.round(data.paymentsReceived * 100) / 100,
        netCashFlow: Math.round((data.paymentsReceived - data.invoicesSent) * 100) / 100,
        trustDeposits: Math.round(data.trustDeposits * 100) / 100,
        trustWithdrawals: Math.round(data.trustWithdrawals * 100) / 100,
      }));

      const totalInflow = monthlyData.reduce((s, m) => s + m.paymentsReceived + m.trustDeposits, 0);
      const totalOutflow = monthlyData.reduce((s, m) => s + m.trustWithdrawals, 0);

      // Projected: average of last 3 months payments
      const lastThree = monthlyData.slice(-3);
      const projectedNextMonth = lastThree.length > 0
        ? Math.round((lastThree.reduce((s, m) => s + m.paymentsReceived, 0) / lastThree.length) * 100) / 100
        : 0;

      return {
        monthlyData,
        totalInflow: Math.round(totalInflow * 100) / 100,
        totalOutflow: Math.round(totalOutflow * 100) / 100,
        projectedNextMonth,
      };
    }),

  clientMetrics: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { start, end } = getDateRange(input?.startDate, input?.endDate);

      const totalActiveClients = await ctx.db.client.count({ where: { status: "ACTIVE" } });
      const newClients = await ctx.db.client.count({ where: { createdAt: { gte: start, lte: end } } });

      // Clients with activity (time entries or invoices) in period
      const activeTimeEntries = await ctx.db.timeEntry.findMany({
        where: { date: { gte: start, lte: end } },
        select: { matter: { select: { clientId: true } } },
      });
      const activeInvoices = await ctx.db.invoice.findMany({
        where: { issueDate: { gte: start, lte: end } },
        select: { matter: { select: { clientId: true } } },
      });
      const activeClientIds = new Set([
        ...activeTimeEntries.map((e) => e.matter.clientId),
        ...activeInvoices.map((i) => i.matter.clientId),
      ]);
      const clientRetentionRate = totalActiveClients > 0
        ? Math.round((activeClientIds.size / totalActiveClients) * 1000) / 10
        : 0;

      // Revenue per client
      const paidInvoices = await ctx.db.invoice.findMany({
        where: { status: "PAID", paidAt: { gte: start, lte: end } },
      });
      const totalRevenue = paidInvoices.reduce((s, i) => s + toNum(i.total), 0);
      const avgRevenuePerClient = totalActiveClients > 0
        ? Math.round((totalRevenue / totalActiveClients) * 100) / 100
        : 0;

      // Top clients
      const allInvoices = await ctx.db.invoice.findMany({
        where: { status: { in: ["SENT", "PAID", "OVERDUE"] }, issueDate: { gte: start, lte: end } },
        include: { matter: { include: { client: true } } },
      });
      const allEntries = await ctx.db.timeEntry.findMany({
        where: { date: { gte: start, lte: end } },
        include: { matter: { include: { client: true } } },
      });
      const clientData: Record<string, { name: string; revenue: number; hours: number; matters: Set<string>; lastActivity: Date }> = {};
      for (const inv of allInvoices) {
        const name = inv.matter?.client?.name || "Unknown";
        if (!clientData[name]) clientData[name] = { name, revenue: 0, hours: 0, matters: new Set(), lastActivity: new Date(0) };
        clientData[name].revenue += toNum(inv.total);
        clientData[name].matters.add(inv.matterId);
        const d = new Date(inv.issueDate);
        if (d > clientData[name].lastActivity) clientData[name].lastActivity = d;
      }
      for (const e of allEntries) {
        const name = e.matter?.client?.name || "Unknown";
        if (!clientData[name]) clientData[name] = { name, revenue: 0, hours: 0, matters: new Set(), lastActivity: new Date(0) };
        clientData[name].hours += e.duration / 60;
        clientData[name].matters.add(e.matterId);
        const d = new Date(e.date);
        if (d > clientData[name].lastActivity) clientData[name].lastActivity = d;
      }
      const topClients = Object.values(clientData)
        .map((c) => ({ name: c.name, revenue: Math.round(c.revenue * 100) / 100, hours: Math.round(c.hours * 100) / 100, matters: c.matters.size, lastActivity: c.lastActivity }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // Clients by practice area
      const mattersByClient = await ctx.db.matter.findMany({
        where: { client: { status: "ACTIVE" } },
        select: { practiceArea: true, clientId: true },
      });
      const paClientMap: Record<string, Set<string>> = {};
      for (const m of mattersByClient) {
        const pa = m.practiceArea || "Other";
        if (!paClientMap[pa]) paClientMap[pa] = new Set();
        paClientMap[pa].add(m.clientId);
      }
      const clientsByPracticeArea = Object.entries(paClientMap)
        .map(([practiceArea, ids]) => ({ practiceArea, count: ids.size }))
        .sort((a, b) => b.count - a.count);

      // At-risk clients
      const sixtyDaysAgo = new Date(Date.now() - 60 * 86400000);
      const activeClients = await ctx.db.client.findMany({
        where: { status: "ACTIVE" },
        include: {
          matters: {
            include: {
              invoices: { where: { status: "OVERDUE" }, take: 1 },
              timeEntries: { orderBy: { date: "desc" }, take: 1 },
            },
          },
        },
      });
      const atRiskClients = activeClients
        .map((c) => {
          const overdueInvoices = c.matters.flatMap((m) => m.invoices);
          const lastEntry = c.matters
            .flatMap((m) => m.timeEntries)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
          const lastActivity = lastEntry ? new Date(lastEntry.date) : new Date(c.createdAt);
          const noRecentActivity = lastActivity < sixtyDaysAgo;
          const hasOverdue = overdueInvoices.length > 0;
          const outstandingAmount = overdueInvoices.reduce((s, i) => s + toNum(i.total) - toNum(i.amountPaid), 0);
          if (!noRecentActivity && !hasOverdue) return null;
          return {
            name: c.name,
            issue: hasOverdue ? "Overdue invoice" : "No recent activity",
            lastActivity,
            outstandingAmount: Math.round(outstandingAmount * 100) / 100,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.outstandingAmount - a.outstandingAmount)
        .slice(0, 15);

      return { totalActiveClients, newClients, clientRetentionRate, avgRevenuePerClient, topClients, clientsByPracticeArea, atRiskClients };
    }),

  goalTracking: publicProcedure
    .input(z.object({ period: z.enum(["monthly", "quarterly", "yearly"]).default("monthly") }).optional())
    .query(async ({ ctx, input }) => {
      const period = input?.period || "monthly";
      const now = new Date();
      let start: Date;
      let periodLabel: string;

      switch (period) {
        case "monthly":
          start = new Date(now.getFullYear(), now.getMonth(), 1);
          periodLabel = "This Month";
          break;
        case "quarterly":
          const qm = Math.floor(now.getMonth() / 3) * 3;
          start = new Date(now.getFullYear(), qm, 1);
          periodLabel = "This Quarter";
          break;
        case "yearly":
          start = new Date(now.getFullYear(), 0, 1);
          periodLabel = "This Year";
          break;
      }

      const annualTarget = 500000;
      const monthlyHoursTarget = 150;
      const monthlyClientTarget = 5;

      const revenueDivisor = period === "monthly" ? 12 : period === "quarterly" ? 4 : 1;
      const hoursDivisor = period === "monthly" ? 1 : period === "quarterly" ? 1 / 3 : 1 / 12;
      const clientDivisor = period === "monthly" ? 1 : period === "quarterly" ? 1 / 3 : 1 / 12;

      const revenueTarget = annualTarget / revenueDivisor;
      const hoursTarget = monthlyHoursTarget / hoursDivisor;
      const clientTarget = monthlyClientTarget / clientDivisor;

      // Actual revenue
      const paidInvoices = await ctx.db.invoice.findMany({
        where: { status: "PAID", paidAt: { gte: start } },
      });
      const actualRevenue = paidInvoices.reduce((s, i) => s + toNum(i.total), 0);

      // Actual hours
      const entries = await ctx.db.timeEntry.findMany({
        where: { date: { gte: start }, billable: true },
      });
      const actualHours = Math.round((entries.reduce((s, e) => s + e.duration, 0) / 60) * 100) / 100;

      // Actual new clients
      const actualClients = await ctx.db.client.count({ where: { createdAt: { gte: start } } });

      const goals = [
        {
          metric: "Revenue",
          target: Math.round(revenueTarget),
          actual: Math.round(actualRevenue * 100) / 100,
          percentage: revenueTarget > 0 ? Math.round((actualRevenue / revenueTarget) * 1000) / 10 : 0,
          onTrack: actualRevenue >= revenueTarget * 0.7,
        },
        {
          metric: "Billable Hours",
          target: Math.round(hoursTarget),
          actual: actualHours,
          percentage: hoursTarget > 0 ? Math.round((actualHours / hoursTarget) * 1000) / 10 : 0,
          onTrack: actualHours >= hoursTarget * 0.7,
        },
        {
          metric: "New Clients",
          target: Math.round(clientTarget),
          actual: actualClients,
          percentage: clientTarget > 0 ? Math.round((actualClients / clientTarget) * 1000) / 10 : 0,
          onTrack: actualClients >= clientTarget * 0.7,
        },
      ];

      return { period: periodLabel, goals };
    }),
});
