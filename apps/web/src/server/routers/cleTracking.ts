import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { initializeRequirements, addCredit, recalculateRequirement, getComplianceSummary, checkAndSendAlerts } from "@/lib/cle-engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const cleTrackingRouter = router({
  getSummary: publicProcedure.query(async () => { return getComplianceSummary(DEFAULT_USER_ID); }),

  getRequirements: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.attorneyCLEReq.findMany({ where: { userId: DEFAULT_USER_ID }, include: { jurisdiction: true }, orderBy: { reportingDeadline: "asc" } });
  }),

  getRequirement: publicProcedure.input(z.object({ reqId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.attorneyCLEReq.findUnique({ where: { id: input.reqId }, include: { jurisdiction: { include: { requirements: true } }, credits: { orderBy: { completedAt: "desc" } } } });
  }),

  initializeRequirements: publicProcedure
    .input(z.object({ jurisdictions: z.array(z.string()) }))
    .mutation(async ({ input }) => { return initializeRequirements(DEFAULT_USER_ID, DEFAULT_FIRM_ID, input.jurisdictions); }),

  updateRequirement: publicProcedure
    .input(z.object({ reqId: z.string(), isExempt: z.boolean().optional(), filedAt: z.date().optional(), filingConfirmationNumber: z.string().optional(), status: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { const { reqId, ...data } = input; return ctx.db.attorneyCLEReq.update({ where: { id: reqId }, data }); }),

  getCredits: publicProcedure.input(z.object({ requirementId: z.string().optional() })).query(async ({ ctx, input }) => {
    const where: any = { userId: DEFAULT_USER_ID };
    if (input.requirementId) where.requirementId = input.requirementId;
    return ctx.db.cLECreditEntry.findMany({ where, orderBy: { completedAt: "desc" } });
  }),

  addCredit: publicProcedure
    .input(z.object({ courseName: z.string(), provider: z.string(), format: z.string(), deliveryMethod: z.string(), completedAt: z.date(), totalCredits: z.number(), creditsByCategory: z.any(), jurisdictions: z.array(z.string()), certificateUrl: z.string().optional(), courseNumber: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ input }) => { return addCredit({ ...input, userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID }); }),

  updateCredit: publicProcedure
    .input(z.object({ creditId: z.string(), courseName: z.string().optional(), totalCredits: z.number().optional(), creditsByCategory: z.any().optional(), certificateUrl: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { creditId, ...data } = input;
      const credit = await ctx.db.cLECreditEntry.update({ where: { id: creditId }, data });
      if (credit.requirementId) await recalculateRequirement(credit.requirementId);
      return credit;
    }),

  deleteCredit: publicProcedure.input(z.object({ creditId: z.string() })).mutation(async ({ ctx, input }) => {
    const credit = await ctx.db.cLECreditEntry.findUnique({ where: { id: input.creditId } });
    await ctx.db.cLECreditEntry.delete({ where: { id: input.creditId } });
    if (credit?.requirementId) await recalculateRequirement(credit.requirementId);
    return { success: true };
  }),

  getJurisdictions: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.cLEJurisdiction.findMany({ where: { isActive: true }, include: { requirements: true }, orderBy: { name: "asc" } });
  }),

  getJurisdiction: publicProcedure.input(z.object({ code: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.cLEJurisdiction.findUnique({ where: { code: input.code }, include: { requirements: true } });
  }),

  getAlerts: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.cLEAlertRecord.findMany({ where: { userId: DEFAULT_USER_ID }, orderBy: { createdAt: "desc" }, take: 20 });
  }),

  markAlertRead: publicProcedure.input(z.object({ alertId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.cLEAlertRecord.update({ where: { id: input.alertId }, data: { isRead: true } });
  }),

  checkAlerts: publicProcedure.mutation(async () => { return checkAndSendAlerts(DEFAULT_USER_ID, DEFAULT_FIRM_ID); }),

  getFirmOverview: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.attorneyCLEReq.findMany({ where: { firmId: DEFAULT_FIRM_ID }, include: { jurisdiction: true }, orderBy: { reportingDeadline: "asc" } });
  }),
});
