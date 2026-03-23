import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as predictionEngine from "@/lib/prediction-engine";

export const predictionsRouter = router({
  // ─── Calculate Prediction ───────────────────────────────────────────

  calculate: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        matterName: z.string(),
        practiceArea: z.string(),
        caseType: z.string(),
        jurisdiction: z.string().optional(),
        factorInputs: z.array(
          z.object({
            factorName: z.string(),
            inputValue: z.string(),
            weight: z.number().optional(),
            source: z.string().optional(),
            notes: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      return predictionEngine.calculatePrediction({
        ...input,
        userId: "default",
        firmId: "default",
      });
    }),

  // ─── Retrieval ──────────────────────────────────────────────────────

  getPrediction: publicProcedure
    .input(z.object({ predictionId: z.string() }))
    .query(async ({ input }) => {
      if (input.predictionId === "sample-prediction-1") {
        return predictionEngine.getSamplePrediction();
      }
      const prediction = await (db as any).matterPrediction.findUnique({
        where: { id: input.predictionId },
      });
      if (!prediction) throw new Error("Prediction not found");
      return prediction;
    }),

  getForMatter: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      try {
        const predictions = await (db as any).matterPrediction.findMany({
          where: { matterId: input.matterId },
          orderBy: { createdAt: "desc" },
        });
        return predictions;
      } catch {
        return [];
      }
    }),

  getLatestForMatter: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      try {
        return (db as any).matterPrediction.findFirst({
          where: { matterId: input.matterId },
          orderBy: { createdAt: "desc" },
        });
      } catch {
        return null;
      }
    }),

  getAllPredictions: publicProcedure
    .input(
      z.object({
        practiceArea: z.string().optional(),
        minScore: z.number().optional(),
        maxScore: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const where: Record<string, unknown> = {};
        if (input.practiceArea) where.practiceArea = input.practiceArea;
        if (input.minScore !== undefined || input.maxScore !== undefined) {
          where.overallScore = {};
          if (input.minScore !== undefined) (where.overallScore as any).gte = input.minScore;
          if (input.maxScore !== undefined) (where.overallScore as any).lte = input.maxScore;
        }

        const predictions = await (db as any).matterPrediction.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 50,
        });
        return predictions;
      } catch {
        return [predictionEngine.getSamplePrediction()];
      }
    }),

  deletePrediction: publicProcedure
    .input(z.object({ predictionId: z.string() }))
    .mutation(async ({ input }) => {
      await (db as any).matterFactorInput.deleteMany({
        where: { predictionId: input.predictionId },
      });
      await (db as any).matterPrediction.delete({
        where: { id: input.predictionId },
      });
      return { success: true };
    }),

  // ─── Factors & Benchmarks ──────────────────────────────────────────

  getFactors: publicProcedure
    .input(z.object({ practiceArea: z.string().optional() }))
    .query(async ({ input }) => {
      const factors = predictionEngine.getDefaultFactors();
      if (input.practiceArea) {
        return factors.filter(
          (f) => !f.practiceArea || f.practiceArea === input.practiceArea
        );
      }
      return factors;
    }),

  getBenchmark: publicProcedure
    .input(
      z.object({
        practiceArea: z.string(),
        caseType: z.string(),
      })
    )
    .query(async ({ input }) => {
      return predictionEngine.getBenchmarkForCase(input.practiceArea, input.caseType);
    }),

  getAllBenchmarks: publicProcedure.query(async () => {
    return predictionEngine.getDefaultBenchmarks();
  }),

  // ─── Factor Inputs ─────────────────────────────────────────────────

  getFactorInputs: publicProcedure
    .input(z.object({ predictionId: z.string() }))
    .query(async ({ input }) => {
      try {
        return (db as any).matterFactorInput.findMany({
          where: { predictionId: input.predictionId },
          orderBy: { createdAt: "asc" },
        });
      } catch {
        return [];
      }
    }),

  // ─── Outcome Records ───────────────────────────────────────────────

  recordOutcome: publicProcedure
    .input(
      z.object({
        matterId: z.string().optional(),
        practiceArea: z.string(),
        caseType: z.string(),
        jurisdiction: z.string().optional(),
        outcome: z.string(),
        settlementAmount: z.number().optional(),
        verdictAmount: z.number().optional(),
        durationMonths: z.number().optional(),
        totalCost: z.number().optional(),
        liabilityStrength: z.number().optional(),
        damagesSeverity: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return (db as any).matterOutcomeRecord.create({
        data: {
          ...input,
          isAnonymized: true,
          firmId: "default",
        },
      });
    }),

  getOutcomeStats: publicProcedure
    .input(
      z.object({
        practiceArea: z.string().optional(),
        caseType: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const where: Record<string, unknown> = {};
        if (input.practiceArea) where.practiceArea = input.practiceArea;
        if (input.caseType) where.caseType = input.caseType;

        const records = await (db as any).matterOutcomeRecord.findMany({ where });
        const total = records.length;
        if (total === 0) return null;

        const settlements = records.filter((r: any) => r.outcome === "settlement");
        const trials = records.filter((r: any) => r.outcome.startsWith("trial_"));

        return {
          totalRecords: total,
          settlementRate: Math.round((settlements.length / total) * 100),
          trialRate: Math.round((trials.length / total) * 100),
          avgSettlement: settlements.length > 0
            ? Math.round(settlements.reduce((s: number, r: any) => s + (r.settlementAmount || 0), 0) / settlements.length)
            : null,
          avgDuration: Math.round(records.reduce((s: number, r: any) => s + (r.durationMonths || 0), 0) / total),
        };
      } catch {
        return null;
      }
    }),

  // ─── Quick Score (no AI, just math) ────────────────────────────────

  quickScore: publicProcedure
    .input(
      z.object({
        practiceArea: z.string(),
        caseType: z.string(),
        factorInputs: z.array(
          z.object({
            factorName: z.string(),
            inputValue: z.string(),
            weight: z.number().optional(),
          })
        ),
      })
    )
    .query(async ({ input }) => {
      const { overallScore, overallLabel, factorDetails } = predictionEngine.calculateScore(
        input.factorInputs
      );
      const benchmark = predictionEngine.getBenchmarkForCase(input.practiceArea, input.caseType);
      return { overallScore, overallLabel, factorDetails, benchmark };
    }),
});
