import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { testConnection, syncAllData, calculateOvernights } from "@/lib/integrations/ourfamilywizard";

const OFW_PARTY = ["PARENT1", "PARENT2"] as const;

export const familyLawRouter = router({
  // ─── Family Cases ──────────────────────────────────────────────

  getCases: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.familyCase.findMany({ include: { matter: { include: { client: true } }, ofwConnection: true }, orderBy: { createdAt: "desc" } });
  }),

  getCase: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.familyCase.findUnique({ where: { matterId: input.matterId }, include: { matter: { include: { client: true } }, ofwConnection: true } });
    }),

  createCase: publicProcedure
    .input(z.object({ matterId: z.string(), caseType: z.string().optional(), opposingPartyName: z.string().optional(), childrenNames: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.familyCase.create({ data: input })),

  updateCase: publicProcedure
    .input(z.object({ matterId: z.string(), caseType: z.string().optional(), opposingPartyName: z.string().optional(), childrenNames: z.string().optional(), custodySplitClient: z.number().optional(), custodySplitOpposing: z.number().optional(), supportAmount: z.number().optional(), supportType: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { matterId, ...data } = input;
      return ctx.db.familyCase.update({ where: { matterId }, data });
    }),

  // ─── OFW Settings ──────────────────────────────────────────────

  "ofw.getSettings": publicProcedure.query(async ({ ctx }) => {
    let s = await ctx.db.oFWSettings.findUnique({ where: { id: "default" } });
    if (!s) s = await ctx.db.oFWSettings.create({ data: { id: "default" } });
    return { ...s, apiKey: s.apiKey ? "****" + s.apiKey.slice(-4) : null, apiSecret: s.apiSecret ? "****" : null };
  }),

  "ofw.updateSettings": publicProcedure
    .input(z.object({ isEnabled: z.boolean().optional(), apiKey: z.string().optional().nullable(), apiSecret: z.string().optional().nullable(), baseUrl: z.string().optional().nullable(), accountId: z.string().optional().nullable(), autoSyncEnabled: z.boolean().optional(), syncFrequency: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const data: any = { ...input };
      if (data.apiKey?.startsWith("****")) delete data.apiKey;
      if (data.apiSecret?.startsWith("****")) delete data.apiSecret;
      return ctx.db.oFWSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
    }),

  "ofw.testConnection": publicProcedure.mutation(async () => testConnection()),

  // ─── OFW Connection ────────────────────────────────────────────

  "ofw.connect": publicProcedure
    .input(z.object({ familyCaseId: z.string(), ofwFamilyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const fc = await ctx.db.familyCase.findUniqueOrThrow({ where: { id: input.familyCaseId } });
      const conn = await ctx.db.oFWConnection.create({
        data: { familyCaseId: input.familyCaseId, matterId: fc.matterId, ofwFamilyId: input.ofwFamilyId, connectionStatus: "ACTIVE" },
      });
      // Initial sync
      try {
        const summary = await syncAllData(conn.id);
        return { ...conn, syncSummary: summary };
      } catch {
        return conn;
      }
    }),

  "ofw.disconnect": publicProcedure
    .input(z.object({ connectionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.oFWConnection.update({ where: { id: input.connectionId }, data: { connectionStatus: "DISCONNECTED" } });
    }),

  "ofw.getConnection": publicProcedure
    .input(z.object({ familyCaseId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.oFWConnection.findUnique({ where: { familyCaseId: input.familyCaseId }, include: { _count: { select: { expenses: true, messages: true, scheduleEvents: true, journalEntries: true } } } });
    }),

  "ofw.sync": publicProcedure
    .input(z.object({ connectionId: z.string(), from: z.string().optional(), to: z.string().optional() }))
    .mutation(async ({ input }) => {
      const range = input.from && input.to ? { from: input.from, to: input.to } : undefined;
      return syncAllData(input.connectionId, range);
    }),

  // ─── OFW Data ──────────────────────────────────────────────────

  "ofw.expenses.list": publicProcedure
    .input(z.object({ familyCaseId: z.string(), category: z.string().optional(), paidBy: z.enum(OFW_PARTY).optional(), limit: z.number().default(100) }))
    .query(async ({ ctx, input }) => {
      const where: any = { familyCaseId: input.familyCaseId };
      if (input.category) where.category = input.category;
      if (input.paidBy) where.paidBy = input.paidBy;
      return ctx.db.oFWExpenseRecord.findMany({ where, orderBy: { dateIncurred: "desc" }, take: input.limit });
    }),

  "ofw.expenses.summary": publicProcedure
    .input(z.object({ familyCaseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const expenses = await ctx.db.oFWExpenseRecord.findMany({ where: { familyCaseId: input.familyCaseId } });
      const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
      const parent1Total = expenses.filter((e) => e.paidBy === "PARENT1").reduce((s, e) => s + Number(e.amount), 0);
      const parent2Total = expenses.filter((e) => e.paidBy === "PARENT2").reduce((s, e) => s + Number(e.amount), 0);
      const byCategory: Record<string, number> = {};
      for (const e of expenses) byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
      const pending = expenses.filter((e) => e.reimbursementStatus === "PENDING").reduce((s, e) => s + Number(e.amount), 0);
      const disputed = expenses.filter((e) => e.reimbursementStatus === "DISPUTED").reduce((s, e) => s + Number(e.amount), 0);
      return { total, parent1Total, parent2Total, byCategory, pending, disputed, count: expenses.length };
    }),

  "ofw.messages.list": publicProcedure
    .input(z.object({ familyCaseId: z.string(), fromParent: z.enum(OFW_PARTY).optional(), flagged: z.boolean().optional(), search: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      const where: any = { familyCaseId: input.familyCaseId };
      if (input.fromParent) where.fromParent = input.fromParent;
      if (input.flagged) where.flagged = true;
      if (input.search) where.body = { contains: input.search, mode: "insensitive" };
      return ctx.db.oFWMessage.findMany({ where, orderBy: { sentAt: "desc" }, take: input.limit });
    }),

  "ofw.messages.flag": publicProcedure
    .input(z.object({ messageId: z.string(), flagged: z.boolean(), flagReason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.oFWMessage.update({ where: { id: input.messageId }, data: { flagged: input.flagged, flagReason: input.flagReason } })),

  "ofw.schedule.list": publicProcedure
    .input(z.object({ familyCaseId: z.string(), from: z.string().optional(), to: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { familyCaseId: input.familyCaseId };
      if (input.from || input.to) {
        where.startDate = {};
        if (input.from) where.startDate.gte = new Date(input.from);
        if (input.to) where.startDate.lte = new Date(input.to);
      }
      return ctx.db.oFWScheduleEvent.findMany({ where, orderBy: { startDate: "asc" } });
    }),

  "ofw.schedule.overnights": publicProcedure
    .input(z.object({ familyCaseId: z.string(), from: z.string(), to: z.string() }))
    .query(async ({ ctx, input }) => {
      const events = await ctx.db.oFWScheduleEvent.findMany({
        where: { familyCaseId: input.familyCaseId, startDate: { gte: new Date(input.from) }, endDate: { lte: new Date(input.to) } },
      });
      return calculateOvernights(events);
    }),

  "ofw.journal.list": publicProcedure
    .input(z.object({ familyCaseId: z.string(), author: z.enum(OFW_PARTY).optional(), flagged: z.boolean().optional(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      const where: any = { familyCaseId: input.familyCaseId };
      if (input.author) where.author = input.author;
      if (input.flagged) where.flagged = true;
      return ctx.db.oFWJournalEntry.findMany({ where, orderBy: { entryDate: "desc" }, take: input.limit });
    }),

  "ofw.journal.flag": publicProcedure
    .input(z.object({ entryId: z.string(), flagged: z.boolean(), flagReason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.oFWJournalEntry.update({ where: { id: input.entryId }, data: { flagged: input.flagged, flagReason: input.flagReason } })),
});
