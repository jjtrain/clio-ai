import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { attributeReferral, updateReferralStatus, getDashboardStats, generateTrackingCode, generateTrackingUrl } from "@/lib/referral-engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const referralTrackingRouter = router({
  // SOURCES
  getSources: publicProcedure
    .input(z.object({ category: z.string().optional(), isActive: z.boolean().optional(), limit: z.number().optional().default(50) }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.category) where.category = input.category;
      if (input.isActive !== undefined) where.isActive = input.isActive;
      return ctx.db.referralSource.findMany({ where, orderBy: { totalRevenue: "desc" }, take: input.limit, include: { _count: { select: { referralEntries: true } } } });
    }),

  getSource: publicProcedure.input(z.object({ sourceId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.referralSource.findUnique({ where: { id: input.sourceId }, include: { referralEntries: { orderBy: { referralDate: "desc" }, take: 20 } } });
  }),

  createSource: publicProcedure
    .input(z.object({ name: z.string(), sourceType: z.string(), category: z.string(), contactName: z.string().optional(), contactTitle: z.string().optional(), contactFirm: z.string().optional(), contactEmail: z.string().optional(), contactPhone: z.string().optional(), practiceArea: z.string().optional(), referralAgreement: z.boolean().optional(), referralFeeType: z.string().optional(), referralFeeAmount: z.number().optional(), relationship: z.string().optional(), tags: z.any().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const trackingCode = generateTrackingCode(input.contactName || input.name);
      return ctx.db.referralSource.create({ data: { ...input, trackingCode, isActive: true, firmId: DEFAULT_FIRM_ID } });
    }),

  updateSource: publicProcedure
    .input(z.object({ sourceId: z.string(), name: z.string().optional(), relationship: z.string().optional(), notes: z.string().optional(), isActive: z.boolean().optional(), referralAgreement: z.boolean().optional(), referralFeeType: z.string().optional(), referralFeeAmount: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { sourceId, ...data } = input;
      return ctx.db.referralSource.update({ where: { id: sourceId }, data });
    }),

  // REFERRALS
  getReferrals: publicProcedure
    .input(z.object({ sourceId: z.string().optional(), matterId: z.string().optional(), status: z.string().optional(), limit: z.number().optional().default(30) }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.sourceId) where.sourceId = input.sourceId;
      if (input.matterId) where.matterId = input.matterId;
      if (input.status) where.status = input.status;
      return ctx.db.referralEntry.findMany({ where, include: { source: { select: { name: true, sourceType: true, contactName: true } } }, orderBy: { referralDate: "desc" }, take: input.limit });
    }),

  createReferral: publicProcedure
    .input(z.object({ sourceId: z.string(), clientName: z.string(), clientEmail: z.string().optional(), clientPhone: z.string().optional(), practiceArea: z.string().optional(), howHeard: z.string().optional(), howHeardDetail: z.string().optional(), matterId: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const referral = await ctx.db.referralEntry.create({ data: { ...input, status: "lead", userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID } });
      await ctx.db.referralSource.update({ where: { id: input.sourceId }, data: { totalReferrals: { increment: 1 }, lastReferralAt: new Date() } });
      return referral;
    }),

  updateReferralStatus: publicProcedure
    .input(z.object({ referralId: z.string(), status: z.string(), matterId: z.string().optional(), revenue: z.number().optional(), lostReason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const data: any = { status: input.status };
      if (input.matterId) data.matterId = input.matterId;
      if (input.revenue) data.revenue = input.revenue;
      if (input.lostReason) data.lostReason = input.lostReason;
      return ctx.db.referralEntry.update({ where: { id: input.referralId }, data });
    }),

  attributeFromTracking: publicProcedure
    .input(z.object({ trackingCode: z.string().optional(), utmSource: z.string().optional(), utmMedium: z.string().optional(), utmCampaign: z.string().optional(), howHeard: z.string().optional(), howHeardDetail: z.string().optional(), clientName: z.string(), clientEmail: z.string().optional(), practiceArea: z.string().optional() }))
    .mutation(async ({ input }) => {
      return attributeReferral({ ...input, firmId: DEFAULT_FIRM_ID, userId: DEFAULT_USER_ID });
    }),

  // CAMPAIGNS
  getCampaigns: publicProcedure.input(z.object({ status: z.string().optional() })).query(async ({ ctx, input }) => {
    const where: any = { firmId: DEFAULT_FIRM_ID };
    if (input.status) where.status = input.status;
    return ctx.db.referralCampaign.findMany({ where, orderBy: { startDate: "desc" } });
  }),

  createCampaign: publicProcedure
    .input(z.object({ name: z.string(), campaignType: z.string(), channel: z.string().optional(), practiceArea: z.string().optional(), startDate: z.date(), endDate: z.date().optional(), budget: z.number().optional(), utmCampaign: z.string().optional(), goals: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.referralCampaign.create({ data: { ...input, status: "active", firmId: DEFAULT_FIRM_ID } });
    }),

  updateCampaign: publicProcedure
    .input(z.object({ campaignId: z.string(), spent: z.number().optional(), totalLeads: z.number().optional(), totalRetained: z.number().optional(), totalRevenue: z.number().optional(), status: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { campaignId, ...data } = input;
      if (data.spent && data.totalRetained) { (data as any).costPerRetained = data.spent / data.totalRetained; }
      if (data.spent && data.totalLeads) { (data as any).costPerLead = data.spent / data.totalLeads; }
      if (data.spent && data.totalRevenue) { (data as any).roi = Math.round(((data.totalRevenue - data.spent) / data.spent) * 100); }
      return ctx.db.referralCampaign.update({ where: { id: campaignId }, data });
    }),

  // HOW HEARD OPTIONS
  getHowHeardOptions: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.howHeardOption.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });
  }),

  // THANK-YOUS
  getThankYous: publicProcedure
    .input(z.object({ status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.status) where.status = input.status;
      return ctx.db.referralThankYou.findMany({ where, orderBy: { scheduledDate: "asc" } });
    }),

  createThankYou: publicProcedure
    .input(z.object({ sourceId: z.string(), referralId: z.string().optional(), occasion: z.string(), thankYouType: z.string(), scheduledDate: z.date(), content: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.referralThankYou.create({ data: { ...input, status: "scheduled", userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID } });
    }),

  completeThankYou: publicProcedure
    .input(z.object({ thankYouId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.referralThankYou.update({ where: { id: input.thankYouId }, data: { status: "completed", sentAt: new Date() } });
    }),

  // ANALYTICS
  getDashboardStats: publicProcedure.query(async () => {
    return getDashboardStats(DEFAULT_FIRM_ID);
  }),

  getChannelBreakdown: publicProcedure.query(async ({ ctx }) => {
    const sources = await ctx.db.referralSource.groupBy({
      by: ["category"],
      _sum: { totalReferrals: true, totalConverted: true, totalRevenue: true },
      where: { firmId: DEFAULT_FIRM_ID },
    });
    return sources.map((s) => ({ category: s.category, referrals: s._sum.totalReferrals || 0, converted: s._sum.totalConverted || 0, revenue: s._sum.totalRevenue || 0 }));
  }),

  getFunnelData: publicProcedure.query(async ({ ctx }) => {
    const statuses = ["lead", "consultation_scheduled", "consultation_completed", "retained", "active_matter", "matter_closed"];
    const funnel: Record<string, number> = {};
    for (const s of statuses) {
      funnel[s] = await ctx.db.referralEntry.count({ where: { firmId: DEFAULT_FIRM_ID, status: s } });
    }
    return funnel;
  }),
});
