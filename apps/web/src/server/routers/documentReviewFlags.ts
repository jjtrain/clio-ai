import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as reviewEngine from "@/lib/document-review-engine";

export const documentReviewFlagsRouter = router({
  // ─── Review Creation ────────────────────────────────────────────────

  submitForReview: publicProcedure
    .input(
      z.object({
        documentName: z.string(),
        documentText: z.string(),
        documentType: z.string().optional(),
        practiceArea: z.string().optional(),
        jurisdiction: z.string().optional(),
        matterId: z.string().optional(),
        fileName: z.string().optional(),
        fileSize: z.number().optional(),
        mimeType: z.string().optional(),
        pageCount: z.number().optional(),
        comparisonText: z.string().optional(),
        customInstructions: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Auto-detect document type and practice area if not provided
      const documentType =
        input.documentType ||
        reviewEngine.detectDocumentType(input.documentText, input.fileName || input.documentName);
      const practiceArea =
        input.practiceArea ||
        reviewEngine.detectPracticeArea(input.documentText);

      // Create the review record
      const review = await reviewEngine.createReview({
        matterId: input.matterId,
        documentName: input.documentName,
        documentType,
        practiceArea,
        jurisdiction: input.jurisdiction,
        fileName: input.fileName,
        fileSize: input.fileSize,
        mimeType: input.mimeType,
        extractedText: input.documentText,
        pageCount: input.pageCount,
        userId: "default",
        firmId: "default",
      });

      // Run AI review
      try {
        const result = await reviewEngine.reviewDocument({
          text: input.documentText,
          documentType,
          practiceArea,
          jurisdiction: input.jurisdiction,
          comparisonDoc: input.comparisonText,
          customInstructions: input.customInstructions,
        });

        const { review: updatedReview, flags } = await reviewEngine.completeReview(
          review.id,
          result,
          "default",
          "default"
        );

        // If comparison text provided, create comparison record
        if (input.comparisonText) {
          const comparison = await reviewEngine.compareDocuments({
            responseText: input.documentText,
            demandText: input.comparisonText,
            documentType,
          });

          await (db as any).reviewComparison.create({
            data: {
              reviewId: review.id,
              comparisonType: "against_demand",
              comparisonText: input.comparisonText,
              matchedItems: comparison.matchedItems,
              missingItems: comparison.missingItems,
              extraItems: comparison.extraItems,
              matchPercentage: comparison.matchPercentage,
              userId: "default",
              firmId: "default",
            },
          });
        }

        return { review: updatedReview, flags };
      } catch (error) {
        // Mark review as error
        await (db as any).documentReview.update({
          where: { id: review.id },
          data: { reviewStatus: "error" },
        });
        throw error;
      }
    }),

  // ─── Review Retrieval ────────────────────────────────────────────────

  getReview: publicProcedure
    .input(z.object({ reviewId: z.string() }))
    .query(async ({ input }) => {
      if (input.reviewId === "sample-review-1") {
        return reviewEngine.getSampleReview();
      }

      const result = await reviewEngine.getReviewWithFlags(input.reviewId);
      if (!result) throw new Error("Review not found");

      // Also get comparison if exists
      let comparison = null;
      try {
        comparison = await (db as any).reviewComparison.findFirst({
          where: { reviewId: input.reviewId },
        });
      } catch { /* optional */ }

      return { ...result, comparison };
    }),

  getAllReviews: publicProcedure
    .input(
      z.object({
        status: z.string().optional(),
        documentType: z.string().optional(),
        matterId: z.string().optional(),
        riskLevel: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const where: Record<string, unknown> = {};
        if (input.status) where.reviewStatus = input.status;
        if (input.documentType) where.documentType = input.documentType;
        if (input.matterId) where.matterId = input.matterId;
        if (input.riskLevel) where.overallRiskLevel = input.riskLevel;

        const reviews = await (db as any).documentReview.findMany({
          where,
          orderBy: { createdAt: "desc" },
        });

        return reviews;
      } catch {
        // Return sample if DB not ready
        return [reviewEngine.getSampleReview().review];
      }
    }),

  getReviewsForMatter: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      return reviewEngine.getReviewsForMatter(input.matterId);
    }),

  deleteReview: publicProcedure
    .input(z.object({ reviewId: z.string() }))
    .mutation(async ({ input }) => {
      await (db as any).reviewFlag.deleteMany({
        where: { reviewId: input.reviewId },
      });
      await (db as any).reviewComparison.deleteMany({
        where: { reviewId: input.reviewId },
      });
      await (db as any).documentReview.delete({
        where: { id: input.reviewId },
      });
      return { success: true };
    }),

  // ─── Flag Management ────────────────────────────────────────────────

  updateFlagStatus: publicProcedure
    .input(
      z.object({
        flagId: z.string(),
        status: z.string(),
        attorneyNotes: z.string().optional(),
        resolvedAction: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return reviewEngine.updateFlagStatus(
        input.flagId,
        input.status,
        input.attorneyNotes,
        input.resolvedAction
      );
    }),

  addFlagNote: publicProcedure
    .input(
      z.object({
        flagId: z.string(),
        note: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return (db as any).reviewFlag.update({
        where: { id: input.flagId },
        data: { attorneyNotes: input.note },
      });
    }),

  // ─── Statistics ─────────────────────────────────────────────────────

  getReviewStats: publicProcedure.query(async () => {
    try {
      const total = await (db as any).documentReview.count();
      const byStatus = await (db as any).documentReview.groupBy({
        by: ["reviewStatus"],
        _count: true,
      });
      const byRisk = await (db as any).documentReview.groupBy({
        by: ["overallRiskLevel"],
        _count: true,
      });
      const totalFlags = await (db as any).reviewFlag.count();
      const openFlags = await (db as any).reviewFlag.count({
        where: { status: "open" },
      });
      const criticalFlags = await (db as any).reviewFlag.count({
        where: { severity: "critical", status: "open" },
      });

      return {
        totalReviews: total,
        byStatus,
        byRisk,
        totalFlags,
        openFlags,
        criticalFlags,
      };
    } catch {
      return {
        totalReviews: 1,
        byStatus: [{ reviewStatus: "completed", _count: 1 }],
        byRisk: [{ overallRiskLevel: "high", _count: 1 }],
        totalFlags: 8,
        openFlags: 8,
        criticalFlags: 2,
      };
    }
  }),

  // ─── Checklists ─────────────────────────────────────────────────────

  getChecklists: publicProcedure
    .input(
      z.object({
        documentType: z.string().optional(),
        practiceArea: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const defaults = reviewEngine.getDefaultChecklists();
      let filtered = defaults;
      if (input.documentType) {
        filtered = filtered.filter((c) => c.documentType === input.documentType);
      }
      if (input.practiceArea) {
        filtered = filtered.filter(
          (c) => !c.practiceArea || c.practiceArea === input.practiceArea
        );
      }

      // Also fetch custom checklists from DB
      try {
        const custom = await (db as any).reviewChecklist.findMany({
          where: {
            ...(input.documentType ? { documentType: input.documentType } : {}),
          },
        });
        return [...filtered, ...custom];
      } catch {
        return filtered;
      }
    }),

  createChecklist: publicProcedure
    .input(
      z.object({
        name: z.string(),
        documentType: z.string(),
        practiceArea: z.string().optional(),
        jurisdiction: z.string().optional(),
        checklistItems: z.array(
          z.object({
            item: z.string(),
            category: z.string(),
            required: z.boolean(),
            ruleReference: z.string().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      return (db as any).reviewChecklist.create({
        data: {
          ...input,
          checklistItems: input.checklistItems,
          userId: "default",
          firmId: "default",
        },
      });
    }),

  // ─── Comparison ─────────────────────────────────────────────────────

  getComparison: publicProcedure
    .input(z.object({ reviewId: z.string() }))
    .query(async ({ input }) => {
      try {
        return (db as any).reviewComparison.findFirst({
          where: { reviewId: input.reviewId },
        });
      } catch {
        return null;
      }
    }),

  // ─── Mark Review Status ─────────────────────────────────────────────

  markReviewed: publicProcedure
    .input(
      z.object({
        reviewId: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      return (db as any).documentReview.update({
        where: { id: input.reviewId },
        data: {
          reviewStatus: "attorney_reviewed",
          reviewNotes: input.notes,
        },
      });
    }),

  archiveReview: publicProcedure
    .input(z.object({ reviewId: z.string() }))
    .mutation(async ({ input }) => {
      return (db as any).documentReview.update({
        where: { id: input.reviewId },
        data: { reviewStatus: "archived" },
      });
    }),
});
