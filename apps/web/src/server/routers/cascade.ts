import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { executeCascade, previewCascade, rollbackCascade, findCascadesForTrigger, seedDefaultCascades } from "@/lib/cascade-engine";

const DEFAULT_FIRM_ID = "demo-firm";

export const cascadeRouter = router({
  listTemplates: publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), triggerType: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      if (input.triggerType) where.triggerType = input.triggerType;
      return ctx.db.taskCascadeTemplate.findMany({ where, include: { _count: { select: { tasks: true, executionLogs: true } } }, orderBy: [{ practiceArea: "asc" }, { triggerStage: "asc" }] });
    }),

  getTemplate: publicProcedure.input(z.object({ templateId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.taskCascadeTemplate.findUnique({ where: { id: input.templateId }, include: { tasks: { orderBy: { sortOrder: "asc" } } } });
  }),

  createTemplate: publicProcedure
    .input(z.object({ name: z.string(), description: z.string().optional(), practiceArea: z.string(), triggerType: z.string().optional(), triggerStage: z.string().optional(), triggerCondition: z.any().optional(), isDefault: z.boolean().optional(), priority: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.taskCascadeTemplate.create({ data: { ...input, firmId: DEFAULT_FIRM_ID } });
    }),

  updateTemplate: publicProcedure
    .input(z.object({ templateId: z.string(), name: z.string().optional(), description: z.string().optional(), triggerStage: z.string().optional(), isDefault: z.boolean().optional(), isActive: z.boolean().optional(), priority: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { const { templateId, ...data } = input; return ctx.db.taskCascadeTemplate.update({ where: { id: templateId }, data }); }),

  deleteTemplate: publicProcedure.input(z.object({ templateId: z.string() })).mutation(async ({ ctx, input }) => {
    const execCount = await ctx.db.taskCascadeExecution.count({ where: { templateId: input.templateId } });
    if (execCount > 0) return ctx.db.taskCascadeTemplate.update({ where: { id: input.templateId }, data: { isActive: false } });
    return ctx.db.taskCascadeTemplate.delete({ where: { id: input.templateId } });
  }),

  addItem: publicProcedure
    .input(z.object({ templateId: z.string(), title: z.string(), description: z.string().optional(), category: z.string().optional(), relativeDueDays: z.number(), dueDateReference: z.string().optional(), isBusinessDays: z.boolean().optional(), priority: z.string().optional(), estimatedMinutes: z.number().optional(), assigneeType: z.string().optional(), assigneeUserId: z.string().optional(), assigneeRole: z.string().optional(), dependsOnItemId: z.string().optional(), sortOrder: z.number().optional(), tags: z.any().optional(), reminderDaysBefore: z.any().optional(), isOptional: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => { return ctx.db.taskCascadeItem.create({ data: input }); }),

  updateItem: publicProcedure
    .input(z.object({ itemId: z.string(), title: z.string().optional(), description: z.string().optional(), relativeDueDays: z.number().optional(), priority: z.string().optional(), assigneeType: z.string().optional(), dependsOnItemId: z.string().optional(), isOptional: z.boolean().optional(), sortOrder: z.number().optional(), category: z.string().optional(), estimatedMinutes: z.number().optional() }))
    .mutation(async ({ ctx, input }) => { const { itemId, ...data } = input; return ctx.db.taskCascadeItem.update({ where: { id: itemId }, data }); }),

  removeItem: publicProcedure.input(z.object({ itemId: z.string() })).mutation(async ({ ctx, input }) => {
    await ctx.db.taskCascadeItem.updateMany({ where: { dependsOnItemId: input.itemId }, data: { dependsOnItemId: null } });
    return ctx.db.taskCascadeItem.delete({ where: { id: input.itemId } });
  }),

  reorderItems: publicProcedure
    .input(z.object({ templateId: z.string(), itemIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      for (let i = 0; i < input.itemIds.length; i++) {
        await ctx.db.taskCascadeItem.update({ where: { id: input.itemIds[i] }, data: { sortOrder: i } });
      }
      return { reordered: input.itemIds.length };
    }),

  previewExecution: publicProcedure
    .input(z.object({ templateId: z.string(), matterId: z.string(), triggerDate: z.date().optional() }))
    .query(async ({ input }) => { return previewCascade(input); }),

  executeManual: publicProcedure
    .input(z.object({ templateId: z.string(), matterId: z.string(), selectedItemIds: z.array(z.string()).optional(), triggerDate: z.date().optional() }))
    .mutation(async ({ input }) => { return executeCascade({ ...input, executedBy: "attorney" }); }),

  rollback: publicProcedure
    .input(z.object({ executionId: z.string() }))
    .mutation(async ({ input }) => { return rollbackCascade(input.executionId, "attorney"); }),

  getExecutionHistory: publicProcedure
    .input(z.object({ matterId: z.string().optional(), templateId: z.string().optional(), limit: z.number().optional().default(20) }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.matterId) where.matterId = input.matterId;
      if (input.templateId) where.templateId = input.templateId;
      return ctx.db.taskCascadeExecution.findMany({ where, include: { template: { select: { name: true, practiceArea: true } } }, orderBy: { executedAt: "desc" }, take: input.limit });
    }),

  getExecutionDetail: publicProcedure.input(z.object({ executionId: z.string() })).query(async ({ ctx, input }) => {
    const execution = await ctx.db.taskCascadeExecution.findUnique({ where: { id: input.executionId }, include: { template: true } });
    if (!execution) return null;
    const tasks = await ctx.db.task.findMany({ where: { cascadeExecutionId: input.executionId }, orderBy: { dueDate: "asc" } });
    return { execution, tasks };
  }),

  cloneTemplate: publicProcedure
    .input(z.object({ templateId: z.string(), newName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orig = await ctx.db.taskCascadeTemplate.findUnique({ where: { id: input.templateId }, include: { tasks: true } });
      if (!orig) throw new Error("Template not found");
      const clone = await ctx.db.taskCascadeTemplate.create({ data: { name: input.newName, description: orig.description, practiceArea: orig.practiceArea, triggerType: orig.triggerType, triggerStage: orig.triggerStage, isDefault: false, isSystemTemplate: false, firmId: DEFAULT_FIRM_ID } });
      for (const item of orig.tasks) {
        const { id, templateId, createdAt, updatedAt, ...data } = item;
        await ctx.db.taskCascadeItem.create({ data: { ...data, templateId: clone.id } });
      }
      return clone;
    }),

  seedDefaults: publicProcedure.mutation(async () => {
    const count = await seedDefaultCascades(DEFAULT_FIRM_ID);
    return { seeded: count };
  }),

  getAvailableCascades: publicProcedure.input(z.object({ matterId: z.string() })).query(async ({ ctx, input }) => {
    const matter = await ctx.db.matter.findUnique({ where: { id: input.matterId } });
    if (!matter) return [];
    return ctx.db.taskCascadeTemplate.findMany({
      where: { firmId: DEFAULT_FIRM_ID, isActive: true, practiceArea: matter.practiceArea || "" },
      include: { _count: { select: { tasks: true } } },
      orderBy: { triggerStage: "asc" },
    });
  }),
});
