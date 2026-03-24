import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { calculateSettlementScenario, getCaseFinancialSummary, getPortfolioStats } from "@/lib/contingency-engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const contingencyRouter = router({
  // CASES
  getCases: publicProcedure.input(z.object({ status: z.string().optional() })).query(async ({ ctx, input }) => {
    const where: any = { firmId: DEFAULT_FIRM_ID };
    if (input.status) where.status = input.status;
    return ctx.db.contingencyCase.findMany({ where, include: { _count: { select: { expenses: true, liens: true } } }, orderBy: { createdAt: "desc" } });
  }),

  getCase: publicProcedure.input(z.object({ matterId: z.string() })).query(async ({ input }) => {
    return getCaseFinancialSummary(input.matterId);
  }),

  createCase: publicProcedure
    .input(z.object({ matterId: z.string(), matterName: z.string().optional(), clientName: z.string().optional(), caseType: z.string().optional(), incidentDate: z.date().optional(), solDate: z.date().optional(), feePercentage: z.number().optional(), feeBase: z.string().optional(), feeTiers: z.any().optional(), insurancePolicyLimits: z.number().optional(), insuranceCarrier: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.contingencyCase.create({ data: { ...input, userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID } });
    }),

  updateCase: publicProcedure
    .input(z.object({ matterId: z.string(), demandAmount: z.number().optional(), demandDate: z.date().optional(), lastOfferAmount: z.number().optional(), lastOfferDate: z.date().optional(), currentStage: z.string().optional(), settledAmount: z.number().optional(), settledDate: z.date().optional(), status: z.string().optional(), medicalSpecials: z.number().optional(), lostWages: z.number().optional(), settlementTarget: z.any().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { matterId, ...data } = input;
      if (input.currentStage) {
        const ccase = await ctx.db.contingencyCase.findUnique({ where: { matterId } });
        if (ccase?.feeTiers) {
          const tiers = ccase.feeTiers as any[];
          const tier = tiers.find((t) => t.stage === input.currentStage);
          if (tier) (data as any).effectiveFeePercentage = tier.percentage;
        }
      }
      return ctx.db.contingencyCase.update({ where: { matterId }, data });
    }),

  // EXPENSES
  addExpense: publicProcedure
    .input(z.object({ caseId: z.string(), category: z.string(), description: z.string(), vendor: z.string().optional(), amount: z.number(), datePaid: z.date().optional() }))
    .mutation(async ({ ctx, input }) => {
      const expense = await ctx.db.caseExpense.create({ data: { ...input, firmId: DEFAULT_FIRM_ID } });
      await ctx.db.contingencyCase.update({ where: { id: input.caseId }, data: { totalExpensesAdvanced: { increment: input.amount } } });
      return expense;
    }),

  getExpenses: publicProcedure.input(z.object({ caseId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.caseExpense.findMany({ where: { caseId: input.caseId }, orderBy: { datePaid: "desc" } });
  }),

  // LIENS
  addLien: publicProcedure
    .input(z.object({ caseId: z.string(), lienType: z.string(), lienHolder: z.string(), originalAmount: z.number(), status: z.string().optional(), letterOfProtection: z.boolean().optional(), isPriority: z.boolean().optional(), isStatutory: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => { return ctx.db.caseLien.create({ data: { ...input, firmId: DEFAULT_FIRM_ID } }); }),

  updateLien: publicProcedure
    .input(z.object({ lienId: z.string(), negotiatedAmount: z.number().optional(), reductionPercentage: z.number().optional(), reductionMethod: z.string().optional(), status: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { const { lienId, ...data } = input; return ctx.db.caseLien.update({ where: { id: lienId }, data }); }),

  // DAMAGES
  addDamage: publicProcedure
    .input(z.object({ caseId: z.string(), damageType: z.string(), category: z.string(), description: z.string(), amountActual: z.number().optional(), amountLow: z.number().optional(), amountMidpoint: z.number().optional(), amountHigh: z.number().optional(), documentedBy: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { return ctx.db.damageComponent.create({ data: { ...input, firmId: DEFAULT_FIRM_ID } }); }),

  // NEGOTIATIONS
  addNegotiationEvent: publicProcedure
    .input(z.object({ caseId: z.string(), eventType: z.string(), amount: z.number(), date: z.date(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { return ctx.db.negotiationEvent.create({ data: { ...input, firmId: DEFAULT_FIRM_ID } }); }),

  // SCENARIOS
  calculateScenario: publicProcedure
    .input(z.object({ settlementAmount: z.number(), feePercentage: z.number(), feeBase: z.string().optional(), expenses: z.number(), liens: z.number(), totalHours: z.number(), blendedRate: z.number().optional(), feeSplitPercentage: z.number().optional() }))
    .query(({ input }) => {
      return calculateSettlementScenario({ ...input, feeBase: input.feeBase || "gross_recovery", blendedRate: input.blendedRate || 350, feeSplitOurPercentage: input.feeSplitPercentage });
    }),

  saveScenario: publicProcedure
    .input(z.object({ caseId: z.string(), scenarioName: z.string(), settlementAmount: z.number(), feePercentage: z.number(), feeAmount: z.number(), expenses: z.number(), lienTotal: z.number(), clientNet: z.number(), effectiveHourlyRate: z.number().optional(), roi: z.number().optional() }))
    .mutation(async ({ ctx, input }) => { return ctx.db.settlementScenario.create({ data: { ...input, firmId: DEFAULT_FIRM_ID } }); }),

  // MEDICAL PROVIDERS
  addProvider: publicProcedure
    .input(z.object({ caseId: z.string(), providerName: z.string(), providerType: z.string(), facilityName: z.string().optional(), firstVisitDate: z.date().optional(), treatmentOngoing: z.boolean().optional(), totalBilled: z.number().optional(), letterOfProtection: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => { return ctx.db.caseMedicalProvider.create({ data: { ...input, firmId: DEFAULT_FIRM_ID } }); }),

  // INSURANCE
  addPolicy: publicProcedure
    .input(z.object({ caseId: z.string(), policyType: z.string(), carrier: z.string(), policyLimits: z.number(), insured: z.string().optional(), policyNumber: z.string().optional(), claimNumber: z.string().optional(), adjustorName: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { return ctx.db.caseInsurancePolicy.create({ data: { ...input, firmId: DEFAULT_FIRM_ID } }); }),

  // BUDGET
  getBudget: publicProcedure.input(z.object({ caseId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.caseExpenseBudget.findMany({ where: { caseId: input.caseId }, orderBy: { priority: "asc" } });
  }),

  addBudgetItem: publicProcedure
    .input(z.object({ caseId: z.string(), category: z.string(), description: z.string(), estimatedAmount: z.number(), priority: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { return ctx.db.caseExpenseBudget.create({ data: { ...input, firmId: DEFAULT_FIRM_ID } }); }),

  // PORTFOLIO
  getPortfolioStats: publicProcedure.query(async () => { return getPortfolioStats(DEFAULT_FIRM_ID); }),
});
