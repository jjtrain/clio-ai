import { z } from "zod";
import { router, publicProcedure } from "../trpc";

function toNum(val: any): number {
  if (val === null || val === undefined) return 0;
  return typeof val === "number" ? val : parseFloat(val.toString()) || 0;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getDateRange(startDate?: string, endDate?: string) {
  const end = endDate ? new Date(endDate) : new Date();
  const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 86400000);
  return { start, end };
}

function getPreviousPeriod(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return { start: new Date(start.getTime() - ms), end: new Date(start.getTime() - 1) };
}

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

const CHANNEL_MAP: Record<string, string> = {
  "Google Ads": "Digital Advertising",
  "Facebook Ads": "Digital Advertising",
  "Bing Ads": "Digital Advertising",
  Avvo: "Directories",
  "Lawyer.com": "Directories",
  FindLaw: "Directories",
  Justia: "Directories",
  Website: "Organic",
  WEBSITE: "Organic",
  SEO: "Organic",
  Blog: "Organic",
  Referral: "Referral",
  REFERRAL: "Referral",
  "Referral Program": "Referral",
  LIVE_CHAT: "Direct",
  CONTACT_FORM: "Direct",
  INTAKE_FORM: "Direct",
  PHONE: "Direct",
  MANUAL: "Other",
  OTHER: "Other",
  "Direct Mail": "Other",
};

function getChannel(source: string): string {
  return CHANNEL_MAP[source] || "Other";
}

function periodToDateRange(period: string): { start: Date; end: Date } {
  const [y, m] = period.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0, 23, 59, 59);
  return { start, end };
}

