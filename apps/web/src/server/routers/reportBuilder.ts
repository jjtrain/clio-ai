import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { FIELD_REGISTRY, executeReport } from "@/lib/report-engine";
import type { ReportConfig } from "@/lib/report-engine";

export const reportBuilderRouter = router({
  getFieldRegistry: publicProcedure.query(() => {
    return FIELD_REGISTRY;
  }),

  runReport: publicProcedure
    .input(z.object({
      fields: z.array(z.string()).min(1),
      filters: z.array(z.object({
        field: z.string(),
        operator: z.enum(["eq", "neq", "gt", "lt", "gte", "lte", "in", "between", "contains"]),
        value: z.any(),
      })),
      groupBy: z.string().optional(),
      sortBy: z.string().optional(),
      sortDir: z.enum(["asc", "desc"]).optional(),
      chartType: z.enum(["table", "bar", "line", "pie"]).optional(),
      limit: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const config: ReportConfig = {
        fields: input.fields,
        filters: input.filters,
        groupBy: input.groupBy,
        sortBy: input.sortBy,
        sortDir: input.sortDir,
        chartType: input.chartType,
        limit: input.limit,
      };
      return executeReport(config, ctx.session?.firmId || "demo-firm");
    }),

  saveReport: publicProcedure
    .input(z.object({
      id: z.string().optional(),
      name: z.string().min(1),
      description: z.string().optional(),
      config: z.object({
        fields: z.array(z.string()),
        filters: z.array(z.any()),
        groupBy: z.string().optional(),
        sortBy: z.string().optional(),
        sortDir: z.enum(["asc", "desc"]).optional(),
        chartType: z.enum(["table", "bar", "line", "pie"]).optional(),
        limit: z.number().optional(),
      }),
      isTemplate: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const firmId = ctx.session?.firmId || "demo-firm";
      if (input.id) {
        return ctx.db.savedReport.update({
          where: { id: input.id },
          data: {
            name: input.name,
            description: input.description,
            config: input.config as any,
            isTemplate: input.isTemplate,
          },
        });
      }
      return ctx.db.savedReport.create({
        data: {
          firmId,
          name: input.name,
          description: input.description,
          config: input.config as any,
          isTemplate: input.isTemplate || false,
        },
      });
    }),

  listSavedReports: publicProcedure
    .input(z.object({ templatesOnly: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.templatesOnly) where.isTemplate = true;
      return ctx.db.savedReport.findMany({
        where,
        orderBy: { updatedAt: "desc" },
      });
    }),

  getReport: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.savedReport.findUniqueOrThrow({ where: { id: input.id } });
    }),

  deleteReport: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.savedReport.delete({ where: { id: input.id } });
    }),

  duplicateReport: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const r = await ctx.db.savedReport.findUniqueOrThrow({ where: { id: input.id } });
      return ctx.db.savedReport.create({
        data: {
          firmId: r.firmId,
          name: `Copy of ${r.name}`,
          description: r.description,
          config: r.config as any,
          isTemplate: false,
        },
      });
    }),
});
