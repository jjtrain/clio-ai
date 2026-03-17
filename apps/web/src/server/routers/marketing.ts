import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getEmailStats, getReviewStats, getReputationScore, generateReviewResponse } from "@/lib/marketing-engine";
import { mailchimpTestConnection, mailchimpGetLists, mailchimpGetCampaigns, mailchimpAddMember, constantContactTestConnection, roblyTestConnection, birdeyeTestConnection, birdeyeGetReviews, birdeyeSendReviewRequest, repsightTestConnection, scorpionTestConnection, scorpionGetROI } from "@/lib/integrations/marketing-providers";

const MKT_PROVIDERS = ["MAILCHIMP", "CONSTANT_CONTACT", "ROBLY", "BIRDEYE", "REPSIGHT", "SCORPION"] as const;

function maskKey(k: string | null) { return k ? "****" + k.slice(-4) : null; }

export const marketingRouter = router({
  // ─── Settings ──────────────────────────────────────────────────
  "settings.list": publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.marketingIntegration.findMany({ orderBy: { provider: "asc" } });
    return all.map((i) => ({ ...i, apiKey: maskKey(i.apiKey), apiSecret: maskKey(i.apiSecret), accessToken: i.accessToken ? "***" : null }));
  }),
  "settings.update": publicProcedure
    .input(z.object({ provider: z.enum(MKT_PROVIDERS), displayName: z.string().optional(), apiKey: z.string().optional().nullable(), apiSecret: z.string().optional().nullable(), baseUrl: z.string().optional().nullable(), accountId: z.string().optional().nullable(), dataCenter: z.string().optional().nullable(), businessId: z.string().optional().nullable(), isEnabled: z.boolean().optional(), autoSyncContacts: z.boolean().optional(), syncContactList: z.string().optional().nullable(), settings: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { provider, ...data } = input;
      const clean: any = { ...data };
      if (clean.apiKey?.startsWith("****")) delete clean.apiKey;
      return ctx.db.marketingIntegration.upsert({ where: { provider }, create: { provider, displayName: input.displayName || provider, ...clean }, update: clean });
    }),
  "settings.test": publicProcedure
    .input(z.object({ provider: z.enum(MKT_PROVIDERS) }))
    .mutation(async ({ input }) => {
      const tests: Record<string, () => Promise<any>> = { MAILCHIMP: mailchimpTestConnection, CONSTANT_CONTACT: constantContactTestConnection, ROBLY: roblyTestConnection, BIRDEYE: birdeyeTestConnection, REPSIGHT: repsightTestConnection, SCORPION: scorpionTestConnection };
      return (tests[input.provider] || (() => ({ success: false, error: "Unknown" })))();
    }),

  // ─── Email — Lists ─────────────────────────────────────────────
  "lists.getAll": publicProcedure.query(async ({ ctx }) => ctx.db.emailList.findMany({ orderBy: { name: "asc" } })),
  "lists.syncFromProvider": publicProcedure
    .input(z.object({ provider: z.enum(["MAILCHIMP", "CONSTANT_CONTACT", "ROBLY"]) }))
    .mutation(async ({ ctx, input }) => {
      if (input.provider === "MAILCHIMP") {
        const r = await mailchimpGetLists();
        if (!r.success) return r;
        const lists = (r as any).data?.lists || [];
        for (const l of lists) {
          await ctx.db.emailList.upsert({
            where: { provider_externalListId: { provider: "MAILCHIMP", externalListId: l.id } },
            create: { provider: "MAILCHIMP", externalListId: l.id, name: l.name, memberCount: l.stats?.member_count || 0, unsubscribeCount: l.stats?.unsubscribe_count || 0 },
            update: { name: l.name, memberCount: l.stats?.member_count || 0, unsubscribeCount: l.stats?.unsubscribe_count || 0, lastSyncedAt: new Date() },
          });
        }
        return { success: true, count: lists.length };
      }
      return { success: true, count: 0 };
    }),

  // ─── Email — Campaigns ─────────────────────────────────────────
  "campaigns.list": publicProcedure
    .input(z.object({ provider: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.provider) where.provider = input.provider;
      if (input?.status) where.status = input.status;
      return ctx.db.emailCampaignExternal.findMany({ where, orderBy: { sentAt: "desc" }, take: 50 });
    }),
  "campaigns.syncFromProvider": publicProcedure
    .input(z.object({ provider: z.enum(["MAILCHIMP", "CONSTANT_CONTACT", "ROBLY"]) }))
    .mutation(async ({ ctx, input }) => {
      if (input.provider === "MAILCHIMP") {
        const r = await mailchimpGetCampaigns();
        if (!r.success) return r;
        const campaigns = (r as any).data?.campaigns || [];
        for (const c of campaigns) {
          await ctx.db.emailCampaignExternal.upsert({
            where: { id: c.id }, // using external ID as our ID for simplicity
            create: { provider: "MAILCHIMP", externalCampaignId: c.id, name: c.settings?.title || c.id, subject: c.settings?.subject_line, status: c.status, sentAt: c.send_time ? new Date(c.send_time) : undefined, stats_sent: c.emails_sent || 0, stats_opens: c.report_summary?.opens || 0, stats_uniqueOpens: c.report_summary?.unique_opens || 0, stats_clicks: c.report_summary?.clicks || 0, openRate: c.report_summary?.open_rate, clickRate: c.report_summary?.click_rate },
            update: { status: c.status, stats_sent: c.emails_sent || 0, stats_opens: c.report_summary?.opens || 0, stats_uniqueOpens: c.report_summary?.unique_opens || 0, stats_clicks: c.report_summary?.clicks || 0, openRate: c.report_summary?.open_rate, clickRate: c.report_summary?.click_rate },
          }).catch(() => {}); // skip if ID conflict
        }
        return { success: true, count: campaigns.length };
      }
      return { success: true, count: 0 };
    }),

  // ─── Email — Subscribers ───────────────────────────────────────
  "subscribers.add": publicProcedure
    .input(z.object({ provider: z.enum(["MAILCHIMP", "CONSTANT_CONTACT", "ROBLY"]), listId: z.string(), email: z.string(), firstName: z.string().optional(), lastName: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.provider === "MAILCHIMP") {
        const r = await mailchimpAddMember(input.listId, input);
        if (r.success) {
          await ctx.db.emailSubscriber.create({ data: { provider: "MAILCHIMP", listId: input.listId, email: input.email, firstName: input.firstName, lastName: input.lastName, status: "SUBSCRIBED", subscribedAt: new Date() } });
        }
        return r;
      }
      return { success: false, error: "Provider not supported for direct add" };
    }),

  // ─── Email — Analytics ─────────────────────────────────────────
  "email.stats": publicProcedure.query(async () => getEmailStats()),

  // ─── Reviews — Management ──────────────────────────────────────
  "reviews.list": publicProcedure
    .input(z.object({ platform: z.string().optional(), rating: z.number().optional(), status: z.string().optional(), sentiment: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.platform) where.platform = input.platform;
      if (input?.rating) where.rating = input.rating;
      if (input?.status) where.status = input.status;
      if (input?.sentiment) where.sentiment = input.sentiment;
      return ctx.db.reviewRecord.findMany({ where, orderBy: { reviewDate: "desc" }, take: input?.limit || 50 });
    }),
  "reviews.respond": publicProcedure
    .input(z.object({ reviewId: z.string(), responseText: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.reviewRecord.update({ where: { id: input.reviewId }, data: { responseText: input.responseText, responseDate: new Date(), status: "RESPONDED" } })),
  "reviews.generateResponse": publicProcedure
    .input(z.object({ reviewId: z.string(), tone: z.string().default("professional") }))
    .mutation(async ({ input }) => generateReviewResponse(input.reviewId, input.tone)),
  "reviews.flag": publicProcedure
    .input(z.object({ reviewId: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.reviewRecord.update({ where: { id: input.reviewId }, data: { status: "FLAGGED" } })),
  "reviews.stats": publicProcedure.query(async () => getReviewStats()),
  "reviews.reputation": publicProcedure.query(async () => getReputationScore()),
  "reviews.syncFromProvider": publicProcedure
    .input(z.object({ provider: z.enum(["BIRDEYE", "REPSIGHT", "SCORPION"]) }))
    .mutation(async ({ ctx, input }) => {
      if (input.provider === "BIRDEYE") {
        const r = await birdeyeGetReviews();
        if (!r.success) return r;
        const reviews = (r as any).data || [];
        let created = 0;
        for (const rev of (Array.isArray(reviews) ? reviews : reviews.reviews || [])) {
          const existing = rev.reviewId ? await ctx.db.reviewRecord.findFirst({ where: { externalReviewId: rev.reviewId } }) : null;
          if (!existing) {
            // Find or create platform
            let platform = await ctx.db.reviewPlatform.findFirst({ where: { provider: "BIRDEYE", platform: rev.sourceType || "google" } });
            if (!platform) platform = await ctx.db.reviewPlatform.create({ data: { provider: "BIRDEYE", platform: rev.sourceType || "google" } });
            await ctx.db.reviewRecord.create({
              data: { provider: "BIRDEYE", platformId: platform.id, externalReviewId: rev.reviewId, platform: rev.sourceType || "google", reviewerName: rev.reviewer?.nickName || rev.reviewer?.name, rating: rev.rating || 5, content: rev.comments || rev.text, reviewDate: rev.reviewDate ? new Date(rev.reviewDate) : new Date(), sentiment: (rev.rating || 5) >= 4 ? "POSITIVE" : (rev.rating || 5) >= 3 ? "NEUTRAL" : "NEGATIVE" },
            });
            created++;
          }
        }
        return { success: true, created };
      }
      return { success: true, created: 0 };
    }),

  // ─── Reviews — Requests ────────────────────────────────────────
  "requests.send": publicProcedure
    .input(z.object({ clientId: z.string(), email: z.string(), platform: z.string().default("google"), method: z.string().default("email") }))
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.db.client.findUniqueOrThrow({ where: { id: input.clientId } });
      // Try BirdEye first, then Repsight
      const birdeye = await ctx.db.marketingIntegration.findUnique({ where: { provider: "BIRDEYE" } });
      if (birdeye?.isEnabled) {
        await birdeyeSendReviewRequest({ customerName: client.name, email: input.email, platform: input.platform });
      }
      return ctx.db.reviewRequest.create({
        data: { provider: birdeye?.isEnabled ? "BIRDEYE" : "REPSIGHT", clientId: input.clientId, email: input.email, platform: input.platform, status: "SENT", sentAt: new Date(), sentVia: input.method },
      });
    }),
  "requests.list": publicProcedure
    .input(z.object({ status: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.status) where.status = input.status;
      return ctx.db.reviewRequest.findMany({ where, orderBy: { createdAt: "desc" }, take: input?.limit || 50 });
    }),
  "requests.stats": publicProcedure.query(async ({ ctx }) => {
    const total = await ctx.db.reviewRequest.count();
    const sent = await ctx.db.reviewRequest.count({ where: { status: "SENT" } });
    const completed = await ctx.db.reviewRequest.count({ where: { status: "COMPLETED" } });
    return { total, sent, completed, conversionRate: total > 0 ? (completed / total) * 100 : 0 };
  }),

  // ─── Scorpion ──────────────────────────────────────────────────
  "scorpion.roi": publicProcedure
    .input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional())
    .query(async ({ input }) => scorpionGetROI(input?.from && input?.to ? { from: input.from, to: input.to } : undefined)),

  // ─── Unified Reports ───────────────────────────────────────────
  "reports.overview": publicProcedure.query(async () => {
    const email = await getEmailStats();
    const reviews = await getReviewStats();
    const reputation = await getReputationScore();
    return { email, reviews, reputation };
  }),

  // ─── Dashboard Stats ───────────────────────────────────────────
  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const subscribers = await ctx.db.emailSubscriber.count({ where: { status: "SUBSCRIBED" } });
    const emailStats = await getEmailStats();
    const reviewStats = await getReviewStats();
    const reputation = await getReputationScore();
    const requestStats = await ctx.db.reviewRequest.count({ where: { status: "SENT" } });
    return { subscribers, openRate: emailStats.openRate, totalReviews: reviewStats.totalReviews, avgRating: reviewStats.avgRating, reputationScore: reputation.score, pendingRequests: requestStats };
  }),
});
