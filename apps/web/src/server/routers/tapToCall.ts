import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as callEngine from "@/lib/call-engine";

export const tapToCallRouter = router({
  // ─── Calls (1-8) ─────────────────────────────────────────────────
  initiate: publicProcedure
    .input(z.object({ phone: z.string(), userId: z.string(), direction: z.string().optional(), matterId: z.string().optional() }))
    .mutation(async ({ input }) => callEngine.initiateCall(input)),

  startTimer: publicProcedure
    .input(z.object({ callLogId: z.string() }))
    .mutation(async ({ input }) => callEngine.startCallTimer(input.callLogId)),

  endCall: publicProcedure
    .input(z.object({ callLogId: z.string(), callDuration: z.number(), callStatus: z.string(), notes: z.string().optional(), subject: z.string().optional() }))
    .mutation(async ({ input }) => callEngine.endCall(input.callLogId, input)),

  get: publicProcedure
    .input(z.object({ callLogId: z.string() }))
    .query(async ({ input }) => db.callLog.findUnique({ where: { id: input.callLogId }, include: { matter: true, client: true } } as any)),

  update: publicProcedure
    .input(z.object({ callLogId: z.string(), notes: z.string().optional(), subject: z.string().optional(), matterId: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { callLogId, ...data } = input;
      return db.callLog.update({ where: { id: callLogId }, data: data as any });
    }),

  list: publicProcedure
    .input(z.object({ userId: z.string(), matterId: z.string().optional(), clientId: z.string().optional(), status: z.string().optional(), page: z.number().default(1), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const where: any = { userId: input.userId };
      if (input.matterId) where.matterId = input.matterId;
      if (input.clientId) where.clientId = input.clientId;
      if (input.status) where.callStatus = input.status;
      const [items, total] = await Promise.all([
        db.callLog.findMany({ where, orderBy: { callStarted: "desc" } as any, skip: (input.page - 1) * input.limit, take: input.limit, include: { matter: true } } as any),
        db.callLog.count({ where }),
      ]);
      return { items, total, pages: Math.ceil(total / input.limit) };
    }),

  getRecent: publicProcedure
    .input(z.object({ userId: z.string(), limit: z.number().optional() }))
    .query(async ({ input }) => callEngine.getRecentCalls(input.userId, input.limit)),

  search: publicProcedure
    .input(z.object({ query: z.string(), userId: z.string() }))
    .query(async ({ input }) => {
      return db.callLog.findMany({
        where: { userId: input.userId, OR: [{ contactName: { contains: input.query } }, { contactPhone: { contains: input.query } }] } as any,
        orderBy: { callStarted: "desc" } as any, take: 20,
      });
    }),

  // ─── Billing (9-13) ──────────────────────────────────────────────
  createTimeEntry: publicProcedure
    .input(z.object({ callLogId: z.string(), duration: z.number().optional(), description: z.string().optional() }))
    .mutation(async ({ input }) => callEngine.createTimeEntryFromCall(input.callLogId, input)),

  markNotBillable: publicProcedure
    .input(z.object({ callLogId: z.string() }))
    .mutation(async ({ input }) => db.callLog.update({ where: { id: input.callLogId }, data: { billingStatus: "CBS_NOT_BILLABLE" as any } })),

  dismiss: publicProcedure
    .input(z.object({ callLogId: z.string() }))
    .mutation(async ({ input }) => db.callLog.update({ where: { id: input.callLogId }, data: { billingStatus: "CBS_DISMISSED" as any } })),

  getUnbilled: publicProcedure
    .query(async () => db.callLog.findMany({ where: { billingStatus: "CBS_UNBILLED" as any, callStatus: "CLS_COMPLETED" as any }, orderBy: { callStarted: "desc" } as any, include: { matter: true } } as any)),

  billAll: publicProcedure
    .mutation(async () => {
      const unbilled = await db.callLog.findMany({ where: { billingStatus: "CBS_UNBILLED" as any, callStatus: "CLS_COMPLETED" as any } } as any);
      for (const call of unbilled) await callEngine.createTimeEntryFromCall(call.id);
      return { count: unbilled.length };
    }),

  // ─── Follow-Up (14-15) ───────────────────────────────────────────
  createFollowUp: publicProcedure
    .input(z.object({ callLogId: z.string(), title: z.string().optional(), dueDate: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ input }) => callEngine.createFollowUpTask(input.callLogId, { ...input, dueDate: input.dueDate ? new Date(input.dueDate) : undefined })),

  getFollowUpsDue: publicProcedure
    .query(async () => db.callLog.findMany({ where: { followUpRequired: true, followUpDate: { lte: new Date() } } as any, orderBy: { followUpDate: "asc" } as any, include: { matter: true } } as any)),

  // ─── AI (16-17) ──────────────────────────────────────────────────
  generateNarrative: publicProcedure
    .input(z.object({ callLogId: z.string() }))
    .mutation(async ({ input }) => callEngine.generateCallNarrative(input.callLogId)),

  processNotes: publicProcedure
    .input(z.object({ callLogId: z.string(), notes: z.string() }))
    .mutation(async ({ input }) => callEngine.processPostCallNotes(input.callLogId, input.notes)),

  // ─── Contact (18) ────────────────────────────────────────────────
  matchPhone: publicProcedure
    .input(z.object({ phone: z.string() }))
    .query(async ({ input }) => callEngine.matchPhoneToContact(input.phone)),

  // ─── Stats (19-20) ───────────────────────────────────────────────
  getStats: publicProcedure
    .input(z.object({ userId: z.string(), start: z.string().optional(), end: z.string().optional() }))
    .query(async ({ input }) => {
      const now = new Date();
      const start = input.start ? new Date(input.start) : new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const end = input.end ? new Date(input.end) : now;
      return callEngine.getCallStats(input.userId, { start, end });
    }),

  getUnloggedSummary: publicProcedure
    .query(async () => {
      const calls = await db.callLog.findMany({ where: { billingStatus: "CBS_UNBILLED" as any, callStatus: "CLS_COMPLETED" as any } } as any);
      const totalMinutes = calls.reduce((sum: number, c: any) => sum + Math.ceil((c.callDuration ?? 0) / 60), 0);
      return { count: calls.length, totalMinutes };
    }),

  // ─── Settings (21-22) ────────────────────────────────────────────
  "settings.get": publicProcedure
    .query(async () => {
      const settings = await db.tapToCallSettings.findFirst();
      return settings ?? db.tapToCallSettings.create({ data: { roundingIncrement: 6, roundingRule: "round_up", minimumDuration: 6, autoGenerateNarrative: true, defaultBillable: true } as any });
    }),

  "settings.update": publicProcedure
    .input(z.object({ id: z.string().optional(), roundingIncrement: z.number().optional(), roundingRule: z.string().optional(), minimumDuration: z.number().optional(), autoGenerateNarrative: z.boolean().optional(), defaultBillable: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.tapToCallSettings.upsert({ where: { id: id ?? "default" }, create: { ...data } as any, update: { ...data } as any });
    }),
});
