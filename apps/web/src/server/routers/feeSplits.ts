import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { calculateFeeSplit, checkEthicsCompliance, processFeeSplitDisbursement, getDashboardStats } from "@/lib/fee-split-engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const feeSplitsRouter = router({
  // AGREEMENTS
  getAgreements: publicProcedure.input(z.object({ matterId: z.string().optional(), status: z.string().optional() })).query(async ({ ctx, input }) => {
    const where: any = { firmId: DEFAULT_FIRM_ID };
    if (input.matterId) where.matterId = input.matterId;
    if (input.status) where.status = input.status;
    return ctx.db.feeSplitAgreement.findMany({ where, include: { participants: true, _count: { select: { disbursements: true } } }, orderBy: { createdAt: "desc" } });
  }),

  getAgreement: publicProcedure.input(z.object({ agreementId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.feeSplitAgreement.findUnique({ where: { id: input.agreementId }, include: { participants: true, disbursements: { orderBy: { createdAt: "desc" } } } });
  }),

  createAgreement: publicProcedure
    .input(z.object({ matterId: z.string(), matterName: z.string().optional(), agreementType: z.string(), templateId: z.string().optional(), referralSourceId: z.string().optional(), splitMethod: z.string().optional(), splitBasis: z.string().optional(), totalFeePercentage: z.number().optional(), tiers: z.any().optional(), participants: z.array(z.object({ role: z.string(), isOurFirm: z.boolean(), firmName: z.string().optional(), attorneyName: z.string().optional(), email: z.string().optional(), barNumber: z.string().optional(), taxId: z.string().optional(), splitPercentage: z.number().optional(), fixedAmount: z.number().optional(), responsibilities: z.any().optional(), disbursementMethod: z.string().optional(), form1099Required: z.boolean().optional() })), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { participants, ...data } = input;
      const agreement = await ctx.db.feeSplitAgreement.create({ data: { ...data, userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID } });
      for (const p of participants) {
        await ctx.db.feeSplitParticipant.create({ data: { agreementId: agreement.id, ...p } });
      }
      return agreement;
    }),

  updateAgreement: publicProcedure.input(z.object({ agreementId: z.string(), status: z.string().optional(), recoveryAmount: z.number().optional(), totalFeeAmount: z.number().optional(), ethicsCompliance: z.any().optional() }))
    .mutation(async ({ ctx, input }) => { const { agreementId, ...data } = input; return ctx.db.feeSplitAgreement.update({ where: { id: agreementId }, data }); }),

  activateAgreement: publicProcedure.input(z.object({ agreementId: z.string() })).mutation(async ({ ctx, input }) => {
    const compliance = await checkEthicsCompliance(input.agreementId);
    if (!compliance.compliant) throw new Error("Ethics compliance requirements not met");
    return ctx.db.feeSplitAgreement.update({ where: { id: input.agreementId }, data: { status: "active", activatedAt: new Date() } });
  }),

  // CALCULATIONS
  calculateSplit: publicProcedure
    .input(z.object({ agreementId: z.string(), recoveryAmount: z.number(), expenses: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const agreement = await ctx.db.feeSplitAgreement.findUnique({ where: { id: input.agreementId }, include: { participants: true } });
      if (!agreement) throw new Error("Agreement not found");
      return calculateFeeSplit({
        recoveryAmount: input.recoveryAmount, totalFeePercentage: agreement.totalFeePercentage || 33.33,
        expenses: input.expenses || 0, splitBasis: agreement.splitBasis,
        participants: agreement.participants.map((p) => ({ id: p.id, splitPercentage: p.splitPercentage || 0, isOurFirm: p.isOurFirm })),
        tiers: agreement.tiers as any[],
      });
    }),

  checkCompliance: publicProcedure.input(z.object({ agreementId: z.string() })).query(async ({ input }) => {
    return checkEthicsCompliance(input.agreementId);
  }),

  // DISBURSEMENTS
  createDisbursement: publicProcedure
    .input(z.object({ agreementId: z.string(), participantId: z.string(), amount: z.number(), description: z.string(), method: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.feeSplitDisbursement.create({ data: { ...input, userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID } });
    }),

  approveDisbursement: publicProcedure.input(z.object({ disbursementId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.feeSplitDisbursement.update({ where: { id: input.disbursementId }, data: { status: "approved", approvedBy: DEFAULT_USER_ID, approvedAt: new Date() } });
  }),

  processDisbursement: publicProcedure.input(z.object({ disbursementId: z.string() })).mutation(async ({ input }) => {
    await processFeeSplitDisbursement(input.disbursementId);
    return { success: true };
  }),

  getPendingDisbursements: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.feeSplitDisbursement.findMany({ where: { firmId: DEFAULT_FIRM_ID, status: { in: ["pending", "approved"] } }, include: { agreement: { select: { matterName: true } } }, orderBy: { createdAt: "desc" } });
  }),

  // TEMPLATES
  getTemplates: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.feeSplitTemplate.findMany({ where: { isActive: true, OR: [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }] }, orderBy: { name: "asc" } });
  }),

  createTemplate: publicProcedure.input(z.object({ name: z.string(), agreementType: z.string(), practiceArea: z.string().optional(), splitMethod: z.string(), splitBasis: z.string(), defaultParticipants: z.any(), tiers: z.any().optional() }))
    .mutation(async ({ ctx, input }) => { return ctx.db.feeSplitTemplate.create({ data: { ...input, isActive: true, firmId: DEFAULT_FIRM_ID } }); }),

  // 1099
  get1099Recipients: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.feeSplitParticipant.findMany({
      where: { form1099Required: true, disbursedAmount: { gt: 600 } },
      include: { agreement: { select: { matterName: true } } },
      orderBy: { attorneyName: "asc" },
    });
  }),

  mark1099Generated: publicProcedure.input(z.object({ participantId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.feeSplitParticipant.update({ where: { id: input.participantId }, data: { form1099Generated: true } });
  }),

  mark1099Sent: publicProcedure.input(z.object({ participantId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.feeSplitParticipant.update({ where: { id: input.participantId }, data: { form1099SentAt: new Date() } });
  }),

  // ORIGINATION
  getOriginationCredits: publicProcedure.input(z.object({ attorneyId: z.string().optional() })).query(async ({ ctx, input }) => {
    const where: any = { firmId: DEFAULT_FIRM_ID };
    if (input.attorneyId) where.attorneyId = input.attorneyId;
    return ctx.db.originationCredit.findMany({ where, orderBy: { totalRevenue: "desc" } });
  }),

  // ANALYTICS
  getDashboardStats: publicProcedure.query(async () => { return getDashboardStats(DEFAULT_FIRM_ID); }),
});
