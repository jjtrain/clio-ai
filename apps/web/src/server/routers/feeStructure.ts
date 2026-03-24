import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { applyTemplateToMatter, completePhase, calculateContingencyFee, checkBudgetStatus, generateClientFeeExplanation, getEffectiveRate } from "@/lib/fee-structure-engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const feeStructureRouter = router({
  // TEMPLATES
  getTemplates: publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), isActive: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { OR: [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }] };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      if (input.isActive !== undefined) where.isActive = input.isActive;
      return ctx.db.feeStructureTemplate.findMany({ where, orderBy: [{ isDefault: "desc" }, { practiceArea: "asc" }, { name: "asc" }] });
    }),

  getTemplate: publicProcedure.input(z.object({ templateId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.feeStructureTemplate.findUnique({ where: { id: input.templateId } });
  }),

  createTemplate: publicProcedure
    .input(z.object({ name: z.string(), description: z.string().optional(), practiceArea: z.string(), caseType: z.string().optional(), phases: z.any(), contingencySchedule: z.any().optional(), retainerRequired: z.boolean().optional(), retainerAmount: z.number().optional(), retainerType: z.string().optional(), expenseHandling: z.string().optional(), totalEstimate: z.any().optional(), clientFacingDescription: z.string().optional(), isDefault: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.feeStructureTemplate.create({ data: { ...input, isActive: true, firmId: DEFAULT_FIRM_ID } });
    }),

  updateTemplate: publicProcedure
    .input(z.object({ templateId: z.string(), name: z.string().optional(), phases: z.any().optional(), totalEstimate: z.any().optional(), isActive: z.boolean().optional(), isDefault: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { templateId, ...data } = input;
      return ctx.db.feeStructureTemplate.update({ where: { id: templateId }, data });
    }),

  duplicateTemplate: publicProcedure
    .input(z.object({ templateId: z.string(), newName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orig = await ctx.db.feeStructureTemplate.findUnique({ where: { id: input.templateId } });
      if (!orig) throw new Error("Template not found");
      const { id, createdAt, updatedAt, ...data } = orig;
      return ctx.db.feeStructureTemplate.create({ data: { ...data, name: input.newName, isDefault: false } });
    }),

  // MATTER FEE STRUCTURES
  getMatterFeeStructure: publicProcedure.input(z.object({ matterId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.matterFeeStructure.findUnique({ where: { matterId: input.matterId }, include: { phaseCompletions: { orderBy: { createdAt: "asc" } } } });
  }),

  applyTemplate: publicProcedure
    .input(z.object({ matterId: z.string(), templateId: z.string() }))
    .mutation(async ({ input }) => {
      return applyTemplateToMatter(input.matterId, input.templateId, DEFAULT_USER_ID, DEFAULT_FIRM_ID);
    }),

  completePhase: publicProcedure
    .input(z.object({ matterId: z.string(), phaseId: z.string(), recoveryAmount: z.number().optional(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      await completePhase(input.matterId, input.phaseId, { recoveryAmount: input.recoveryAmount, notes: input.notes }, DEFAULT_USER_ID, DEFAULT_FIRM_ID);
      return { success: true };
    }),

  activatePhase: publicProcedure
    .input(z.object({ matterId: z.string(), phaseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const structure = await ctx.db.matterFeeStructure.findUnique({ where: { matterId: input.matterId } });
      if (!structure) throw new Error("Not found");
      const phases = structure.phases as any[];
      const phase = phases.find((p: any) => p.id === input.phaseId);
      if (!phase) throw new Error("Phase not found");

      await ctx.db.phaseCompletion.create({
        data: { feeStructureId: structure.id, phaseId: input.phaseId, phaseName: phase.name, billingModel: phase.billingModel, status: "active", startedAt: new Date(), flatFeeAmount: phase.flatFeeAmount, capAmount: phase.capAmount, userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID },
      });
      await ctx.db.matterFeeStructure.update({ where: { matterId: input.matterId }, data: { currentPhaseId: input.phaseId } });
      return { success: true };
    }),

  skipPhase: publicProcedure
    .input(z.object({ matterId: z.string(), phaseId: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const structure = await ctx.db.matterFeeStructure.findUnique({ where: { matterId: input.matterId } });
      if (!structure) throw new Error("Not found");
      await ctx.db.phaseCompletion.updateMany({ where: { feeStructureId: structure.id, phaseId: input.phaseId }, data: { status: "skipped", skippedAt: new Date(), skipReason: input.reason } });
      return { success: true };
    }),

  // RATES
  getRates: publicProcedure.input(z.object({ matterId: z.string().optional() })).query(async ({ ctx, input }) => {
    const where: any = { firmId: DEFAULT_FIRM_ID };
    if (input.matterId) where.OR = [{ matterId: input.matterId }, { matterId: null }];
    else where.matterId = null;
    return ctx.db.hourlyRateSchedule.findMany({ where, orderBy: [{ role: "asc" }, { effectiveDate: "desc" }] });
  }),

  setRate: publicProcedure
    .input(z.object({ matterId: z.string().optional(), role: z.string(), attorneyId: z.string().optional(), rate: z.number(), effectiveDate: z.date().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.hourlyRateSchedule.create({ data: { ...input, firmId: DEFAULT_FIRM_ID } });
    }),

  getEffectiveRate: publicProcedure
    .input(z.object({ matterId: z.string(), role: z.string() }))
    .query(async ({ input }) => {
      return { rate: await getEffectiveRate(input.matterId, null, input.role, DEFAULT_FIRM_ID) };
    }),

  // CONTINGENCY
  calculateContingency: publicProcedure
    .input(z.object({ matterId: z.string(), recoveryAmount: z.number(), expenses: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      const structure = await ctx.db.matterFeeStructure.findUnique({ where: { matterId: input.matterId } });
      const schedule = (structure?.contingencySchedule as any[]) || [];
      return calculateContingencyFee(schedule, input.recoveryAmount, input.expenses || 0);
    }),

  // BUDGET
  getBudgetStatus: publicProcedure.input(z.object({ matterId: z.string() })).query(async ({ input }) => {
    return checkBudgetStatus(input.matterId);
  }),

  // ESTIMATES
  getEstimates: publicProcedure.input(z.object({ matterId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.feeEstimate.findMany({ where: { matterId: input.matterId }, orderBy: { createdAt: "desc" } });
  }),

  generateClientExplanation: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ input }) => {
      return { explanation: await generateClientFeeExplanation(input.matterId) };
    }),

  // ANALYTICS
  getFeeModelDistribution: publicProcedure.query(async ({ ctx }) => {
    const structures = await ctx.db.matterFeeStructure.findMany({ where: { firmId: DEFAULT_FIRM_ID, status: "active" } });
    const dist: Record<string, number> = {};
    for (const s of structures) {
      const phases = s.phases as any[];
      const models = new Set(phases.map((p: any) => p.billingModel));
      if (models.size === 1) dist[Array.from(models)[0]] = (dist[Array.from(models)[0]] || 0) + 1;
      else dist.hybrid = (dist.hybrid || 0) + 1;
    }
    return dist;
  }),

  getTemplateUsage: publicProcedure.query(async ({ ctx }) => {
    const usage = await ctx.db.matterFeeStructure.groupBy({
      by: ["templateName"],
      _count: { templateName: true },
      where: { firmId: DEFAULT_FIRM_ID },
    });
    return usage.filter((u) => u.templateName).map((u) => ({ template: u.templateName, count: u._count.templateName }));
  }),
});
