import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { calculateChildSupport, calculateMaintenance, getFormulaVersion, getCurrentCaps, SUPPORTED_JURISDICTIONS } from "@/lib/calculators";

export const supportCalculatorRouter = router({
  calculate: publicProcedure
    .input(z.object({ inputs: z.any(), calcType: z.string(), jurisdiction: z.string() }))
    .mutation(({ input }) => {
      if (input.calcType === "CHILD_SUPPORT") return { childSupport: calculateChildSupport(input.inputs, input.jurisdiction) };
      if (input.calcType === "MAINTENANCE") return { maintenance: calculateMaintenance(input.inputs, input.jurisdiction) };
      return {
        childSupport: calculateChildSupport(input.inputs, input.jurisdiction),
        maintenance: calculateMaintenance(input.inputs, input.jurisdiction),
      };
    }),

  saveCalculation: publicProcedure
    .input(z.object({ matterId: z.string(), label: z.string(), inputs: z.any(), results: z.any(), calcType: z.string(), jurisdiction: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.supportCalculation.create({
        data: {
          matterId: input.matterId, label: input.label, inputs: input.inputs, results: input.results,
          calculationType: input.calcType as any, jurisdiction: input.jurisdiction,
          formulaVersion: getFormulaVersion(input.jurisdiction, input.calcType),
          createdById: ctx.session?.userId || null,
        },
      });
    }),

  listCalculations: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.supportCalculation.findMany({ where: { matterId: input.matterId }, orderBy: { createdAt: "desc" } });
    }),

  getCalculation: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.supportCalculation.findUniqueOrThrow({ where: { id: input.id } })),

  updateLabel: publicProcedure
    .input(z.object({ id: z.string(), label: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.supportCalculation.update({ where: { id: input.id }, data: { label: input.label } })),

  updateNotes: publicProcedure
    .input(z.object({ id: z.string(), notes: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.supportCalculation.update({ where: { id: input.id }, data: { notes: input.notes } })),

  pinCalculation: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const calc = await ctx.db.supportCalculation.findUniqueOrThrow({ where: { id: input.id } });
      await ctx.db.supportCalculation.updateMany({ where: { matterId: calc.matterId, isPinned: true }, data: { isPinned: false } });
      return ctx.db.supportCalculation.update({ where: { id: input.id }, data: { isPinned: true } });
    }),

  deleteCalculation: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.supportCalculation.delete({ where: { id: input.id } })),

  duplicateCalculation: publicProcedure
    .input(z.object({ id: z.string(), newLabel: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const orig = await ctx.db.supportCalculation.findUniqueOrThrow({ where: { id: input.id } });
      return ctx.db.supportCalculation.create({
        data: { matterId: orig.matterId, label: input.newLabel, inputs: orig.inputs as any, results: orig.results as any, calculationType: orig.calculationType, jurisdiction: orig.jurisdiction, formulaVersion: orig.formulaVersion },
      });
    }),

  getCapAmounts: publicProcedure
    .input(z.object({ jurisdiction: z.string() }))
    .query(({ input }) => {
      const j = input.jurisdiction.toUpperCase();
      return { childSupport: getCurrentCaps(`${j}_CSSA`) || getCurrentCaps(`${j}_NET_RESOURCES`), maintenance: getCurrentCaps(`${j}_MAINTENANCE`) };
    }),

  getSupportedJurisdictions: publicProcedure.query(() => SUPPORTED_JURISDICTIONS),
});
