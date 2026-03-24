import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { snapshotFirmMetrics, rebuildPlatformBenchmarks, getFirmBenchmarks } from "@/lib/benchmark-engine";

const DEFAULT_FIRM_ID = "demo-firm";

export const benchmarksRouter = router({
  getComparison: publicProcedure
    .input(z.object({ period: z.string(), practiceArea: z.string().optional() }))
    .query(async ({ input }) => {
      return getFirmBenchmarks(DEFAULT_FIRM_ID, input.period, input.practiceArea);
    }),

  getPlatformBenchmarks: publicProcedure
    .input(z.object({ period: z.string(), practiceArea: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { period: input.period };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      return ctx.db.platformBenchmark.findMany({ where, orderBy: { metric: "asc" } });
    }),

  getFirmSnapshots: publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.benchmarkSnapshot.findMany({
        where: { firmId: DEFAULT_FIRM_ID, period: input.period },
        orderBy: { metric: "asc" },
      });
    }),

  snapshotFirm: publicProcedure
    .input(z.object({ period: z.string() }))
    .mutation(async ({ input }) => {
      const count = await snapshotFirmMetrics(DEFAULT_FIRM_ID, input.period);
      return { snapshotted: count };
    }),

  rebuildPlatform: publicProcedure
    .input(z.object({ period: z.string() }))
    .mutation(async ({ input }) => {
      const count = await rebuildPlatformBenchmarks(input.period);
      return { benchmarksBuilt: count };
    }),
});
