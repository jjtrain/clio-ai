import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { generateFromTemplate, generateWithAI, generateHybrid, updateItemStatus, recalculateCompletion, getOverdueItems } from "@/lib/discovery-engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const discoveryChecklistsRouter = router({
  // GENERATION
  generate: publicProcedure
    .input(z.object({ matterId: z.string(), caseType: z.string(), jurisdiction: z.string(), practiceArea: z.string(), mode: z.enum(["template", "ai", "hybrid"]).optional().default("hybrid"), additionalContext: z.string().optional(), templateId: z.string().optional() }))
    .mutation(async ({ input }) => {
      const params = { ...input, firmId: DEFAULT_FIRM_ID, createdBy: DEFAULT_USER_ID };
      if (input.mode === "ai") return generateWithAI(params);
      if (input.mode === "template") return generateFromTemplate(params);
      return generateHybrid(params);
    }),

  // CHECKLISTS
  getChecklists: publicProcedure
    .input(z.object({ matterId: z.string().optional(), status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.matterId) where.matterId = input.matterId;
      if (input.status) where.status = input.status;
      return ctx.db.discoveryChecklist.findMany({
        where, include: { _count: { select: { items: true } } }, orderBy: { createdAt: "desc" },
      });
    }),

  getChecklist: publicProcedure.input(z.object({ checklistId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.discoveryChecklist.findUnique({
      where: { id: input.checklistId },
      include: { sections: { include: { items: { orderBy: { sequenceNumber: "asc" } } }, orderBy: { sequenceNumber: "asc" } } },
    });
  }),

  updateChecklist: publicProcedure
    .input(z.object({ checklistId: z.string(), title: z.string().optional(), status: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { const { checklistId, ...data } = input; return ctx.db.discoveryChecklist.update({ where: { id: checklistId }, data }); }),

  archiveChecklist: publicProcedure.input(z.object({ checklistId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.discoveryChecklist.update({ where: { id: input.checklistId }, data: { status: "ARCHIVED" } });
  }),

  // ITEMS
  updateItem: publicProcedure
    .input(z.object({ itemId: z.string(), status: z.string().optional(), assignedTo: z.string().optional(), dueDate: z.date().optional(), notes: z.string().optional(), linkedDocId: z.string().optional(), linkedTaskId: z.string().optional(), linkedFilingId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      if (input.status) return updateItemStatus(input.itemId, input.status, DEFAULT_USER_ID, input.notes);
      const { itemId, ...data } = input;
      const item = await ctx.db.discoveryCLItem.update({ where: { id: itemId }, data });
      return item;
    }),

  bulkUpdateItems: publicProcedure
    .input(z.object({ itemIds: z.array(z.string()), status: z.string().optional(), assignedTo: z.string().optional(), dueDate: z.date().optional() }))
    .mutation(async ({ ctx, input }) => {
      const data: any = {};
      if (input.status) data.status = input.status;
      if (input.assignedTo) data.assignedTo = input.assignedTo;
      if (input.dueDate) data.dueDate = input.dueDate;
      const result = await ctx.db.discoveryCLItem.updateMany({ where: { id: { in: input.itemIds } }, data });
      // Recalculate completion for affected checklists
      const items = await ctx.db.discoveryCLItem.findMany({ where: { id: { in: input.itemIds } }, select: { checklistId: true } });
      const checklistIds = Array.from(new Set(items.map((i) => i.checklistId)));
      for (const clId of checklistIds) await recalculateCompletion(clId);
      return { updated: result.count };
    }),

  // AI SUPPLEMENT
  supplementWithAI: publicProcedure
    .input(z.object({ checklistId: z.string() }))
    .mutation(async ({ ctx }) => {
      // In production: re-run AI and add new items
      return { added: 0, message: "AI supplementation would add case-specific items here" };
    }),

  // OVERDUE
  getOverdueItems: publicProcedure.query(async () => { return getOverdueItems(DEFAULT_FIRM_ID); }),

  // TEMPLATES
  getTemplates: publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), caseType: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      return ctx.db.discoveryCLTemplate.findMany({
        where, include: { _count: { select: { sections: true } } }, orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });
    }),

  getTemplate: publicProcedure.input(z.object({ templateId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.discoveryCLTemplate.findUnique({
      where: { id: input.templateId },
      include: { sections: { include: { items: { orderBy: { sequenceNumber: "asc" } } }, orderBy: { sequenceNumber: "asc" } } },
    });
  }),

  createTemplate: publicProcedure
    .input(z.object({ name: z.string(), description: z.string().optional(), practiceArea: z.string(), caseTypes: z.any(), jurisdiction: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.discoveryCLTemplate.create({ data: { ...input, isDefault: false, isSystemTemplate: false, firmId: DEFAULT_FIRM_ID } });
    }),

  // STATS
  getStats: publicProcedure.query(async ({ ctx }) => {
    const active = await ctx.db.discoveryChecklist.count({ where: { firmId: DEFAULT_FIRM_ID, status: "ACTIVE" } });
    const overdue = await getOverdueItems(DEFAULT_FIRM_ID);
    const deficient = await ctx.db.discoveryCLItem.count({ where: { checklist: { firmId: DEFAULT_FIRM_ID }, status: "DEFICIENT" } });
    const respondedThisWeek = await ctx.db.discoveryCLItem.count({
      where: { checklist: { firmId: DEFAULT_FIRM_ID }, status: "RESPONDED", responseReceivedAt: { gte: new Date(Date.now() - 7 * 86400000) } },
    });
    return { activeChecklists: active, overdueItems: overdue.length, deficientResponses: deficient, respondedThisWeek };
  }),
});
