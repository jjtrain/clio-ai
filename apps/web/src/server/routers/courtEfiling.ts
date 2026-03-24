import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { createSubmission, validateSubmission, submitSubmission, pollFilingStatuses, getSystemForCourt } from "@/lib/efiling/engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const courtEfilingRouter = router({
  // PLATFORMS
  getPlatforms: publicProcedure.input(z.object({ courtCode: z.string().optional() })).query(async ({ ctx, input }) => {
    const platforms = await ctx.db.eFilingPlatform.findMany({ where: { isActive: true } });
    if (input.courtCode) {
      return platforms.filter((p) => (p.supportedCourts as any[])?.some((c: any) => c.code === input.courtCode));
    }
    return platforms;
  }),

  getPlatformCourts: publicProcedure.input(z.object({ platformCode: z.string() })).query(async ({ ctx, input }) => {
    const platform = await ctx.db.eFilingPlatform.findUnique({ where: { code: input.platformCode } });
    return platform?.supportedCourts || [];
  }),

  // CREDENTIALS
  getCredentials: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.eFilingPlatformCredential.findMany({
      where: { firmId: DEFAULT_FIRM_ID, isActive: true },
      include: { platform: { select: { name: true, code: true } } },
      orderBy: { platform: { name: "asc" } },
    });
  }),

  addCredential: publicProcedure
    .input(z.object({ platformId: z.string(), displayName: z.string(), username: z.string().optional(), password: z.string().optional(), apiKey: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.eFilingPlatformCredential.create({
        data: { ...input, passwordEnc: input.password, apiKeyEnc: input.apiKey, firmId: DEFAULT_FIRM_ID },
      });
    }),

  removeCredential: publicProcedure.input(z.object({ credentialId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.eFilingPlatformCredential.update({ where: { id: input.credentialId }, data: { isActive: false } });
  }),

  // FILINGS
  createFiling: publicProcedure
    .input(z.object({
      matterId: z.string(), courtCode: z.string(), courtName: z.string(), filingType: z.string(), filingTypeName: z.string(),
      description: z.string().optional(), isNewCase: z.boolean().optional(), indexNumber: z.string().optional(),
      documents: z.array(z.object({ documentType: z.string(), documentTypeName: z.string(), title: z.string(), fileName: z.string(), fileUrl: z.string(), fileSizeBytes: z.number(), isLeadDocument: z.boolean() })),
    }))
    .mutation(async ({ input }) => {
      return createSubmission({ ...input, filedByUserId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID });
    }),

  validateFiling: publicProcedure.input(z.object({ submissionId: z.string() })).mutation(async ({ input }) => {
    return validateSubmission(input.submissionId);
  }),

  estimateFee: publicProcedure.input(z.object({ submissionId: z.string() })).query(async ({ ctx, input }) => {
    const sub = await ctx.db.eFilingSubmissionRecord.findUnique({ where: { id: input.submissionId }, include: { platform: true, documents: true } });
    if (!sub) throw new Error("Not found");
    const { getAdapter } = await import("@/lib/efiling/engine");
    const adapter = getAdapter(sub.platform.code);
    return adapter.estimateFee(sub, sub.documents, null);
  }),

  submitFiling: publicProcedure.input(z.object({ submissionId: z.string() })).mutation(async ({ input }) => {
    return submitSubmission(input.submissionId, DEFAULT_USER_ID);
  }),

  getFiling: publicProcedure.input(z.object({ submissionId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.eFilingSubmissionRecord.findUnique({ where: { id: input.submissionId }, include: { platform: { select: { name: true, code: true } }, documents: true } });
  }),

  getFilings: publicProcedure.input(z.object({ matterId: z.string().optional(), status: z.string().optional(), limit: z.number().optional().default(30) }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.matterId) where.matterId = input.matterId;
      if (input.status) where.status = input.status;
      return ctx.db.eFilingSubmissionRecord.findMany({
        where, include: { platform: { select: { name: true, code: true } }, _count: { select: { documents: true } } },
        orderBy: { createdAt: "desc" }, take: input.limit,
      });
    }),

  cancelFiling: publicProcedure.input(z.object({ submissionId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.eFilingSubmissionRecord.update({ where: { id: input.submissionId }, data: { status: "CANCELLED" } });
  }),

  // STATUS POLLING
  pollStatuses: publicProcedure.mutation(async () => { return pollFilingStatuses(DEFAULT_FIRM_ID); }),

  // ALERTS
  getAlerts: publicProcedure.input(z.object({ unreadOnly: z.boolean().optional() })).query(async ({ ctx, input }) => {
    const where: any = { firmId: DEFAULT_FIRM_ID };
    if (input.unreadOnly) where.isRead = false;
    return ctx.db.eFilingAlert.findMany({ where, orderBy: { createdAt: "desc" }, take: 20 });
  }),

  markAlertRead: publicProcedure.input(z.object({ alertId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.eFilingAlert.update({ where: { id: input.alertId }, data: { isRead: true } });
  }),

  // DASHBOARD STATS
  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const all = await ctx.db.eFilingSubmissionRecord.findMany({ where: { firmId: DEFAULT_FIRM_ID, createdAt: { gte: thirtyDaysAgo } } });
    return {
      totalFiled: all.length,
      pending: all.filter((f) => ["SUBMITTED", "PENDING_REVIEW"].includes(f.status)).length,
      accepted: all.filter((f) => f.status === "ACCEPTED").length,
      rejected: all.filter((f) => f.status === "REJECTED").length,
      totalFees: all.reduce((s, f) => s + (f.actualFee || f.estimatedFee || 0), 0),
    };
  }),

  // SYSTEM LOOKUP
  getSystemForCourt: publicProcedure.input(z.object({ courtCode: z.string() })).query(async ({ input }) => {
    return getSystemForCourt(input.courtCode);
  }),
});
