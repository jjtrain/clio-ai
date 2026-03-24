import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { calculateCandidates, quickGenerateInvoice, getInvoiceStats } from "@/lib/quick-invoice-engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const quickInvoiceRouter = router({
  // CANDIDATES
  getCandidates: publicProcedure.input(z.object({ oneTapOnly: z.boolean().optional() })).query(async ({ ctx, input }) => {
    const where: any = { firmId: DEFAULT_FIRM_ID };
    if (input.oneTapOnly) where.isOneTapReady = true;
    return ctx.db.quickInvoiceCandidate.findMany({ where, orderBy: { priority: "desc" } });
  }),

  refreshCandidates: publicProcedure.mutation(async () => {
    const count = await calculateCandidates(DEFAULT_FIRM_ID);
    return { refreshed: count };
  }),

  // QUICK INVOICE
  generateQuickInvoice: publicProcedure
    .input(z.object({ matterId: z.string(), presetId: z.string().optional(), customNote: z.string().optional(), applyTrustCredit: z.boolean().optional(), sendMethod: z.array(z.string()).optional() }))
    .mutation(async ({ input }) => {
      return quickGenerateInvoice({ ...input, userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID });
    }),

  getQuickInvoices: publicProcedure.input(z.object({ limit: z.number().optional().default(20) })).query(async ({ ctx, input }) => {
    return ctx.db.quickInvoice.findMany({ where: { firmId: DEFAULT_FIRM_ID }, orderBy: { createdAt: "desc" }, take: input.limit });
  }),

  // PRESETS
  getPresets: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.quickInvoicePreset.findMany({ where: { firmId: DEFAULT_FIRM_ID }, orderBy: [{ isPinned: "desc" }, { useCount: "desc" }] });
  }),

  createPreset: publicProcedure
    .input(z.object({ name: z.string(), matterId: z.string().optional(), presetType: z.string(), practiceArea: z.string().optional(), autoInclude: z.any().optional(), defaultNote: z.string().optional(), sendMethod: z.any().optional(), applyTrustCredit: z.boolean().optional(), isPinned: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.quickInvoicePreset.create({ data: { ...input, userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID } });
    }),

  updatePreset: publicProcedure
    .input(z.object({ presetId: z.string(), name: z.string().optional(), isPinned: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => { const { presetId, ...data } = input; return ctx.db.quickInvoicePreset.update({ where: { id: presetId }, data }); }),

  deletePreset: publicProcedure.input(z.object({ presetId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.quickInvoicePreset.delete({ where: { id: input.presetId } });
  }),

  // STATS
  getStats: publicProcedure.query(async () => { return getInvoiceStats(DEFAULT_FIRM_ID); }),
});
