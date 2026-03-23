import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as intakeEngine from "@/lib/intake-screening-engine";

export const intakeScreeningRouter = router({
  // ─── Public Chat API (widget) ──────────────────────────────────────

  startSession: publicProcedure
    .input(z.object({
      firmId: z.string().default("default"),
      source: z.string().optional(),
      sourceDetail: z.string().optional(),
      referrerUrl: z.string().optional(),
      utmSource: z.string().optional(),
      utmMedium: z.string().optional(),
      utmCampaign: z.string().optional(),
      clientLanguage: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return intakeEngine.startSession(input);
    }),

  sendMessage: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      message: z.string(),
    }))
    .mutation(async ({ input }) => {
      return intakeEngine.processMessage(input);
    }),

  submitContactInfo: publicProcedure
    .input(z.object({
      sessionToken: z.string(),
      contactInfo: z.object({
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        fullName: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        preferredContact: z.string().optional(),
        bestTimeToCall: z.string().optional(),
      }),
    }))
    .mutation(async ({ input }) => {
      return intakeEngine.submitContactInfo(input.sessionToken, input.contactInfo);
    }),

  endSession: publicProcedure
    .input(z.object({ sessionToken: z.string() }))
    .mutation(async ({ input }) => {
      return intakeEngine.endSession(input.sessionToken);
    }),

  getSessionStatus: publicProcedure
    .input(z.object({ sessionToken: z.string() }))
    .query(async ({ input }) => {
      const session = await (db as any).intakeSession.findUnique({
        where: { sessionToken: input.sessionToken },
        select: { id: true, status: true, practiceArea: true, messagesCount: true, leadGrade: true },
      });
      return session;
    }),

  // ─── Internal Session Management ───────────────────────────────────

  getSessions: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      practiceArea: z.string().optional(),
      leadGrade: z.string().optional(),
      source: z.string().optional(),
      assignedTo: z.string().optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      try {
        const where: Record<string, unknown> = {};
        if (input.status) where.status = input.status;
        if (input.practiceArea) where.practiceArea = input.practiceArea;
        if (input.leadGrade) where.leadGrade = input.leadGrade;
        if (input.source) where.source = input.source;
        if (input.assignedTo) where.assignedTo = input.assignedTo;

        return (db as any).intakeSession.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: input.limit,
        });
      } catch {
        return intakeEngine.getSampleSessions();
      }
    }),

  getSession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => {
      if (input.sessionId.startsWith("sample-")) {
        const samples = intakeEngine.getSampleSessions();
        return samples.find((s) => s.id === input.sessionId) || samples[0];
      }
      return (db as any).intakeSession.findUnique({
        where: { id: input.sessionId },
      });
    }),

  getUnreviewedSessions: publicProcedure.query(async () => {
    try {
      return (db as any).intakeSession.findMany({
        where: { status: { in: ["qualified", "needs_review"] }, contactedAt: null },
        orderBy: [{ urgencyLevel: "asc" }, { leadScore: "desc" }],
      });
    } catch {
      return intakeEngine.getSampleSessions().filter((s) => !s.contactedAt);
    }
  }),

  updateSessionStatus: publicProcedure
    .input(z.object({ sessionId: z.string(), status: z.string(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      return (db as any).intakeSession.update({
        where: { id: input.sessionId },
        data: { status: input.status },
      });
    }),

  assignToAttorney: publicProcedure
    .input(z.object({ sessionId: z.string(), attorneyId: z.string(), attorneyName: z.string() }))
    .mutation(async ({ input }) => {
      return (db as any).intakeSession.update({
        where: { id: input.sessionId },
        data: { assignedTo: input.attorneyId, assignedToName: input.attorneyName, routingReason: "Manual assignment" },
      });
    }),

  markContacted: publicProcedure
    .input(z.object({ sessionId: z.string(), contactMethod: z.string(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      return (db as any).intakeSession.update({
        where: { id: input.sessionId },
        data: { contactedAt: new Date(), contactMethod: input.contactMethod },
      });
    }),

  convertToMatter: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      return intakeEngine.convertToMatter(input.sessionId);
    }),

  archiveSession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => {
      return (db as any).intakeSession.update({
        where: { id: input.sessionId },
        data: { status: "archived" },
      });
    }),

  // ─── Screening Flows ───────────────────────────────────────────────

  getFlows: publicProcedure
    .input(z.object({ practiceArea: z.string().optional() }))
    .query(async ({ input }) => {
      try {
        const where: Record<string, unknown> = { isActive: true };
        if (input.practiceArea) where.practiceArea = input.practiceArea;
        const dbFlows = await (db as any).intakeScreeningFlow.findMany({ where, orderBy: { createdAt: "desc" } });
        if (dbFlows.length > 0) return dbFlows;
      } catch { /* fallback */ }
      const defaults = intakeEngine.getDefaultFlows();
      return input.practiceArea ? defaults.filter((f) => f.practiceArea === input.practiceArea) : defaults;
    }),

  getFlow: publicProcedure
    .input(z.object({ flowId: z.string() }))
    .query(async ({ input }) => {
      return (db as any).intakeScreeningFlow.findUnique({ where: { id: input.flowId } });
    }),

  createFlow: publicProcedure
    .input(z.object({
      name: z.string(),
      practiceArea: z.string(),
      subCategory: z.string().optional(),
      welcomeMessage: z.string(),
      questions: z.any(),
      qualificationRules: z.any().optional(),
      disqualificationRules: z.any().optional(),
      closingMessageQualified: z.string().optional(),
      closingMessageUnqualified: z.string().optional(),
      emergencyProtocol: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      return (db as any).intakeScreeningFlow.create({ data: { ...input, firmId: "default" } });
    }),

  // ─── Routing Rules ─────────────────────────────────────────────────

  getRoutingRules: publicProcedure.query(async () => {
    try {
      return (db as any).intakeRoutingRule.findMany({ orderBy: { priority: "desc" } });
    } catch {
      return [{
        id: "default-rule",
        name: "Default — All Leads",
        practiceArea: null,
        assignToName: "Jacob Rubinstein",
        priority: 0,
        maxActiveLeads: 50,
        currentLeadCount: 3,
        isActive: true,
      }];
    }
  }),

  createRoutingRule: publicProcedure
    .input(z.object({
      name: z.string(),
      practiceArea: z.string().optional(),
      conditions: z.any().optional(),
      assignToUserId: z.string().optional(),
      assignToName: z.string(),
      priority: z.number().default(0),
      maxActiveLeads: z.number().default(50),
    }))
    .mutation(async ({ input }) => {
      return (db as any).intakeRoutingRule.create({ data: { ...input, firmId: "default" } });
    }),

  // ─── Embed Config ──────────────────────────────────────────────────

  getEmbedConfig: publicProcedure.query(async () => {
    try {
      return (db as any).intakeEmbedConfig.findFirst({ where: { firmId: "default" } });
    } catch {
      return {
        position: "bottom-right",
        theme: "light",
        primaryColor: "#1e293b",
        buttonText: "Free Case Evaluation",
        practiceAreas: ["personal_injury", "immigration", "family_law"],
        isActive: true,
      };
    }
  }),

  updateEmbedConfig: publicProcedure
    .input(z.object({
      position: z.string().optional(),
      theme: z.string().optional(),
      primaryColor: z.string().optional(),
      buttonText: z.string().optional(),
      practiceAreas: z.array(z.string()).optional(),
      autoOpenDelay: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      return (db as any).intakeEmbedConfig.upsert({
        where: { firmId: "default" },
        update: input,
        create: { firmId: "default", ...input },
      });
    }),

  // ─── Analytics ─────────────────────────────────────────────────────

  getDashboardStats: publicProcedure.query(async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const weekAgo = new Date(today.getTime() - 7 * 86400000);

      const total = await (db as any).intakeSession.count();
      const thisWeek = await (db as any).intakeSession.count({ where: { createdAt: { gte: weekAgo } } });
      const qualified = await (db as any).intakeSession.count({ where: { status: { in: ["qualified", "converted"] }, createdAt: { gte: weekAgo } } });
      const converted = await (db as any).intakeSession.count({ where: { status: "converted" } });
      const active = await (db as any).intakeSession.count({ where: { status: "active" } });

      return { totalSessions: total, thisWeekSessions: thisWeek, qualifiedThisWeek: qualified, totalConverted: converted, activeSessions: active };
    } catch {
      return { totalSessions: 3, thisWeekSessions: 3, qualifiedThisWeek: 2, totalConverted: 0, activeSessions: 0 };
    }
  }),

  getConversionFunnel: publicProcedure
    .input(z.object({ days: z.number().default(30) }))
    .query(async ({ input }) => {
      try {
        const since = new Date(Date.now() - input.days * 86400000);
        const all = await (db as any).intakeSession.findMany({ where: { createdAt: { gte: since } }, select: { status: true, leadGrade: true } });
        const started = all.length;
        const completed = all.filter((s: any) => s.status !== "active" && s.status !== "abandoned").length;
        const qualified = all.filter((s: any) => ["qualified", "converted", "needs_review"].includes(s.status)).length;
        const converted = all.filter((s: any) => s.status === "converted").length;
        return { started, completed, qualified, converted };
      } catch {
        return { started: 15, completed: 12, qualified: 8, converted: 3 };
      }
    }),
});
