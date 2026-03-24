import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { computeWorksheetTotals } from "@/lib/equitable-distribution/calculator";
import { getJurisdictionContext, ASSET_CATEGORIES } from "@/lib/equitable-distribution/jurisdiction-context";

export const equitableDistributionRouter = router({
  getWorksheet: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.equitableWorksheet.findUnique({
        where: { matterId: input.matterId },
        include: { rows: { orderBy: { sortOrder: "asc" } } },
      });
    }),

  createWorksheet: publicProcedure
    .input(z.object({ matterId: z.string(), jurisdiction: z.string().default("NY"), payorLabel: z.string().default("Spouse A"), payeeLabel: z.string().default("Spouse B") }))
    .mutation(async ({ ctx, input }) => {
      const jCtx = getJurisdictionContext(input.jurisdiction);
      return ctx.db.equitableWorksheet.create({
        data: { matterId: input.matterId, jurisdiction: input.jurisdiction, payorLabel: input.payorLabel, payeeLabel: input.payeeLabel, distributionStandard: jCtx.standard, createdById: ctx.session?.userId },
      });
    }),

  updateSettings: publicProcedure
    .input(z.object({ id: z.string(), payorLabel: z.string().optional(), payeeLabel: z.string().optional(), targetPayorShare: z.number().optional(), distributionStandard: z.string().optional(), status: z.string().optional(), notes: z.string().optional(), jurisdiction: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.equitableWorksheet.update({ where: { id }, data });
    }),

  // Row mutations
  addRow: publicProcedure
    .input(z.object({ worksheetId: z.string(), category: z.string(), description: z.string(), isLiability: z.boolean().optional(), classification: z.string().optional(), payorClaimedValue: z.number().optional(), payeeClaimedValue: z.number().optional(), agreedValue: z.number().optional(), titledIn: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const maxOrder = await ctx.db.worksheetRow.findFirst({ where: { worksheetId: input.worksheetId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
      return ctx.db.worksheetRow.create({
        data: { ...input, sortOrder: (maxOrder?.sortOrder || 0) + 1, isLiability: ASSET_CATEGORIES.find((c) => c.value === input.category)?.isLiability || input.isLiability || false },
      });
    }),

  addRows: publicProcedure
    .input(z.object({ worksheetId: z.string(), rows: z.array(z.any()) }))
    .mutation(async ({ ctx, input }) => {
      const maxOrder = await ctx.db.worksheetRow.findFirst({ where: { worksheetId: input.worksheetId }, orderBy: { sortOrder: "desc" }, select: { sortOrder: true } });
      let order = (maxOrder?.sortOrder || 0) + 1;
      const created = [];
      for (const row of input.rows) {
        created.push(await ctx.db.worksheetRow.create({ data: { worksheetId: input.worksheetId, sortOrder: order++, ...row } }));
      }
      return created;
    }),

  updateRow: publicProcedure
    .input(z.object({ id: z.string(), data: z.any() }))
    .mutation(async ({ ctx, input }) => ctx.db.worksheetRow.update({ where: { id: input.id }, data: input.data })),

  updateRowField: publicProcedure
    .input(z.object({ id: z.string(), field: z.string(), value: z.any() }))
    .mutation(async ({ ctx, input }) => ctx.db.worksheetRow.update({ where: { id: input.id }, data: { [input.field]: input.value } })),

  deleteRow: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.worksheetRow.delete({ where: { id: input.id } })),

  reorderRows: publicProcedure
    .input(z.object({ worksheetId: z.string(), rowIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all(input.rowIds.map((id, i) => ctx.db.worksheetRow.update({ where: { id }, data: { sortOrder: i } })));
      return { success: true };
    }),

  bulkUpdateClassification: publicProcedure
    .input(z.object({ rowIds: z.array(z.string()), classification: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.worksheetRow.updateMany({ where: { id: { in: input.rowIds } }, data: { classification: input.classification } })),

  bulkUpdateDisposition: publicProcedure
    .input(z.object({ rowIds: z.array(z.string()), disposition: z.string(), awardedTo: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.worksheetRow.updateMany({ where: { id: { in: input.rowIds } }, data: { disposition: input.disposition, awardedTo: input.awardedTo } })),

  bulkDeleteRows: publicProcedure
    .input(z.object({ rowIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => ctx.db.worksheetRow.deleteMany({ where: { id: { in: input.rowIds } } })),

  // Snapshots
  takeSnapshot: publicProcedure
    .input(z.object({ worksheetId: z.string(), label: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.worksheetRow.findMany({ where: { worksheetId: input.worksheetId }, orderBy: { sortOrder: "asc" } });
      const totals = computeWorksheetTotals(rows as any);
      return ctx.db.worksheetSnapshot.create({
        data: { worksheetId: input.worksheetId, label: input.label, rowsSnapshot: rows as any, summarySnapshot: totals as any, createdById: ctx.session?.userId },
      });
    }),

  getSnapshots: publicProcedure
    .input(z.object({ worksheetId: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.worksheetSnapshot.findMany({ where: { worksheetId: input.worksheetId }, orderBy: { createdAt: "desc" }, select: { id: true, label: true, createdAt: true, summarySnapshot: true } })),

  getSnapshot: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.worksheetSnapshot.findUniqueOrThrow({ where: { id: input.id } })),

  // Utility
  computeTotals: publicProcedure
    .input(z.object({ worksheetId: z.string() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.worksheetRow.findMany({ where: { worksheetId: input.worksheetId } });
      return computeWorksheetTotals(rows as any);
    }),

  getJurisdictionDefaults: publicProcedure
    .input(z.object({ jurisdiction: z.string() }))
    .query(({ input }) => getJurisdictionContext(input.jurisdiction)),

  getAssetCategories: publicProcedure.query(() => ASSET_CATEGORIES),
});
