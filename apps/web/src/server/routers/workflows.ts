import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { findBestTemplate, applyTemplate, onStageChange, getWorkflowProgress, cloneTemplate } from "@/lib/workflow-engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const workflowsRouter = router({
  // TEMPLATES
  getTemplates: publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), caseType: z.string().optional(), includeSystem: z.boolean().optional().default(true) }))
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      if (input.caseType) where.caseType = input.caseType;
      if (input.includeSystem) where.OR = [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }];
      else where.firmId = DEFAULT_FIRM_ID;
      return ctx.db.workflowTemplate.findMany({ where, orderBy: [{ isDefault: "desc" }, { usageCount: "desc" }] });
    }),

  getTemplate: publicProcedure.input(z.object({ templateId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.workflowTemplate.findUnique({
      where: { id: input.templateId },
      include: { taskCascades: { orderBy: { sequenceNumber: "asc" } }, documentTemplates: { orderBy: { sequenceNumber: "asc" } }, deadlineRules: { orderBy: { sequenceNumber: "asc" } }, discoveryConfig: true, checklistItems: { orderBy: { sequenceNumber: "asc" } }, automationRules: { orderBy: { sequenceNumber: "asc" } } },
    });
  }),

  createTemplate: publicProcedure
    .input(z.object({ name: z.string(), description: z.string().optional(), practiceArea: z.string(), caseType: z.string(), jurisdiction: z.string().optional(), stagesConfig: z.any(), intakeConfig: z.any().optional(), billingConfig: z.any().optional(), isDefault: z.boolean().optional(), tags: z.any().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.workflowTemplate.create({ data: { ...input, isSystemTemplate: false, firmId: DEFAULT_FIRM_ID, createdBy: DEFAULT_USER_ID } });
    }),

  updateTemplate: publicProcedure
    .input(z.object({ templateId: z.string(), name: z.string().optional(), stagesConfig: z.any().optional(), intakeConfig: z.any().optional(), billingConfig: z.any().optional(), isDefault: z.boolean().optional(), tags: z.any().optional() }))
    .mutation(async ({ ctx, input }) => { const { templateId, ...data } = input; return ctx.db.workflowTemplate.update({ where: { id: templateId }, data: { ...data, version: { increment: 1 } } }); }),

  cloneTemplate: publicProcedure
    .input(z.object({ templateId: z.string(), name: z.string() }))
    .mutation(async ({ input }) => { return cloneTemplate(input.templateId, { name: input.name, firmId: DEFAULT_FIRM_ID, clonedBy: DEFAULT_USER_ID }); }),

  publishTemplate: publicProcedure.input(z.object({ templateId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.workflowTemplate.update({ where: { id: input.templateId }, data: { isPublished: true } });
  }),

  rateTemplate: publicProcedure
    .input(z.object({ templateId: z.string(), rating: z.number().min(1).max(5), review: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.wFTemplateRating.upsert({
        where: { templateId_firmId: { templateId: input.templateId, firmId: DEFAULT_FIRM_ID } },
        create: { templateId: input.templateId, firmId: DEFAULT_FIRM_ID, rating: input.rating, review: input.review },
        update: { rating: input.rating, review: input.review },
      });
      // Recalculate avg rating
      const ratings = await ctx.db.wFTemplateRating.findMany({ where: { templateId: input.templateId } });
      const avg = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
      await ctx.db.workflowTemplate.update({ where: { id: input.templateId }, data: { rating: avg, ratingCount: ratings.length } });
      return { success: true };
    }),

  // APPLY
  findBestTemplate: publicProcedure
    .input(z.object({ practiceArea: z.string(), caseType: z.string(), jurisdiction: z.string().optional() }))
    .query(async ({ input }) => { return findBestTemplate({ ...input, firmId: DEFAULT_FIRM_ID }); }),

  apply: publicProcedure
    .input(z.object({ matterId: z.string(), templateId: z.string().optional(), practiceArea: z.string().optional(), caseType: z.string().optional(), jurisdiction: z.string().optional() }))
    .mutation(async ({ input }) => {
      let templateId = input.templateId;
      if (!templateId && input.practiceArea && input.caseType) {
        const best = await findBestTemplate({ practiceArea: input.practiceArea, caseType: input.caseType, jurisdiction: input.jurisdiction, firmId: DEFAULT_FIRM_ID });
        if (best) templateId = best.id;
      }
      if (!templateId) throw new Error("No workflow template found");
      return applyTemplate({ matterId: input.matterId, templateId, appliedBy: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID });
    }),

  // MATTER WORKFLOW
  getMatterWorkflow: publicProcedure.input(z.object({ matterId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.matterWorkflowInstance.findUnique({
      where: { matterId: input.matterId },
      include: { workflowTemplate: { select: { name: true, stagesConfig: true, practiceArea: true } } },
    });
  }),

  getProgress: publicProcedure.input(z.object({ matterId: z.string() })).query(async ({ input }) => { return getWorkflowProgress(input.matterId); }),

  advanceStage: publicProcedure
    .input(z.object({ matterId: z.string(), toStage: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const workflow = await ctx.db.matterWorkflowInstance.findUnique({ where: { matterId: input.matterId } });
      if (!workflow) throw new Error("No workflow on this matter");
      await onStageChange({ matterId: input.matterId, fromStage: workflow.currentStage || "", toStage: input.toStage, changedBy: DEFAULT_USER_ID });
      return { success: true };
    }),

  // EXECUTION LOG
  getExecutionLog: publicProcedure
    .input(z.object({ matterId: z.string(), limit: z.number().optional().default(50) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.wFExecutionEvent.findMany({ where: { matterId: input.matterId }, orderBy: { createdAt: "desc" }, take: input.limit });
    }),

  // LIBRARY
  getLibrary: publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), sort: z.string().optional().default("usage") }))
    .query(async ({ ctx, input }) => {
      const where: any = { isPublished: true };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      const orderBy = input.sort === "rating" ? { rating: "desc" as const } : input.sort === "newest" ? { createdAt: "desc" as const } : { usageCount: "desc" as const };
      return ctx.db.workflowTemplate.findMany({ where, orderBy, take: 50 });
    }),

  // STATS
  getStats: publicProcedure.query(async ({ ctx }) => {
    const templates = await ctx.db.workflowTemplate.count({ where: { OR: [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }] } });
    const activeWorkflows = await ctx.db.matterWorkflowInstance.count({ where: { firmId: DEFAULT_FIRM_ID, status: "ACTIVE" } });
    const events = await ctx.db.wFExecutionEvent.count({ where: { matterWorkflow: { firmId: DEFAULT_FIRM_ID } } });
    return { templates, activeWorkflows, totalEvents: events };
  }),
});
