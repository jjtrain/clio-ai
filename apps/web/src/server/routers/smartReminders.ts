import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { runAllDetectors } from "@/lib/smart-reminders/pattern-detector";
import { processScheduledReminders, expireStaleReminders, scheduleRemindersForPattern } from "@/lib/smart-reminders/scheduler";
import { trackBehavior } from "@/lib/smart-reminders/instrumentation";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const smartRemindersRouter = router({
  // PATTERNS
  getPatterns: publicProcedure
    .input(z.object({ status: z.string().optional(), patternType: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { userId: DEFAULT_USER_ID };
      if (input.status) where.status = { in: input.status.split(",") };
      if (input.patternType) where.patternType = input.patternType;
      return ctx.db.learnedPattern.findMany({ where, orderBy: { confidenceScore: "desc" } });
    }),

  updatePattern: publicProcedure
    .input(z.object({ patternId: z.string(), status: z.string().optional(), reminderEnabled: z.boolean().optional(), reminderOffsetHours: z.number().optional(), reminderMessage: z.string().optional(), reminderChannels: z.any().optional(), userFeedback: z.string().optional(), userNotes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { patternId, ...data } = input;
      const pattern = await ctx.db.learnedPattern.update({ where: { id: patternId }, data });

      if (input.status === "ACTIVE" || input.reminderEnabled) {
        await scheduleRemindersForPattern(pattern);
      }
      if (input.status === "DISMISSED") {
        await ctx.db.smartReminderRecord.deleteMany({ where: { patternId, status: "PENDING" } });
      }

      return pattern;
    }),

  snoozePattern: publicProcedure
    .input(z.object({ patternId: z.string(), days: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.learnedPattern.update({ where: { id: input.patternId }, data: { status: "SNOOZED" } });
    }),

  // REMINDERS
  getReminders: publicProcedure
    .input(z.object({ status: z.string().optional(), limit: z.number().optional().default(20) }))
    .query(async ({ ctx, input }) => {
      const where: any = { userId: DEFAULT_USER_ID };
      if (input.status) where.status = { in: input.status.split(",") };
      return ctx.db.smartReminderRecord.findMany({ where, include: { pattern: { select: { label: true, patternType: true } } }, orderBy: { scheduledFor: "asc" }, take: input.limit });
    }),

  respondToReminder: publicProcedure
    .input(z.object({ reminderId: z.string(), response: z.enum(["acted", "dismissed", "snoozed", "already_done"]), snoozedUntil: z.date().optional() }))
    .mutation(async ({ ctx, input }) => {
      const data: any = { userResponse: input.response };
      if (input.response === "acted") { data.status = "ACTED"; data.actedOnAt = new Date(); }
      else if (input.response === "dismissed") { data.status = "DISMISSED"; data.dismissedAt = new Date(); }
      else if (input.response === "snoozed") { data.status = "SNOOZED"; data.snoozedUntil = input.snoozedUntil || new Date(Date.now() + 86400000); }
      else if (input.response === "already_done") { data.status = "ACTED"; data.actedOnAt = new Date(); }

      const reminder = await ctx.db.smartReminderRecord.update({ where: { id: input.reminderId }, data });

      // Record behavior if acted
      if (input.response === "acted" || input.response === "already_done") {
        await trackBehavior({ userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID, eventType: reminder.reminderType || "CUSTOM", metadata: { fromSmartReminder: true } });
      }

      return reminder;
    }),

  // DETECTION
  runDetection: publicProcedure.mutation(async () => {
    return runAllDetectors(DEFAULT_USER_ID, DEFAULT_FIRM_ID);
  }),

  // PROCESSING
  processReminders: publicProcedure.mutation(async () => {
    const sent = await processScheduledReminders();
    const expired = await expireStaleReminders();
    return { sent, expired };
  }),

  // STATS
  getStats: publicProcedure.query(async ({ ctx }) => {
    const patterns = await ctx.db.learnedPattern.findMany({ where: { userId: DEFAULT_USER_ID } });
    const active = patterns.filter((p) => p.status === "ACTIVE");
    const shown = patterns.filter((p) => p.status === "SHOWN");

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const recentReminders = await ctx.db.smartReminderRecord.findMany({
      where: { userId: DEFAULT_USER_ID, createdAt: { gte: thirtyDaysAgo } },
    });
    const acted = recentReminders.filter((r) => r.status === "ACTED");
    const actedRate = recentReminders.length > 0 ? acted.length / recentReminders.length : 0;

    const byType: Record<string, number> = {};
    for (const p of patterns) byType[p.patternType] = (byType[p.patternType] || 0) + 1;

    return {
      totalPatterns: patterns.length,
      activePatterns: active.length,
      suggestedPatterns: shown.length,
      remindersActedOn30Days: acted.length,
      remindersActedOnRate: Math.round(actedRate * 100),
      patternsByType: byType,
      topPatterns: active.slice(0, 3),
    };
  }),

  // TRACK EVENT (for manual tracking from UI)
  trackEvent: publicProcedure
    .input(z.object({ eventType: z.string(), entityType: z.string().optional(), entityId: z.string().optional(), matterId: z.string().optional(), metadata: z.any().optional() }))
    .mutation(async ({ input }) => {
      await trackBehavior({ ...input, userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID });
      return { success: true };
    }),
});
