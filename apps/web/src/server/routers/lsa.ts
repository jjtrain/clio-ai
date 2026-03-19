import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import * as googleLsa from "@/lib/integrations/google-lsa";
import * as engine from "@/lib/lsa-engine";
import { db } from "@/lib/db";

export const lsaRouter = router({
  // ─── Settings ───────────────────────────────────────────────────
  "settings.get": publicProcedure.query(async () => {
    return db.lSAIntegration.findFirst();
  }),
  "settings.update": publicProcedure
    .input(z.object({ id: z.string().optional(), googleAccountId: z.string().optional(), businessName: z.string().optional(), accessToken: z.string().optional().nullable(), refreshToken: z.string().optional().nullable(), webhookSecret: z.string().optional().nullable(), isEnabled: z.boolean().optional(), autoReplyEnabled: z.boolean().optional(), autoDisputeEnabled: z.boolean().optional(), settings: z.any().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.lSAIntegration.upsert({ where: { id: id ?? "default" }, create: { id: id ?? "default", ...data } as any, update: data });
    }),
  "settings.test": publicProcedure.mutation(async () => {
    return googleLsa.testConnection();
  }),
  "settings.getAccount": publicProcedure.query(async () => {
    return googleLsa.getAccount();
  }),
  "settings.updateBudget": publicProcedure
    .input(z.object({ budgetAmountMicros: z.number() }))
    .mutation(async ({ input }) => googleLsa.updateBudget(input.budgetAmountMicros)),
  "settings.getCategories": publicProcedure.query(async () => {
    return googleLsa.getCategories();
  }),
  "settings.toggleCategory": publicProcedure
    .input(z.object({ categoryId: z.string(), enabled: z.boolean() }))
    .mutation(async ({ input }) => googleLsa.toggleCategory(input.categoryId, input.enabled)),

  // ─── Leads ────────────────────────────────────────────────────
  "leads.list": publicProcedure
    .input(z.object({ leadType: z.string().optional(), status: z.string().optional(), chargeStatus: z.string().optional(), categoryName: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.leadType) where.leadType = input.leadType as any;
      if (input?.status) where.status = input.status as any;
      if (input?.chargeStatus) where.chargeStatus = input.chargeStatus as any;
      if (input?.categoryName) where.categoryName = input.categoryName;
      if (input?.dateFrom || input?.dateTo) where.leadCreatedAt = { ...(input?.dateFrom ? { gte: new Date(input.dateFrom) } : {}), ...(input?.dateTo ? { lte: new Date(input.dateTo) } : {}) };
      return db.lSALead.findMany({ where, orderBy: { leadCreatedAt: "desc" }, take: input?.limit || 50 });
    }),
  "leads.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => db.lSALead.findUniqueOrThrow({ where: { id: input.id } })),
  "leads.sync": publicProcedure
    .input(z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional())
    .mutation(async ({ input }) => {
      const leads = await googleLsa.getLeads({ startDate: input?.startDate, endDate: input?.endDate });
      const results = [];
      const leadsData = (leads as any)?.data || leads || [];
      for (const lead of (Array.isArray(leadsData) ? leadsData : [])) {
        const existing = await db.lSALead.findFirst({ where: { externalLeadId: lead.externalLeadId || lead.id || "" } });
        if (!existing) {
          const saved = await engine.processNewLead(lead);
          results.push(saved);
        }
      }
      return { synced: results.length };
    }),
  "leads.process": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => engine.processNewLead(input.id)),
  "leads.getCallRecording": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => googleLsa.getLeadCallRecording(input.id)),
  "leads.getTranscript": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const lead = await db.lSALead.findUniqueOrThrow({ where: { id: input.id } });
      return { transcript: lead.callTranscript };
    }),
  "leads.analyzeQuality": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => engine.analyzeLeadQuality(input.id)),
  "leads.reply": publicProcedure
    .input(z.object({ id: z.string(), message: z.string() }))
    .mutation(async ({ input }) => {
      await googleLsa.replyToMessage(input.id, input.message);
      return db.lSALead.update({ where: { id: input.id }, data: { messageReply: input.message } });
    }),
  "leads.suggestReply": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => engine.suggestAutoReply(input.id)),
  "leads.archive": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => db.lSALead.update({ where: { id: input.id }, data: { status: "ARCHIVED" as any } })),
  "leads.dispute": publicProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input }) => engine.disputeInvalidLead(input.id, input.reason || "other")),
  "leads.assessDispute": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => engine.assessDisputeEligibility(input.id)),
  "leads.convert": publicProcedure
    .input(z.object({ id: z.string(), practiceArea: z.string().optional(), value: z.number().optional() }))
    .mutation(async ({ input }) => engine.convertLeadToClient(input.id, { practiceArea: input.practiceArea, value: input.value })),
  "leads.linkToLead": publicProcedure
    .input(z.object({ id: z.string(), leadId: z.string() }))
    .mutation(async ({ input }) => db.lSALead.update({ where: { id: input.id }, data: { leadId: input.leadId } })),
  "leads.addNote": publicProcedure
    .input(z.object({ id: z.string(), notes: z.string() }))
    .mutation(async ({ input }) => db.lSALead.update({ where: { id: input.id }, data: { notes: input.notes } })),
  "leads.matchExisting": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => engine.matchLeadToExistingClient(input.id)),

  // ─── Reviews ──────────────────────────────────────────────────
  "reviews.list": publicProcedure
    .input(z.object({ rating: z.number().optional(), hasReply: z.boolean().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.rating) where.rating = input.rating;
      if (input?.hasReply !== undefined) where.replyText = input.hasReply ? { not: null } : null;
      if (input?.dateFrom || input?.dateTo) where.reviewDate = { ...(input?.dateFrom ? { gte: new Date(input.dateFrom) } : {}), ...(input?.dateTo ? { lte: new Date(input.dateTo) } : {}) };
      return db.lSAReview.findMany({ where, orderBy: { reviewDate: "desc" }, take: input?.limit || 50 });
    }),
  "reviews.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => db.lSAReview.findUniqueOrThrow({ where: { id: input.id } })),
  "reviews.sync": publicProcedure.mutation(async () => {
    const reviewsResult = await googleLsa.getReviews();
    const reviewsData = (reviewsResult as any)?.data || reviewsResult || [];
    let synced = 0;
    for (const review of (Array.isArray(reviewsData) ? reviewsData : [])) {
      const existing = await db.lSAReview.findFirst({ where: { externalReviewId: review.externalReviewId || review.id } });
      if (!existing) {
        await db.lSAReview.create({ data: { externalReviewId: review.id, reviewerName: review.reviewerName, rating: review.rating || 5, reviewText: review.reviewText, reviewDate: new Date(review.reviewDate || Date.now()) } });
        synced++;
      }
    }
    return { synced };
  }),
  "reviews.reply": publicProcedure
    .input(z.object({ id: z.string(), replyText: z.string() }))
    .mutation(async ({ input }) => {
      await googleLsa.replyToReview(input.id, input.replyText);
      return db.lSAReview.update({ where: { id: input.id }, data: { replyText: input.replyText, replyDate: new Date() } });
    }),
  "reviews.suggestReply": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => engine.generateReviewReply(input.id)),

  // ─── Performance ──────────────────────────────────────────────
  "performance.getCurrent": publicProcedure.query(async () => {
    return db.lSAPerformanceSnapshot.findFirst({ orderBy: { createdAt: "desc" } });
  }),
  "performance.getHistory": publicProcedure
    .input(z.object({ period: z.enum(["day", "week", "month"]).optional(), dateFrom: z.string().optional(), dateTo: z.string().optional(), limit: z.number().default(30) }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.period) where.period = input.period;
      if (input?.dateFrom || input?.dateTo) where.createdAt = { ...(input?.dateFrom ? { gte: new Date(input.dateFrom) } : {}), ...(input?.dateTo ? { lte: new Date(input.dateTo) } : {}) };
      return db.lSAPerformanceSnapshot.findMany({ where, orderBy: { createdAt: "desc" }, take: input?.limit || 30 });
    }),
  "performance.getROI": publicProcedure
    .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ input }) => engine.calculateROI({ start: new Date(input?.dateFrom || Date.now() - 30 * 86400000), end: new Date(input?.dateTo || Date.now()) })),
  "performance.getResponseTime": publicProcedure
    .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ input }) => engine.getResponseTimeAnalysis({ start: new Date(input?.dateFrom || Date.now() - 30 * 86400000), end: new Date(input?.dateTo || Date.now()) })),
  "performance.optimizeBudget": publicProcedure.mutation(async () => {
    return engine.optimizeBudget({ start: new Date(Date.now() - 90 * 86400000), end: new Date() });
  }),
  "performance.snapshot": publicProcedure.mutation(async () => {
    return engine.snapshotPerformance("daily");
  }),
  "performance.compare": publicProcedure
    .input(z.object({ snapshotIdA: z.string(), snapshotIdB: z.string() }))
    .query(async ({ input }) => {
      const [a, b] = await Promise.all([
        db.lSAPerformanceSnapshot.findUniqueOrThrow({ where: { id: input.snapshotIdA } }),
        db.lSAPerformanceSnapshot.findUniqueOrThrow({ where: { id: input.snapshotIdB } }),
      ]);
      return { a, b };
    }),

  // ─── Reports ──────────────────────────────────────────────────
  "reports.leads": publicProcedure
    .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ input }) => engine.generateLeadReport({ start: new Date(input?.dateFrom || Date.now() - 30 * 86400000), end: new Date(input?.dateTo || Date.now()) })),
  "reports.roi": publicProcedure
    .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ input }) => engine.calculateROI({ start: new Date(input?.dateFrom || Date.now() - 30 * 86400000), end: new Date(input?.dateTo || Date.now()) })),
  "reports.responseTime": publicProcedure
    .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ input }) => engine.getResponseTimeAnalysis({ start: new Date(input?.dateFrom || Date.now() - 30 * 86400000), end: new Date(input?.dateTo || Date.now()) })),
  "reports.disputes": publicProcedure
    .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = { chargeStatus: "DISPUTED" as any };
      if (input?.dateFrom || input?.dateTo) where.leadCreatedAt = { ...(input?.dateFrom ? { gte: new Date(input.dateFrom) } : {}), ...(input?.dateTo ? { lte: new Date(input.dateTo) } : {}) };
      return db.lSALead.findMany({ where, orderBy: { leadCreatedAt: "desc" } });
    }),
  "reports.reviews": publicProcedure
    .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.dateFrom || input?.dateTo) where.reviewDate = { ...(input?.dateFrom ? { gte: new Date(input.dateFrom) } : {}), ...(input?.dateTo ? { lte: new Date(input.dateTo) } : {}) };
      const reviews = await db.lSAReview.findMany({ where });
      const total = reviews.length;
      const avgRating = total > 0 ? reviews.reduce((s, r) => s + (r as any).rating, 0) / total : 0;
      const withReply = reviews.filter((r) => (r as any).replyText).length;
      return { total, avgRating, withReply, withoutReply: total - withReply };
    }),
  "reports.conversion": publicProcedure
    .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = { status: "CONVERTED" as any };
      if (input?.dateFrom || input?.dateTo) where.leadCreatedAt = { ...(input?.dateFrom ? { gte: new Date(input.dateFrom) } : {}), ...(input?.dateTo ? { lte: new Date(input.dateTo) } : {}) };
      return db.lSALead.findMany({ where, orderBy: { leadCreatedAt: "desc" } });
    }),
  "reports.budget": publicProcedure.query(async () => {
    return googleLsa.getBudget();
  }),
  "reports.export": publicProcedure
    .input(z.object({ type: z.enum(["leads", "reviews", "performance", "roi"]), format: z.enum(["csv", "pdf", "json"]).default("csv"), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
    .mutation(async ({ input }) => {
      // TODO: implement export generation
      return { url: null, message: `Export of ${input.type} as ${input.format} is not yet implemented` };
    }),
});
