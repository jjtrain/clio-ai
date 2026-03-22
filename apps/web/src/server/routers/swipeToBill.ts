import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as billEngine from "@/lib/billable-event-engine";

export const swipeToBillRouter = router({
  pending: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      return billEngine.getPendingEvents(input.userId);
    }),

  get: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      return db.billableEvent.findUnique({ where: { id: input.eventId } });
    }),

  bill: publicProcedure
    .input(z.object({
      eventId: z.string(),
      overrides: z.object({
        matterId: z.string().optional(),
        duration: z.number().optional(),
        activity: z.string().optional(),
        description: z.string().optional(),
        rate: z.number().optional(),
      }).optional(),
    }))
    .mutation(async ({ input }) => {
      return billEngine.convertToTimeEntry(input.eventId, input.overrides);
    }),

  billQuick: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ input }) => {
      return billEngine.convertToTimeEntry(input.eventId);
    }),

  billAll: publicProcedure
    .input(z.object({ eventIds: z.array(z.string()).optional() }))
    .mutation(async ({ input }) => {
      let billed = 0;
      let skipped = 0;
      if (input.eventIds) {
        for (const id of input.eventIds) {
          await billEngine.convertToTimeEntry(id);
          billed++;
        }
      } else {
        const pending = await db.billableEvent.findMany({
          where: { status: "BEVS_PENDING" as any, matterMatchConfidence: { in: ["HIGH", "MEDIUM"] } },
        });
        for (const ev of pending) {
          await billEngine.convertToTimeEntry(ev.id);
          billed++;
        }
        const low = await db.billableEvent.count({
          where: { status: "BEVS_PENDING" as any, matterMatchConfidence: { notIn: ["HIGH", "MEDIUM"] } },
        });
        skipped = low;
      }
      return { billed, skipped };
    }),

  dismiss: publicProcedure
    .input(z.object({ eventId: z.string(), reason: z.string() }))
    .mutation(async ({ input }) => {
      await billEngine.dismissEvent(input.eventId, input.reason);
      return { success: true };
    }),

  dismissAll: publicProcedure
    .input(z.object({ eventIds: z.array(z.string()).optional(), reason: z.string() }))
    .mutation(async ({ input }) => {
      const ids = input.eventIds ?? [];
      for (const id of ids) await billEngine.dismissEvent(id, input.reason);
      return { count: ids.length };
    }),

  snooze: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ input }) => {
      await billEngine.snoozeEvent(input.eventId);
      return { success: true };
    }),

  assignMatter: publicProcedure
    .input(z.object({ eventId: z.string(), matterId: z.string() }))
    .mutation(async ({ input }) => {
      await db.billableEvent.update({
        where: { id: input.eventId },
        data: { matterId: input.matterId, matterMatchConfidence: "HIGH" as any, matterMatchMethod: "manual" },
      });
      await billEngine.generateSuggestions(input.eventId);
      return { success: true };
    }),

  regenerateNarrative: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ input }) => {
      return billEngine.generateSuggestions(input.eventId);
    }),

  createManual: publicProcedure
    .input(z.object({
      eventType: z.string(), source: z.string().optional(), userId: z.string(),
      contactName: z.string().optional(), matterId: z.string().optional(),
      durationSeconds: z.number(), subject: z.string().optional(), description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return billEngine.detectAndCreateEvent({
        eventType: input.eventType, source: input.source ?? "manual",
        userId: input.userId, contactName: input.contactName,
        subject: input.subject, startTime: new Date(),
        durationSeconds: input.durationSeconds, metadata: input.description ? { description: input.description } : undefined,
      });
    }),

  history: publicProcedure
    .input(z.object({
      status: z.string().optional(), eventType: z.string().optional(), source: z.string().optional(),
      matterId: z.string().optional(), from: z.date().optional(), to: z.date().optional(), page: z.number().optional(),
    }))
    .query(async ({ input }) => {
      const page = input.page ?? 1;
      const where: any = {};
      if (input.status) where.status = input.status;
      if (input.eventType) where.eventType = input.eventType;
      if (input.source) where.source = input.source;
      if (input.matterId) where.matterId = input.matterId;
      if (input.from || input.to) where.startTime = { ...(input.from ? { gte: input.from } : {}), ...(input.to ? { lte: input.to } : {}) };
      return db.billableEvent.findMany({ where, orderBy: { startTime: "desc" }, take: 20, skip: (page - 1) * 20 });
    }),

  stats: publicProcedure
    .input(z.object({
      userId: z.string(),
      from: z.date().optional(),
      to: z.date().optional(),
    }))
    .query(async ({ input }) => {
      const from = input.from ?? new Date(0);
      const to = input.to ?? new Date();
      return billEngine.getEventStats(input.userId, { from, to });
    }),

  "settings.get": publicProcedure
    .query(async () => {
      const settings = await db.swipeToBillSettings.findFirst();
      if (settings) return settings;
      return db.swipeToBillSettings.create({
        data: { snoozeMinutes: 60, maxSnoozeCount: 3, defaultBillingIncrement: 6, roundingRule: "ROUND_UP" },
      });
    }),

  "settings.update": publicProcedure
    .input(z.object({
      snoozeMinutes: z.number().optional(), maxSnoozeCount: z.number().optional(),
      defaultBillingIncrement: z.number().optional(), roundingRule: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const existing = await db.swipeToBillSettings.findFirst();
      return db.swipeToBillSettings.upsert({
        where: { id: existing?.id ?? "" },
        create: { snoozeMinutes: 60, maxSnoozeCount: 3, defaultBillingIncrement: 6, roundingRule: "ROUND_UP", ...input },
        update: input,
      });
    }),
});
