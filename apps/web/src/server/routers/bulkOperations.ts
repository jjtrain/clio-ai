import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { resolveMatterIds, generatePreview, executeOperation, undoOperation } from "@/lib/bulk-operations-engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const bulkOperationsRouter = router({
  preview: publicProcedure
    .input(z.object({ operationType: z.string(), selectionMode: z.string().optional(), matterIds: z.array(z.string()).optional(), filterCriteria: z.any().optional(), payload: z.any() }))
    .mutation(async ({ ctx, input }) => {
      const ids = await resolveMatterIds({ firmId: DEFAULT_FIRM_ID, selectionMode: input.selectionMode || "manual", matterIds: input.matterIds, filterCriteria: input.filterCriteria });
      const op = await ctx.db.bulkOperation.create({
        data: { firmId: DEFAULT_FIRM_ID, initiatedBy: DEFAULT_USER_ID, operationType: input.operationType, selectionMode: input.selectionMode || "manual", matterIds: ids, filterCriteria: input.filterCriteria, totalSelected: ids.length, payload: input.payload, status: "PREVIEWING" },
      });
      const preview = await generatePreview(op.id);
      return { operationId: op.id, preview };
    }),

  getPreview: publicProcedure.input(z.object({ operationId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.bulkOperation.findUnique({ where: { id: input.operationId } });
  }),

  approve: publicProcedure.input(z.object({ operationId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.bulkOperation.update({ where: { id: input.operationId }, data: { previewApproved: true } });
  }),

  execute: publicProcedure.input(z.object({ operationId: z.string() })).mutation(async ({ input }) => {
    // Run async in production; sync here for simplicity
    await executeOperation(input.operationId);
    return { success: true };
  }),

  getOperation: publicProcedure.input(z.object({ operationId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.bulkOperation.findUnique({ where: { id: input.operationId }, include: { results: { orderBy: { processedAt: "desc" }, take: 50 } } });
  }),

  cancel: publicProcedure.input(z.object({ operationId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.bulkOperation.update({ where: { id: input.operationId }, data: { status: "CANCELLED" } });
  }),

  undo: publicProcedure.input(z.object({ operationId: z.string() })).mutation(async ({ input }) => {
    return undoOperation(input.operationId, DEFAULT_USER_ID);
  }),

  getHistory: publicProcedure.input(z.object({ status: z.string().optional(), limit: z.number().optional().default(20) })).query(async ({ ctx, input }) => {
    const where: any = { firmId: DEFAULT_FIRM_ID };
    if (input.status) where.status = input.status;
    return ctx.db.bulkOperation.findMany({ where, orderBy: { createdAt: "desc" }, take: input.limit });
  }),

  resolveCount: publicProcedure
    .input(z.object({ selectionMode: z.string().optional(), matterIds: z.array(z.string()).optional(), filterCriteria: z.any().optional() }))
    .query(async ({ input }) => {
      const ids = await resolveMatterIds({ firmId: DEFAULT_FIRM_ID, selectionMode: input.selectionMode || "manual", matterIds: input.matterIds, filterCriteria: input.filterCriteria });
      return { count: ids.length };
    }),

  getPresets: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.bulkOperationPreset.findMany({ where: { firmId: DEFAULT_FIRM_ID }, orderBy: { lastRunAt: "desc" } });
  }),

  createPreset: publicProcedure
    .input(z.object({ name: z.string(), description: z.string().optional(), operationType: z.string(), filterCriteria: z.any(), payload: z.any() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.bulkOperationPreset.create({ data: { ...input, firmId: DEFAULT_FIRM_ID, createdBy: DEFAULT_USER_ID } });
    }),

  deletePreset: publicProcedure.input(z.object({ presetId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.bulkOperationPreset.delete({ where: { id: input.presetId } });
  }),
});
