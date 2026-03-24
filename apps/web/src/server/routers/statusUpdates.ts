import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { onMatterEvent, generatePeriodicCheckin, processScheduledUpdates } from "@/lib/status-update-engine";

const DEFAULT_USER_ID = "demo-user";
const DEFAULT_FIRM_ID = "demo-firm";

export const statusUpdatesRouter = router({
  // ==========================================
  // QUEUE MANAGEMENT
  // ==========================================

  getUpdateQueue: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      matterId: z.string().optional(),
      practiceArea: z.string().optional(),
      limit: z.number().optional().default(30),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.status) where.status = input.status;
      else where.status = { in: ["pending_approval", "held"] };
      if (input.matterId) where.matterId = input.matterId;
      if (input.practiceArea) where.practiceArea = input.practiceArea;

      return ctx.db.statusUpdateQueue.findMany({
        where,
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
        take: input.limit,
      });
    }),

  getQueueStats: publicProcedure.query(async ({ ctx }) => {
    const pending = await ctx.db.statusUpdateQueue.count({ where: { firmId: DEFAULT_FIRM_ID, status: "pending_approval" } });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const autoToday = await ctx.db.statusUpdateQueue.count({
      where: { firmId: DEFAULT_FIRM_ID, status: "auto_published", deliveredAt: { gte: today } },
    });
    const rejected = await ctx.db.statusUpdateQueue.count({ where: { firmId: DEFAULT_FIRM_ID, status: "rejected" } });

    const byPracticeArea = await ctx.db.statusUpdateQueue.groupBy({
      by: ["practiceArea"],
      where: { firmId: DEFAULT_FIRM_ID, status: "pending_approval" },
      _count: { practiceArea: true },
    });

    return {
      pending,
      autoPublishedToday: autoToday,
      rejected,
      byPracticeArea: byPracticeArea.reduce<Record<string, number>>((acc, p) => {
        if (p.practiceArea) acc[p.practiceArea] = p._count.practiceArea;
        return acc;
      }, {}),
    };
  }),

  approveUpdate: publicProcedure
    .input(z.object({
      queueItemId: z.string(),
      editedTitle: z.string().optional(),
      editedBody: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.statusUpdateQueue.findUnique({ where: { id: input.queueItemId } });
      if (!item) throw new Error("Queue item not found");

      const title = input.editedTitle || item.title;
      const body = input.editedBody || item.body;

      // Update queue item
      await ctx.db.statusUpdateQueue.update({
        where: { id: input.queueItemId },
        data: {
          status: "delivered",
          editedTitle: input.editedTitle,
          editedBody: input.editedBody,
          approvedAt: new Date(),
          approvedBy: DEFAULT_USER_ID,
          deliveredAt: new Date(),
        },
      });

      // Publish to portal
      await ctx.db.portalStatusUpdate.create({
        data: {
          matterId: item.matterId,
          title,
          body,
          milestone: item.milestone,
          phase: item.phase,
          phasePercentage: item.phasePercentage,
          isPublished: true,
          isDraft: false,
          publishedAt: new Date(),
          notifyClient: true,
          aiGenerated: true,
          userId: DEFAULT_USER_ID,
          firmId: DEFAULT_FIRM_ID,
        },
      });

      // Send notifications
      const access = await ctx.db.portalMatterAccess.findMany({ where: { matterId: item.matterId, isActive: true } });
      for (const a of access) {
        await ctx.db.portalNotification.create({
          data: {
            portalUserId: a.portalUserId,
            matterId: item.matterId,
            type: "status_update",
            title,
            body: body.slice(0, 200),
            linkTo: `/portal/matter/${item.matterId}`,
          },
        }).catch(() => {});
      }

      return { success: true };
    }),

  rejectUpdate: publicProcedure
    .input(z.object({ queueItemId: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.statusUpdateQueue.update({
        where: { id: input.queueItemId },
        data: { status: "rejected", rejectedReason: input.reason },
      });
    }),

  bulkApprove: publicProcedure
    .input(z.object({ queueItemIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      let approved = 0;
      for (const id of input.queueItemIds) {
        try {
          const item = await ctx.db.statusUpdateQueue.findUnique({ where: { id } });
          if (!item || item.status !== "pending_approval") continue;

          await ctx.db.statusUpdateQueue.update({
            where: { id },
            data: { status: "delivered", approvedAt: new Date(), approvedBy: DEFAULT_USER_ID, deliveredAt: new Date() },
          });

          await ctx.db.portalStatusUpdate.create({
            data: {
              matterId: item.matterId,
              title: item.title,
              body: item.body,
              milestone: item.milestone,
              phase: item.phase,
              phasePercentage: item.phasePercentage,
              isPublished: true,
              isDraft: false,
              publishedAt: new Date(),
              notifyClient: true,
              aiGenerated: true,
              userId: DEFAULT_USER_ID,
              firmId: DEFAULT_FIRM_ID,
            },
          });

          approved++;
        } catch {}
      }
      return { approved };
    }),

  // ==========================================
  // MANUAL GENERATION
  // ==========================================

  generateUpdateNow: publicProcedure
    .input(z.object({ matterId: z.string(), triggerEvent: z.string().optional() }))
    .mutation(async ({ input }) => {
      await onMatterEvent(
        { eventType: input.triggerEvent || "manual", matterId: input.matterId, eventData: {} },
        DEFAULT_FIRM_ID,
        DEFAULT_USER_ID
      );
      return { success: true };
    }),

  generateBulkCheckins: publicProcedure
    .input(z.object({ practiceArea: z.string().optional() }))
    .mutation(async ({ ctx }) => {
      const matters = await ctx.db.matter.findMany({
        where: { status: "OPEN" },
        take: 50,
      });

      let generated = 0;
      for (const matter of matters) {
        const lastUpdate = await ctx.db.statusUpdateQueue.findFirst({
          where: { matterId: matter.id },
          orderBy: { createdAt: "desc" },
        });

        const daysSince = lastUpdate
          ? Math.ceil((Date.now() - lastUpdate.createdAt.getTime()) / (1000 * 60 * 60 * 24))
          : 999;

        if (daysSince >= 30) {
          const update = await generatePeriodicCheckin(matter.id, matter.practiceArea || "general", daysSince);
          await ctx.db.statusUpdateQueue.create({
            data: {
              matterId: matter.id,
              triggerSource: "inactivity",
              title: update.title,
              body: update.body,
              practiceArea: matter.practiceArea,
              tone: update.tone || "professional",
              priority: 5,
              status: "pending_approval",
              approvalRequired: true,
              deliveryChannels: ["portal", "email"],
              userId: DEFAULT_USER_ID,
              firmId: DEFAULT_FIRM_ID,
            },
          });
          generated++;
        }
      }

      return { generated };
    }),

  // ==========================================
  // TRIGGER MANAGEMENT
  // ==========================================

  getTriggers: publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), triggerSource: z.string().optional(), isActive: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { OR: [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }] };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      if (input.triggerSource) where.triggerSource = input.triggerSource;
      if (input.isActive !== undefined) where.isActive = input.isActive;
      return ctx.db.statusUpdateTrigger.findMany({ where, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
    }),

  createTrigger: publicProcedure
    .input(z.object({
      name: z.string(),
      triggerSource: z.string(),
      triggerCondition: z.any(),
      practiceArea: z.string().optional(),
      autoPublish: z.boolean().optional(),
      approvalRequired: z.boolean().optional(),
      cooldownHours: z.number().optional(),
      templateId: z.string().optional(),
      priority: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.statusUpdateTrigger.create({
        data: { ...input, isActive: true, firmId: DEFAULT_FIRM_ID },
      });
    }),

  updateTrigger: publicProcedure
    .input(z.object({ triggerId: z.string(), name: z.string().optional(), triggerCondition: z.any().optional(), isActive: z.boolean().optional(), autoPublish: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { triggerId, ...data } = input;
      return ctx.db.statusUpdateTrigger.update({ where: { id: triggerId }, data });
    }),

  deleteTrigger: publicProcedure
    .input(z.object({ triggerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.statusUpdateTrigger.delete({ where: { id: input.triggerId } });
    }),

  toggleTrigger: publicProcedure
    .input(z.object({ triggerId: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.statusUpdateTrigger.update({ where: { id: input.triggerId }, data: { isActive: input.isActive } });
    }),

  // ==========================================
  // TEMPLATE MANAGEMENT
  // ==========================================

  getTemplates: publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), triggerSource: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { OR: [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }] };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      if (input.triggerSource) where.triggerSource = input.triggerSource;
      return ctx.db.statusUpdateTemplate.findMany({ where, orderBy: { name: "asc" } });
    }),

  createTemplate: publicProcedure
    .input(z.object({
      name: z.string(),
      triggerSource: z.string(),
      practiceArea: z.string().optional(),
      tone: z.string().optional(),
      titleTemplate: z.string(),
      bodyTemplate: z.string(),
      milestoneTag: z.string().optional(),
      includeNextSteps: z.boolean().optional(),
      clientActionText: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.statusUpdateTemplate.create({ data: { ...input, firmId: DEFAULT_FIRM_ID } });
    }),

  updateTemplate: publicProcedure
    .input(z.object({ templateId: z.string(), name: z.string().optional(), titleTemplate: z.string().optional(), bodyTemplate: z.string().optional(), tone: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { templateId, ...data } = input;
      return ctx.db.statusUpdateTemplate.update({ where: { id: templateId }, data });
    }),

  deleteTemplate: publicProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.statusUpdateTemplate.delete({ where: { id: input.templateId } });
    }),

  // ==========================================
  // SCHEDULE MANAGEMENT
  // ==========================================

  getSchedules: publicProcedure
    .input(z.object({ matterId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.matterId) where.matterId = input.matterId;
      return ctx.db.statusUpdateSchedule.findMany({ where, orderBy: { nextRunAt: "asc" } });
    }),

  createSchedule: publicProcedure
    .input(z.object({
      matterId: z.string(),
      frequencyDays: z.number().min(7).max(90).default(30),
      templateId: z.string().optional(),
      autoPublish: z.boolean().optional(),
      nextRunAt: z.date().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const nextRun = input.nextRunAt || new Date(Date.now() + input.frequencyDays * 24 * 60 * 60 * 1000);
      return ctx.db.statusUpdateSchedule.create({
        data: {
          matterId: input.matterId,
          frequencyDays: input.frequencyDays,
          templateId: input.templateId,
          autoPublish: input.autoPublish || false,
          nextRunAt: nextRun,
          userId: DEFAULT_USER_ID,
          firmId: DEFAULT_FIRM_ID,
        },
      });
    }),

  pauseSchedule: publicProcedure
    .input(z.object({ scheduleId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.statusUpdateSchedule.update({ where: { id: input.scheduleId }, data: { isPaused: true } });
    }),

  resumeSchedule: publicProcedure
    .input(z.object({ scheduleId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.statusUpdateSchedule.update({ where: { id: input.scheduleId }, data: { isPaused: false } });
    }),

  deleteSchedule: publicProcedure
    .input(z.object({ scheduleId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.statusUpdateSchedule.delete({ where: { id: input.scheduleId } });
    }),

  processScheduled: publicProcedure
    .mutation(async () => {
      const processed = await processScheduledUpdates(DEFAULT_FIRM_ID, DEFAULT_USER_ID);
      return { processed };
    }),

  // ==========================================
  // ANALYTICS
  // ==========================================

  getUpdateAnalytics: publicProcedure.query(async ({ ctx }) => {
    const total = await ctx.db.statusUpdateQueue.count({ where: { firmId: DEFAULT_FIRM_ID } });
    const delivered = await ctx.db.statusUpdateQueue.count({ where: { firmId: DEFAULT_FIRM_ID, status: { in: ["delivered", "auto_published"] } } });
    const pending = await ctx.db.statusUpdateQueue.count({ where: { firmId: DEFAULT_FIRM_ID, status: "pending_approval" } });

    const byTrigger = await ctx.db.statusUpdateQueue.groupBy({
      by: ["triggerSource"],
      _count: { triggerSource: true },
      where: { firmId: DEFAULT_FIRM_ID },
      orderBy: { _count: { triggerSource: "desc" } },
    });

    const byPracticeArea = await ctx.db.statusUpdateQueue.groupBy({
      by: ["practiceArea"],
      _count: { practiceArea: true },
      where: { firmId: DEFAULT_FIRM_ID },
      orderBy: { _count: { practiceArea: "desc" } },
    });

    return {
      total,
      delivered,
      pending,
      approvalRate: total > 0 ? Math.round((delivered / total) * 100) : 100,
      byTrigger: byTrigger.map((t) => ({ source: t.triggerSource, count: t._count.triggerSource })),
      byPracticeArea: byPracticeArea.filter((p) => p.practiceArea).map((p) => ({ area: p.practiceArea, count: p._count.practiceArea })),
    };
  }),

  getMatterUpdateHistory: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.statusUpdateQueue.findMany({
        where: { matterId: input.matterId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }),
});
