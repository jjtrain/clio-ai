import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  triggerPulseSurvey,
  recordResponse,
  calculateNPS,
  calculateAggregations,
  extractThemes,
  processScheduledSurveys,
} from "@/lib/pulse-engine";

const DEFAULT_USER_ID = "demo-user";
const DEFAULT_FIRM_ID = "demo-firm";

export const pulseRouter = router({
  // ==========================================
  // SURVEY MANAGEMENT
  // ==========================================

  triggerSurvey: publicProcedure
    .input(z.object({
      matterId: z.string(),
      portalAccountId: z.string().optional(),
      triggerMilestone: z.string(),
    }))
    .mutation(async ({ input }) => {
      await triggerPulseSurvey({ ...input, firmId: DEFAULT_FIRM_ID, userId: DEFAULT_USER_ID });
      return { success: true };
    }),

  getSurveys: publicProcedure
    .input(z.object({
      matterId: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().optional().default(30),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.matterId) where.matterId = input.matterId;
      if (input.status) where.status = input.status;
      return ctx.db.pulseSurvey.findMany({ where, orderBy: { createdAt: "desc" }, take: input.limit });
    }),

  getSurveyByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const survey = await ctx.db.pulseSurvey.findUnique({ where: { responseToken: input.token } });
      if (!survey || survey.tokenExpiry < new Date()) return null;
      return {
        id: survey.id,
        question: survey.question,
        questionType: survey.questionType,
        followUpQuestion: survey.followUpQuestion,
        clientName: survey.clientName,
        triggerMilestone: survey.triggerMilestone,
        responded: !!survey.respondedAt,
      };
    }),

  respond: publicProcedure
    .input(z.object({
      token: z.string(),
      score: z.number(),
      followUpResponse: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return recordResponse(input.token, input.score, input.followUpResponse);
    }),

  // ==========================================
  // TEMPLATES
  // ==========================================

  getTemplates: publicProcedure
    .input(z.object({ practiceArea: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { OR: [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }] };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      return ctx.db.pulseTemplate.findMany({ where, orderBy: { triggerMilestone: "asc" } });
    }),

  createTemplate: publicProcedure
    .input(z.object({
      name: z.string(),
      triggerMilestone: z.string(),
      practiceArea: z.string().optional(),
      question: z.string(),
      questionType: z.string(),
      followUpQuestion: z.string().optional(),
      emailSubject: z.string().optional(),
      deliveryDelay: z.number().optional(),
      reminderAfterHours: z.number().optional(),
      maxReminders: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.pulseTemplate.create({ data: { ...input, isActive: true, firmId: DEFAULT_FIRM_ID } });
    }),

  updateTemplate: publicProcedure
    .input(z.object({ templateId: z.string(), name: z.string().optional(), question: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { templateId, ...data } = input;
      return ctx.db.pulseTemplate.update({ where: { id: templateId }, data });
    }),

  deleteTemplate: publicProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.pulseTemplate.delete({ where: { id: input.templateId } });
    }),

  // ==========================================
  // TRIGGERS
  // ==========================================

  getTriggers: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.pulseTrigger.findMany({
      where: { OR: [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }] },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }),

  createTrigger: publicProcedure
    .input(z.object({
      name: z.string(),
      triggerSource: z.string(),
      triggerCondition: z.any(),
      templateId: z.string().optional(),
      practiceArea: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.pulseTrigger.create({ data: { ...input, isActive: true, firmId: DEFAULT_FIRM_ID } });
    }),

  toggleTrigger: publicProcedure
    .input(z.object({ triggerId: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.pulseTrigger.update({ where: { id: input.triggerId }, data: { isActive: input.isActive } });
    }),

  deleteTrigger: publicProcedure
    .input(z.object({ triggerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.pulseTrigger.delete({ where: { id: input.triggerId } });
    }),

  // ==========================================
  // ANALYTICS
  // ==========================================

  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const total = await ctx.db.pulseSurvey.count({ where: { firmId: DEFAULT_FIRM_ID } });
    const responded = await ctx.db.pulseSurvey.count({ where: { firmId: DEFAULT_FIRM_ID, status: "responded" } });
    const pending = await ctx.db.pulseSurvey.count({ where: { firmId: DEFAULT_FIRM_ID, status: { in: ["pending", "delivered"] } } });

    const responses = await ctx.db.pulseSurvey.findMany({
      where: { firmId: DEFAULT_FIRM_ID, status: "responded", score: { not: null } },
      select: { score: true, questionType: true },
    });

    const scores = responses.filter((r) => r.score !== null);
    const avgScore = scores.length > 0 ? scores.reduce((sum, r) => sum + r.score!, 0) / scores.length : 0;
    const nps = calculateNPS(scores.map((r) => ({ score: r.score!, questionType: r.questionType })));

    const lowScores = await ctx.db.pulseSurvey.count({
      where: { firmId: DEFAULT_FIRM_ID, status: "responded", score: { lte: 2 } },
    });

    return {
      totalSurveys: total,
      totalResponses: responded,
      pendingSurveys: pending,
      responseRate: total > 0 ? Math.round((responded / total) * 100) : 0,
      avgScore: Math.round(avgScore * 10) / 10,
      npsScore: nps.npsScore,
      promoters: nps.promoters,
      passives: nps.passives,
      detractors: nps.detractors,
      lowScoreAlerts: lowScores,
    };
  }),

  getAggregations: publicProcedure
    .input(z.object({ periodType: z.string().optional(), scope: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.periodType) where.periodType = input.periodType;
      if (input.scope) where.scope = input.scope;
      return ctx.db.pulseAggregation.findMany({ where, orderBy: { period: "desc" }, take: 12 });
    }),

  recalculateAggregations: publicProcedure
    .input(z.object({ period: z.string(), periodType: z.string() }))
    .mutation(async ({ input }) => {
      await calculateAggregations(DEFAULT_FIRM_ID, input.period, input.periodType);
      return { success: true };
    }),

  getRecentFeedback: publicProcedure
    .input(z.object({ limit: z.number().optional().default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.pulseSurvey.findMany({
        where: { firmId: DEFAULT_FIRM_ID, status: "responded" },
        orderBy: { respondedAt: "desc" },
        take: input.limit,
      });
    }),

  extractThemes: publicProcedure.mutation(async ({ ctx }) => {
    const responses = await ctx.db.pulseSurvey.findMany({
      where: { firmId: DEFAULT_FIRM_ID, status: "responded", followUpResponse: { not: null } },
      select: { followUpResponse: true },
    });

    const themes = await extractThemes(responses.filter((r) => r.followUpResponse) as any);
    return { themes };
  }),

  // ==========================================
  // SCHEDULED PROCESSING
  // ==========================================

  processScheduled: publicProcedure.mutation(async () => {
    return processScheduledSurveys(DEFAULT_FIRM_ID);
  }),
});