export const marketingRoiRouter = router({
  // ── Spend Tracking ──────────────────────────────────────────────────────
  listSpend: publicProcedure
    .input(z.object({ source: z.string().optional(), startPeriod: z.string().optional(), endPeriod: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.source) where.source = input.source;
      if (input?.startPeriod || input?.endPeriod) {
        where.period = {};
        if (input?.startPeriod) where.period.gte = input.startPeriod;
        if (input?.endPeriod) where.period.lte = input.endPeriod;
      }
      return ctx.db.marketingSpend.findMany({ where, orderBy: [{ period: "desc" }, { source: "asc" }] });
    }),

  addSpend: publicProcedure
    .input(z.object({ source: z.string(), amount: z.number(), period: z.string(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.marketingSpend.upsert({
        where: { source_period: { source: input.source, period: input.period } },
        update: { amount: input.amount, notes: input.notes },
        create: { source: input.source, amount: input.amount, period: input.period, notes: input.notes },
      });
    }),

  deleteSpend: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.marketingSpend.delete({ where: { id: input.id } });
    }),

  bulkAddSpend: publicProcedure
    .input(z.array(z.object({ source: z.string(), amount: z.number(), period: z.string() })))
    .mutation(async ({ ctx, input }) => {
      const results = [];
      for (const item of input) {
        const r = await ctx.db.marketingSpend.upsert({
          where: { source_period: { source: item.source, period: item.period } },
          update: { amount: item.amount },
          create: { source: item.source, amount: item.amount, period: item.period },
        });
        results.push(r);
      }
      return results;
    }),

  getSpendByPeriod: publicProcedure
    .input(z.object({ startPeriod: z.string(), endPeriod: z.string() }))
    .query(async ({ ctx, input }) => {
      const records = await ctx.db.marketingSpend.findMany({
        where: { period: { gte: input.startPeriod, lte: input.endPeriod } },
        orderBy: [{ period: "asc" }, { source: "asc" }],
      });
      const byMonth: Record<string, Record<string, number>> = {};
      for (const r of records) {
        if (!byMonth[r.period]) byMonth[r.period] = {};
        byMonth[r.period][r.source] = toNum(r.amount);
      }
      return Object.entries(byMonth).map(([month, sources]) => ({ month, sources, total: Object.values(sources).reduce((s, v) => s + v, 0) }));
    }),

  // ── ROI Analytics ───────────────────────────────────────────────────────
  overview: publicProcedure
    .input(z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { start, end } = getDateRange(input?.startDate, input?.endDate);
      const prev = getPreviousPeriod(start, end);
      const startPeriod = monthKey(start);
      const endPeriod = monthKey(end);

      async function getMetrics(from: Date, to: Date, sp: string, ep: string) {
        const spendRecords = await ctx.db.marketingSpend.findMany({ where: { period: { gte: sp, lte: ep } } });
        const totalSpend = spendRecords.reduce((s, r) => s + toNum(r.amount), 0);

        const leads = await ctx.db.lead.findMany({ where: { createdAt: { gte: from, lte: to } } });
        const totalLeads = leads.length;
        const conversions = leads.filter((l) => l.status === "CONVERTED");
        const totalConversions = conversions.length;
        const costPerLead = totalLeads > 0 ? totalSpend / totalLeads : 0;
        const costPerConversion = totalConversions > 0 ? totalSpend / totalConversions : 0;
        const conversionRate = totalLeads > 0 ? (totalConversions / totalLeads) * 100 : 0;

        // Revenue from new clients acquired in period
        const newClients = await ctx.db.client.findMany({ where: { createdAt: { gte: from, lte: to } } });
        const newClientIds = newClients.map((c) => c.id);
        let totalRevenueFromNewClients = 0;
        if (newClientIds.length > 0) {
          const invoices = await ctx.db.invoice.findMany({
            where: { status: { in: ["SENT", "PAID", "OVERDUE"] }, matter: { clientId: { in: newClientIds } } },
          });
          totalRevenueFromNewClients = invoices.reduce((s, i) => s + toNum(i.total), 0);
        }

        const roi = totalSpend > 0 ? ((totalRevenueFromNewClients - totalSpend) / totalSpend) * 100 : 0;

        return {
          totalSpend: Math.round(totalSpend * 100) / 100,
          totalLeads,
          costPerLead: Math.round(costPerLead * 100) / 100,
          totalConversions,
          costPerConversion: Math.round(costPerConversion * 100) / 100,
          conversionRate: Math.round(conversionRate * 10) / 10,
          totalRevenueFromNewClients: Math.round(totalRevenueFromNewClients * 100) / 100,
          roi: Math.round(roi * 10) / 10,
        };
      }

      const prevStartPeriod = monthKey(prev.start);
      const prevEndPeriod = monthKey(prev.end);
      const current = await getMetrics(start, end, startPeriod, endPeriod);
      const previous = await getMetrics(prev.start, prev.end, prevStartPeriod, prevEndPeriod);

      return {
        ...current,
        previousPeriod: {
          ...previous,
          spendChange: pctChange(current.totalSpend, previous.totalSpend),
          leadsChange: pctChange(current.totalLeads, previous.totalLeads),
          cplChange: pctChange(current.costPerLead, previous.costPerLead),
          conversionRateChange: pctChange(current.conversionRate, previous.conversionRate),
          cpaChange: pctChange(current.costPerConversion, previous.costPerConversion),
          roiChange: pctChange(current.roi, previous.roi),
        },
      };
    }),

  roiBySource: publicProcedure
    .input(z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { start, end } = getDateRange(input?.startDate, input?.endDate);
      const sp = monthKey(start);
      const ep = monthKey(end);

      const spendRecords = await ctx.db.marketingSpend.findMany({ where: { period: { gte: sp, lte: ep } } });
      const leads = await ctx.db.lead.findMany({ where: { createdAt: { gte: start, lte: end } } });

      // Get revenue from converted leads' clients
      const convertedLeads = leads.filter((l) => l.status === "CONVERTED" && l.clientId);
      const clientIds = Array.from(new Set(convertedLeads.map((l) => l.clientId!).filter(Boolean)));
      let invoicesByClient: Record<string, number> = {};
      if (clientIds.length > 0) {
        const invoices = await ctx.db.invoice.findMany({
          where: { status: { in: ["SENT", "PAID", "OVERDUE"] }, matter: { clientId: { in: clientIds } } },
          include: { matter: { select: { clientId: true } } },
        });
        for (const inv of invoices) {
          const cid = inv.matter.clientId;
          invoicesByClient[cid] = (invoicesByClient[cid] || 0) + toNum(inv.total);
        }
      }

      // Map lead source to spend source (some need normalization)
      const allSources = new Set<string>();
      for (const r of spendRecords) allSources.add(r.source);
      for (const l of leads) allSources.add(l.source);

      const results = Array.from(allSources).map((source) => {
        const spend = spendRecords.filter((r) => r.source === source).reduce((s, r) => s + toNum(r.amount), 0);
        const sourceLeads = leads.filter((l) => l.source === source);
        const sourceConversions = sourceLeads.filter((l) => l.status === "CONVERTED");
        const revenue = sourceConversions.reduce((s, l) => s + (l.clientId ? (invoicesByClient[l.clientId] || 0) : 0), 0);
        const leadCount = sourceLeads.length;
        const convCount = sourceConversions.length;

        return {
          source,
          spend: Math.round(spend * 100) / 100,
          leads: leadCount,
          conversions: convCount,
          costPerLead: leadCount > 0 ? Math.round((spend / leadCount) * 100) / 100 : 0,
          costPerConversion: convCount > 0 ? Math.round((spend / convCount) * 100) / 100 : 0,
          revenue: Math.round(revenue * 100) / 100,
          roi: spend > 0 ? Math.round(((revenue - spend) / spend) * 1000) / 10 : revenue > 0 ? 999 : 0,
        };
      });

      return results.sort((a, b) => b.roi - a.roi);
    }),

  roiByChannel: publicProcedure
    .input(z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { start, end } = getDateRange(input?.startDate, input?.endDate);
      const sp = monthKey(start);
      const ep = monthKey(end);

      const spendRecords = await ctx.db.marketingSpend.findMany({ where: { period: { gte: sp, lte: ep } } });
      const leads = await ctx.db.lead.findMany({ where: { createdAt: { gte: start, lte: end } } });
      const convertedLeads = leads.filter((l) => l.status === "CONVERTED" && l.clientId);
      const clientIds = Array.from(new Set(convertedLeads.map((l) => l.clientId!).filter(Boolean)));

      let invoicesByClient: Record<string, number> = {};
      if (clientIds.length > 0) {
        const invoices = await ctx.db.invoice.findMany({
          where: { status: { in: ["SENT", "PAID", "OVERDUE"] }, matter: { clientId: { in: clientIds } } },
          include: { matter: { select: { clientId: true } } },
        });
        for (const inv of invoices) {
          invoicesByClient[inv.matter.clientId] = (invoicesByClient[inv.matter.clientId] || 0) + toNum(inv.total);
        }
      }

      const channelData: Record<string, { spend: number; leads: number; conversions: number; revenue: number }> = {};
      for (const r of spendRecords) {
        const ch = getChannel(r.source);
        if (!channelData[ch]) channelData[ch] = { spend: 0, leads: 0, conversions: 0, revenue: 0 };
        channelData[ch].spend += toNum(r.amount);
      }
      for (const l of leads) {
        const ch = getChannel(l.source);
        if (!channelData[ch]) channelData[ch] = { spend: 0, leads: 0, conversions: 0, revenue: 0 };
        channelData[ch].leads++;
        if (l.status === "CONVERTED") {
          channelData[ch].conversions++;
          if (l.clientId) channelData[ch].revenue += invoicesByClient[l.clientId] || 0;
        }
      }

      return Object.entries(channelData).map(([channel, d]) => ({
        channel,
        spend: Math.round(d.spend * 100) / 100,
        leads: d.leads,
        conversions: d.conversions,
        costPerLead: d.leads > 0 ? Math.round((d.spend / d.leads) * 100) / 100 : 0,
        costPerConversion: d.conversions > 0 ? Math.round((d.spend / d.conversions) * 100) / 100 : 0,
        revenue: Math.round(d.revenue * 100) / 100,
        roi: d.spend > 0 ? Math.round(((d.revenue - d.spend) / d.spend) * 1000) / 10 : d.revenue > 0 ? 999 : 0,
      })).sort((a, b) => b.roi - a.roi);
    }),

  leadSourceTrend: publicProcedure
    .input(z.object({ months: z.number().default(12) }).optional())
    .query(async ({ ctx, input }) => {
      const months = input?.months || 12;
      const startDate = new Date(new Date().getFullYear(), new Date().getMonth() - (months - 1), 1);
      const leads = await ctx.db.lead.findMany({ where: { createdAt: { gte: startDate } }, select: { source: true, createdAt: true } });

      const monthMap: Record<string, Record<string, number>> = {};
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
        monthMap[monthKey(d)] = {};
      }
      for (const l of leads) {
        const mk = monthKey(new Date(l.createdAt));
        if (monthMap[mk]) {
          monthMap[mk][l.source] = (monthMap[mk][l.source] || 0) + 1;
        }
      }

      return Object.entries(monthMap).map(([month, sources]) => ({ month, sources, total: Object.values(sources).reduce((s, v) => s + v, 0) }));
    }),

  conversionTrend: publicProcedure
    .input(z.object({ months: z.number().default(12) }).optional())
    .query(async ({ ctx, input }) => {
      const months = input?.months || 12;
      const startDate = new Date(new Date().getFullYear(), new Date().getMonth() - (months - 1), 1);
      const leads = await ctx.db.lead.findMany({ where: { createdAt: { gte: startDate } }, select: { status: true, createdAt: true } });

      const monthMap: Record<string, { leads: number; conversions: number }> = {};
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
        monthMap[monthKey(d)] = { leads: 0, conversions: 0 };
      }
      for (const l of leads) {
        const mk = monthKey(new Date(l.createdAt));
        if (monthMap[mk]) {
          monthMap[mk].leads++;
          if (l.status === "CONVERTED") monthMap[mk].conversions++;
        }
      }

      return Object.entries(monthMap).map(([month, d]) => ({
        month,
        leads: d.leads,
        conversions: d.conversions,
        rate: d.leads > 0 ? Math.round((d.conversions / d.leads) * 1000) / 10 : 0,
      }));
    }),

  intakeFormRoi: publicProcedure.query(async ({ ctx }) => {
    const templates = await ctx.db.intakeFormTemplate.findMany({
      include: { submissions: true },
    });

    const allLeads = await ctx.db.lead.findMany({
      where: { intakeSubmissionId: { not: null } },
      select: { intakeSubmissionId: true, status: true, clientId: true },
    });

    const convertedClientIds = allLeads.filter((l) => l.status === "CONVERTED" && l.clientId).map((l) => l.clientId!);
    let invoicesByClient: Record<string, number> = {};
    if (convertedClientIds.length > 0) {
      const invoices = await ctx.db.invoice.findMany({
        where: { status: { in: ["SENT", "PAID", "OVERDUE"] }, matter: { clientId: { in: convertedClientIds } } },
        include: { matter: { select: { clientId: true } } },
      });
      for (const inv of invoices) {
        invoicesByClient[inv.matter.clientId] = (invoicesByClient[inv.matter.clientId] || 0) + toNum(inv.total);
      }
    }

    return templates.map((t) => {
      const subIds = new Set(t.submissions.map((s) => s.id));
      const relatedLeads = allLeads.filter((l) => l.intakeSubmissionId && subIds.has(l.intakeSubmissionId));
      const converted = relatedLeads.filter((l) => l.status === "CONVERTED");
      const revenue = converted.reduce((s, l) => s + (l.clientId ? (invoicesByClient[l.clientId] || 0) : 0), 0);

      return {
        formName: t.name,
        practiceArea: t.practiceArea,
        submissions: t.submissions.length,
        leads: relatedLeads.length,
        conversions: converted.length,
        conversionRate: relatedLeads.length > 0 ? Math.round((converted.length / relatedLeads.length) * 1000) / 10 : 0,
        revenue: Math.round(revenue * 100) / 100,
      };
    }).sort((a, b) => b.conversions - a.conversions);
  }),

  campaignRoi: publicProcedure.query(async ({ ctx }) => {
    const campaigns = await ctx.db.emailCampaign.findMany({
      where: { status: { in: ["SENT", "COMPLETED"] } },
      orderBy: { sentAt: "desc" },
      take: 50,
    });

    const allLeads = await ctx.db.lead.findMany({
      select: { id: true, status: true, clientId: true, createdAt: true, source: true },
    });

    const convertedClientIds = allLeads.filter((l) => l.status === "CONVERTED" && l.clientId).map((l) => l.clientId!);
    let invoicesByClient: Record<string, number> = {};
    if (convertedClientIds.length > 0) {
      const invoices = await ctx.db.invoice.findMany({
        where: { status: { in: ["SENT", "PAID", "OVERDUE"] }, matter: { clientId: { in: Array.from(new Set(convertedClientIds)) } } },
        include: { matter: { select: { clientId: true } } },
      });
      for (const inv of invoices) {
        invoicesByClient[inv.matter.clientId] = (invoicesByClient[inv.matter.clientId] || 0) + toNum(inv.total);
      }
    }

    return campaigns.map((c) => {
      const sentDate = c.sentAt || c.scheduledAt;
      // Leads created within 7 days of campaign send
      const relatedLeads = sentDate
        ? allLeads.filter((l) => {
            const created = new Date(l.createdAt).getTime();
            const sent = new Date(sentDate).getTime();
            return created >= sent && created <= sent + 7 * 86400000;
          })
        : [];
      const converted = relatedLeads.filter((l) => l.status === "CONVERTED");
      const revenue = converted.reduce((s, l) => s + (l.clientId ? (invoicesByClient[l.clientId] || 0) : 0), 0);

      return {
        name: c.name,
        type: c.campaignType,
        recipients: c.recipientCount,
        totalSent: c.totalSent,
        sentAt: c.sentAt,
        leadsAttributed: relatedLeads.length,
        conversions: converted.length,
        revenue: Math.round(revenue * 100) / 100,
      };
    });
  }),

  appointmentSourceAnalysis: publicProcedure
    .input(z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { start, end } = getDateRange(input?.startDate, input?.endDate);
      const appointments = await ctx.db.appointment.findMany({
        where: { startTime: { gte: start, lte: end } },
      });

      const groups: Record<string, { count: number; completed: number; noShow: number; totalFee: number }> = {};
      for (const a of appointments) {
        const key = a.practiceArea || "Other";
        if (!groups[key]) groups[key] = { count: 0, completed: 0, noShow: 0, totalFee: 0 };
        groups[key].count++;
        if (a.status === "COMPLETED") groups[key].completed++;
        if (a.status === "NO_SHOW") groups[key].noShow++;
        if (a.paymentStatus === "PAID") groups[key].totalFee += toNum(a.consultationFee);
      }

      return Object.entries(groups).map(([practiceArea, d]) => ({
        practiceArea,
        count: d.count,
        completed: d.completed,
        showRate: d.count > 0 ? Math.round((d.completed / d.count) * 1000) / 10 : 0,
        noShowRate: d.count > 0 ? Math.round((d.noShow / d.count) * 1000) / 10 : 0,
        avgFee: d.completed > 0 ? Math.round((d.totalFee / d.completed) * 100) / 100 : 0,
      })).sort((a, b) => b.count - a.count);
    }),

  clientLifetimeValue: publicProcedure
    .input(z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const { start, end } = getDateRange(input?.startDate, input?.endDate);

      const newClients = await ctx.db.client.findMany({
        where: { createdAt: { gte: start, lte: end } },
        include: {
          matters: { include: { invoices: { where: { status: { in: ["SENT", "PAID", "OVERDUE"] } } }, timeEntries: { orderBy: { date: "desc" }, take: 1 } } },
        },
      });

      // Find lead source for each client
      const clientIds = newClients.map((c) => c.id);
      const leads = await ctx.db.lead.findMany({
        where: { clientId: { in: clientIds } },
        select: { clientId: true, source: true },
      });
      const leadSourceByClient: Record<string, string> = {};
      for (const l of leads) {
        if (l.clientId) leadSourceByClient[l.clientId] = l.source;
      }

      const clientMetrics = newClients.map((c) => {
        const totalRevenue = c.matters.flatMap((m) => m.invoices).reduce((s, i) => s + toNum(i.total), 0);
        const matterCount = c.matters.length;
        const lastActivity = c.matters.flatMap((m) => m.timeEntries).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        const firstMatter = c.matters.sort((a, b) => new Date(a.openDate).getTime() - new Date(b.openDate).getTime())[0];
        const retentionMonths = lastActivity && firstMatter
          ? Math.max(1, Math.round((new Date(lastActivity.date).getTime() - new Date(firstMatter.openDate).getTime()) / (30 * 86400000)))
          : 0;

        return {
          name: c.name,
          revenue: Math.round(totalRevenue * 100) / 100,
          matterCount,
          retentionMonths,
          source: leadSourceByClient[c.id] || "Unknown",
        };
      });

      const total = clientMetrics.length;
      const avgLifetimeRevenue = total > 0 ? Math.round((clientMetrics.reduce((s, c) => s + c.revenue, 0) / total) * 100) / 100 : 0;
      const avgMattersPerClient = total > 0 ? Math.round((clientMetrics.reduce((s, c) => s + c.matterCount, 0) / total) * 10) / 10 : 0;
      const avgRetentionMonths = total > 0 ? Math.round((clientMetrics.reduce((s, c) => s + c.retentionMonths, 0) / total) * 10) / 10 : 0;

      const topClients = clientMetrics.sort((a, b) => b.revenue - a.revenue).slice(0, 10);

      // LTV by source
      const sourceMap: Record<string, { total: number; count: number }> = {};
      for (const c of clientMetrics) {
        if (!sourceMap[c.source]) sourceMap[c.source] = { total: 0, count: 0 };
        sourceMap[c.source].total += c.revenue;
        sourceMap[c.source].count++;
      }
      const ltvBySource = Object.entries(sourceMap)
        .map(([source, d]) => ({ source, avgLtv: Math.round((d.total / d.count) * 100) / 100, clientCount: d.count }))
        .sort((a, b) => b.avgLtv - a.avgLtv);

      return { avgLifetimeRevenue, avgMattersPerClient, avgRetentionMonths, topClients, ltvBySource };
    }),

  projections: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    const recentLeads = await ctx.db.lead.findMany({ where: { createdAt: { gte: threeMonthsAgo } } });
    const recentClients = await ctx.db.client.findMany({ where: { createdAt: { gte: threeMonthsAgo } } });

    // Monthly averages for last 3 months
    const monthlyLeads: number[] = [];
    const monthlyConversions: number[] = [];
    for (let i = 2; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const mLeads = recentLeads.filter((l) => new Date(l.createdAt) >= mStart && new Date(l.createdAt) <= mEnd);
      monthlyLeads.push(mLeads.length);
      monthlyConversions.push(mLeads.filter((l) => l.status === "CONVERTED").length);
    }

    const projectedLeads = Math.round(monthlyLeads.reduce((s, v) => s + v, 0) / 3);
    const projectedConversions = Math.round(monthlyConversions.reduce((s, v) => s + v, 0) / 3);

    // Revenue from new clients (last 3 months)
    const newClientIds = recentClients.map((c) => c.id);
    let monthlyRevenue = 0;
    if (newClientIds.length > 0) {
      const invoices = await ctx.db.invoice.findMany({
        where: { status: { in: ["SENT", "PAID", "OVERDUE"] }, matter: { clientId: { in: newClientIds } } },
      });
      monthlyRevenue = invoices.reduce((s, i) => s + toNum(i.total), 0) / 3;
    }

    // Budget recommendation based on ROI by source
    const spendRecords = await ctx.db.marketingSpend.findMany({
      where: { period: { gte: monthKey(threeMonthsAgo) } },
    });
    const sourceSpend: Record<string, number> = {};
    for (const r of spendRecords) {
      sourceSpend[r.source] = (sourceSpend[r.source] || 0) + toNum(r.amount) / 3;
    }

    const leads = await ctx.db.lead.findMany({ where: { createdAt: { gte: threeMonthsAgo } } });
    const convertedWithClient = leads.filter((l) => l.status === "CONVERTED" && l.clientId);
    const cIds = Array.from(new Set(convertedWithClient.map((l) => l.clientId!)));
    let invByClient: Record<string, number> = {};
    if (cIds.length > 0) {
      const invs = await ctx.db.invoice.findMany({
        where: { status: { in: ["SENT", "PAID", "OVERDUE"] }, matter: { clientId: { in: cIds } } },
        include: { matter: { select: { clientId: true } } },
      });
      for (const inv of invs) {
        invByClient[inv.matter.clientId] = (invByClient[inv.matter.clientId] || 0) + toNum(inv.total);
      }
    }

    const budgetRecommendations = Object.entries(sourceSpend).map(([source, currentSpend]) => {
      const sLeads = leads.filter((l) => l.source === source);
      const sConv = sLeads.filter((l) => l.status === "CONVERTED");
      const sRevenue = sConv.reduce((s, l) => s + (l.clientId ? (invByClient[l.clientId] || 0) : 0), 0) / 3;
      const roi = currentSpend > 0 ? ((sRevenue - currentSpend) / currentSpend) * 100 : 0;
      // Recommend more budget for high-ROI sources
      const multiplier = roi > 200 ? 1.3 : roi > 100 ? 1.1 : roi > 0 ? 1.0 : 0.7;
      return {
        source,
        currentSpend: Math.round(currentSpend * 100) / 100,
        recommendedSpend: Math.round(currentSpend * multiplier * 100) / 100,
        expectedRoi: Math.round(roi * 10) / 10,
      };
    }).sort((a, b) => b.expectedRoi - a.expectedRoi);

    return {
      projectedLeads,
      projectedConversions,
      projectedRevenue: Math.round(monthlyRevenue * 100) / 100,
      budgetRecommendations,
    };
  }),
});
