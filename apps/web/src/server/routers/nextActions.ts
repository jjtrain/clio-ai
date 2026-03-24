import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  generateNextActions,
  generateAllMatterActions,
  gatherMatterState,
  logActivity,
} from "@/lib/next-actions-engine";

const DEFAULT_USER_ID = "demo-user";
const DEFAULT_FIRM_ID = "demo-firm";

export const nextActionsRouter = router({
  // ==========================================
  // ACTION GENERATION
  // ==========================================

  getActionsForMatter: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check for existing fresh actions
      const existing = await ctx.db.matterAction.findMany({
        where: {
          matterId: input.matterId,
          status: { in: ["pending", "acknowledged", "in_progress"] },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      });

      // If recent actions exist (< 24h old), return them
      const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
      if (existing.length > 0 && existing[0].createdAt > cutoff) {
        return existing;
      }

      // Generate fresh actions
      const actions = await generateNextActions(input.matterId, DEFAULT_USER_ID, DEFAULT_FIRM_ID);

      // Expire old pending actions
      await ctx.db.matterAction.updateMany({
        where: {
          matterId: input.matterId,
          status: "pending",
          createdAt: { lt: cutoff },
        },
        data: { status: "expired" },
      });

      // Save new actions
      const saved = [];
      for (const action of actions) {
        const created = await ctx.db.matterAction.create({
          data: {
            matterId: input.matterId,
            title: action.title,
            description: action.description,
            actionType: action.actionType,
            urgency: action.urgency,
            priority: action.priority,
            source: action.source,
            triggerEvent: action.triggerEvent,
            reasoning: action.reasoning,
            practiceAreaContext: action.practiceAreaContext,
            ruleReference: action.ruleReference,
            suggestedFeature: action.suggestedFeature,
            suggestedAction: action.suggestedAction as any,
            estimatedTime: action.estimatedTime,
            relatedDeadlineId: action.relatedDeadlineId,
            relatedDeadlineDate: action.relatedDeadlineDate,
            expiresAt: action.expiresAt,
            userId: DEFAULT_USER_ID,
            firmId: DEFAULT_FIRM_ID,
          },
        });
        saved.push(created);
      }

      return saved;
    }),

  refreshActions: publicProcedure
    .input(z.object({ matterId: z.string(), trigger: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      // Expire existing pending
      await ctx.db.matterAction.updateMany({
        where: { matterId: input.matterId, status: "pending" },
        data: { status: "expired" },
      });

      const actions = await generateNextActions(input.matterId, DEFAULT_USER_ID, DEFAULT_FIRM_ID, input.trigger);

      const saved = [];
      for (const action of actions) {
        const created = await ctx.db.matterAction.create({
          data: {
            matterId: input.matterId,
            title: action.title,
            description: action.description,
            actionType: action.actionType,
            urgency: action.urgency,
            priority: action.priority,
            source: action.source,
            triggerEvent: input.trigger || action.triggerEvent,
            reasoning: action.reasoning,
            practiceAreaContext: action.practiceAreaContext,
            ruleReference: action.ruleReference,
            suggestedFeature: action.suggestedFeature,
            suggestedAction: action.suggestedAction as any,
            estimatedTime: action.estimatedTime,
            relatedDeadlineId: action.relatedDeadlineId,
            relatedDeadlineDate: action.relatedDeadlineDate,
            userId: DEFAULT_USER_ID,
            firmId: DEFAULT_FIRM_ID,
          },
        });
        saved.push(created);
      }

      return saved;
    }),

  refreshAllActions: publicProcedure
    .mutation(async () => {
      return generateAllMatterActions(DEFAULT_FIRM_ID, DEFAULT_USER_ID);
    }),

  getActionDetails: publicProcedure
    .input(z.object({ actionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.matterAction.findUnique({
        where: { id: input.actionId },
        include: { matter: { select: { name: true, practiceArea: true, status: true } } },
      });
    }),

  // ==========================================
  // ACTION MANAGEMENT
  // ==========================================

  acknowledgeAction: publicProcedure
    .input(z.object({ actionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.matterAction.update({
        where: { id: input.actionId },
        data: { status: "acknowledged" },
      });
    }),

  startAction: publicProcedure
    .input(z.object({ actionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.matterAction.update({
        where: { id: input.actionId },
        data: { status: "in_progress" },
      });
    }),

  completeAction: publicProcedure
    .input(z.object({ actionId: z.string(), completedAction: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const action = await ctx.db.matterAction.update({
        where: { id: input.actionId },
        data: {
          status: "completed",
          completedAction: input.completedAction,
          completedAt: new Date(),
        },
      });

      // Log activity
      await logActivity({
        matterId: action.matterId,
        activityType: "action_completed",
        description: `Completed: ${action.title}${input.completedAction ? ` — ${input.completedAction}` : ""}`,
        entityType: "action",
        entityId: action.id,
        firmId: DEFAULT_FIRM_ID,
      }).catch(() => {});

      return action;
    }),

  dismissAction: publicProcedure
    .input(z.object({ actionId: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.matterAction.update({
        where: { id: input.actionId },
        data: {
          status: "dismissed",
          dismissReason: input.reason,
          dismissedAt: new Date(),
        },
      });
    }),

  deferAction: publicProcedure
    .input(z.object({ actionId: z.string(), deferUntil: z.date() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.matterAction.update({
        where: { id: input.actionId },
        data: {
          status: "deferred",
          deferredUntil: input.deferUntil,
          snoozeCount: { increment: 1 },
        },
      });
    }),

  bulkUpdateActions: publicProcedure
    .input(z.object({
      actionIds: z.array(z.string()),
      status: z.string(),
      reason: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data: any = { status: input.status };
      if (input.status === "completed") data.completedAt = new Date();
      if (input.status === "dismissed") {
        data.dismissedAt = new Date();
        data.dismissReason = input.reason;
      }
      const result = await ctx.db.matterAction.updateMany({
        where: { id: { in: input.actionIds } },
        data,
      });
      return { updated: result.count };
    }),

  // ==========================================
  // DASHBOARD QUERIES
  // ==========================================

  getAllPendingActions: publicProcedure
    .input(z.object({
      urgency: z.string().optional(),
      actionType: z.string().optional(),
      limit: z.number().optional().default(50),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = {
        firmId: DEFAULT_FIRM_ID,
        status: { in: ["pending", "acknowledged", "in_progress"] },
      };
      if (input.urgency) where.urgency = input.urgency;
      if (input.actionType) where.actionType = input.actionType;

      return ctx.db.matterAction.findMany({
        where,
        include: { matter: { select: { name: true, practiceArea: true } } },
        orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
        take: input.limit,
      });
    }),

  getUrgentActions: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.matterAction.findMany({
      where: {
        firmId: DEFAULT_FIRM_ID,
        status: { in: ["pending", "acknowledged"] },
        urgency: { in: ["immediate", "this_week"] },
      },
      include: { matter: { select: { name: true, practiceArea: true } } },
      orderBy: { priority: "desc" },
      take: 20,
    });
  }),

  getActionsByUrgency: publicProcedure.query(async ({ ctx }) => {
    const actions = await ctx.db.matterAction.findMany({
      where: {
        firmId: DEFAULT_FIRM_ID,
        status: { in: ["pending", "acknowledged", "in_progress"] },
      },
      include: { matter: { select: { name: true, practiceArea: true } } },
      orderBy: { priority: "desc" },
    });

    const grouped: Record<string, typeof actions> = {
      immediate: [],
      this_week: [],
      next_two_weeks: [],
      this_month: [],
      when_possible: [],
    };

    for (const action of actions) {
      const bucket = grouped[action.urgency] || grouped.when_possible;
      bucket.push(action);
    }

    return grouped;
  }),

  getActionStats: publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.matterAction.findMany({
      where: { firmId: DEFAULT_FIRM_ID },
    });

    const pending = all.filter((a) => ["pending", "acknowledged", "in_progress"].includes(a.status));
    const completed = all.filter((a) => a.status === "completed");
    const immediate = pending.filter((a) => a.urgency === "immediate");

    const byType: Record<string, number> = {};
    for (const a of pending) {
      byType[a.actionType] = (byType[a.actionType] || 0) + 1;
    }

    return {
      totalPending: pending.length,
      immediate: immediate.length,
      thisWeek: pending.filter((a) => a.urgency === "this_week").length,
      completedTotal: completed.length,
      completionRate: all.length > 0 ? Math.round((completed.length / all.length) * 100) : 0,
      byType,
    };
  }),

  getOverdueFollowUps: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.matterAction.findMany({
      where: {
        firmId: DEFAULT_FIRM_ID,
        status: "deferred",
        deferredUntil: { lt: new Date() },
      },
      include: { matter: { select: { name: true, practiceArea: true } } },
      orderBy: { deferredUntil: "asc" },
    });
  }),

  // ==========================================
  // MATTER STATE
  // ==========================================

  getMatterState: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      return gatherMatterState(input.matterId, DEFAULT_FIRM_ID);
    }),

  getMatterPhaseHistory: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.matterPhaseHistory.findMany({
        where: { matterId: input.matterId },
        orderBy: { startedAt: "asc" },
      });
    }),

  getMatterActivityLog: publicProcedure
    .input(z.object({
      matterId: z.string(),
      limit: z.number().optional().default(30),
      activityType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { matterId: input.matterId };
      if (input.activityType) where.activityType = input.activityType;

      return ctx.db.matterActivityLog.findMany({
        where,
        orderBy: { occurredAt: "desc" },
        take: input.limit,
      });
    }),

  // ==========================================
  // ACTION RULES (Admin)
  // ==========================================

  getRules: publicProcedure
    .input(z.object({
      practiceArea: z.string().optional(),
      triggerType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { OR: [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }] };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      if (input.triggerType) where.triggerType = input.triggerType;

      return ctx.db.actionRule.findMany({
        where,
        orderBy: [{ isDefault: "desc" }, { name: "asc" }],
      });
    }),

  createRule: publicProcedure
    .input(z.object({
      name: z.string(),
      description: z.string(),
      practiceArea: z.string().optional(),
      casePhase: z.string().optional(),
      triggerType: z.string(),
      triggerCondition: z.any(),
      actionTemplate: z.any(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.actionRule.create({
        data: { ...input, isActive: true, firmId: DEFAULT_FIRM_ID },
      });
    }),

  updateRule: publicProcedure
    .input(z.object({
      ruleId: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      triggerCondition: z.any().optional(),
      actionTemplate: z.any().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { ruleId, ...data } = input;
      return ctx.db.actionRule.update({ where: { id: ruleId }, data });
    }),

  deleteRule: publicProcedure
    .input(z.object({ ruleId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.actionRule.delete({ where: { id: input.ruleId } });
    }),

  toggleRule: publicProcedure
    .input(z.object({ ruleId: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.actionRule.update({
        where: { id: input.ruleId },
        data: { isActive: input.isActive },
      });
    }),

  // ==========================================
  // ACTIVITY LOGGING
  // ==========================================

  logActivity: publicProcedure
    .input(z.object({
      matterId: z.string(),
      activityType: z.string(),
      description: z.string(),
      entityType: z.string().optional(),
      entityId: z.string().optional(),
      metadata: z.any().optional(),
    }))
    .mutation(async ({ input }) => {
      await logActivity({
        ...input,
        firmId: DEFAULT_FIRM_ID,
      });
      return { success: true };
    }),
});
