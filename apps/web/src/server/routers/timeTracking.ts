import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { importEntries, syncToBuiltIn, getProductivityDashboard, getCapturedVsBilled, matchToMatter } from "@/lib/time-tracking-engine";
import { chrometaTestConnection, chrometaGetEntries, chrometaGetApplicationSummary, wisetimeTestConnection, wisetimeGetEntries, wisetimeGetUnreviewed, ebillityTestConnection, ebillityGetEntries, ebillityStartTimer } from "@/lib/integrations/time-providers";

const TIME_PROVIDERS = ["CHROMETA", "WISETIME", "EBILLITY"] as const;
function maskKey(k: string | null) { return k ? "****" + k.slice(-4) : null; }

export const timeTrackingRouter = router({
  // ─── Settings ──────────────────────────────────────────────────
  "settings.list": publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.timeTrackingIntegration.findMany({ orderBy: { provider: "asc" } });
    return all.map((i) => ({ ...i, apiKey: maskKey(i.apiKey), apiSecret: maskKey(i.apiSecret) }));
  }),
  "settings.update": publicProcedure
    .input(z.object({ provider: z.enum(TIME_PROVIDERS), displayName: z.string().optional(), apiKey: z.string().optional().nullable(), baseUrl: z.string().optional().nullable(), accountId: z.string().optional().nullable(), userId: z.string().optional().nullable(), isEnabled: z.boolean().optional(), autoSync: z.boolean().optional(), autoApprove: z.boolean().optional(), defaultBillingRate: z.number().optional().nullable(), roundingRule: z.string().optional(), roundingIncrement: z.number().optional(), minimumEntry: z.number().optional(), settings: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { provider, ...data } = input;
      const clean: any = { ...data };
      if (clean.apiKey?.startsWith("****")) delete clean.apiKey;
      return ctx.db.timeTrackingIntegration.upsert({ where: { provider }, create: { provider, displayName: input.displayName || provider, ...clean }, update: clean });
    }),
  "settings.test": publicProcedure
    .input(z.object({ provider: z.enum(TIME_PROVIDERS) }))
    .mutation(async ({ input }) => {
      const tests: Record<string, () => Promise<any>> = { CHROMETA: chrometaTestConnection, WISETIME: wisetimeTestConnection, EBILLITY: ebillityTestConnection };
      return (tests[input.provider] || (() => ({ success: false, error: "Unknown" })))();
    }),

  // ─── Import & Sync ─────────────────────────────────────────────
  "sync.run": publicProcedure
    .input(z.object({ provider: z.enum(TIME_PROVIDERS), from: z.string().optional(), to: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const range = input.from && input.to ? { from: input.from, to: input.to } : undefined;
      let rawEntries: any[] = [];

      if (input.provider === "CHROMETA") { const r = await chrometaGetEntries(range); if (r.success) rawEntries = (r as any).data?.timeslips || (r as any).data || []; }
      if (input.provider === "WISETIME") { const r = await wisetimeGetEntries(range); if (r.success) rawEntries = (r as any).data?.time_entries || (r as any).data || []; }
      if (input.provider === "EBILLITY") { const r = await ebillityGetEntries(range); if (r.success) rawEntries = (r as any).data?.time_entries || (r as any).data || []; }

      if (!Array.isArray(rawEntries)) rawEntries = [];
      const result = await importEntries(input.provider, rawEntries);
      await ctx.db.timeTrackingIntegration.update({ where: { provider: input.provider }, data: { lastSyncAt: new Date(), lastSyncStatus: "SUCCESS" } });
      return result;
    }),
  "sync.syncToBuiltIn": publicProcedure
    .input(z.object({ entryId: z.string() }))
    .mutation(async ({ input }) => syncToBuiltIn(input.entryId)),
  "sync.bulkSyncToBuiltIn": publicProcedure
    .input(z.object({ entryIds: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      let synced = 0;
      for (const id of input.entryIds) { try { await syncToBuiltIn(id); synced++; } catch {} }
      return { synced };
    }),

  // ─── Entries ───────────────────────────────────────────────────
  "entries.list": publicProcedure
    .input(z.object({ provider: z.string().optional(), matterId: z.string().optional(), userId: z.string().optional(), billingStatus: z.string().optional(), isReviewed: z.boolean().optional(), matterMatchConfidence: z.string().optional(), from: z.string().optional(), to: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.provider) where.provider = input.provider;
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.userId) where.userId = input.userId;
      if (input?.billingStatus) where.billingStatus = input.billingStatus;
      if (input?.isReviewed !== undefined) where.isReviewed = input.isReviewed;
      if (input?.matterMatchConfidence) where.matterMatchConfidence = input.matterMatchConfidence;
      if (input?.from || input?.to) { where.date = {}; if (input?.from) where.date.gte = new Date(input.from); if (input?.to) where.date.lte = new Date(input.to); }
      return ctx.db.externalTimeEntry.findMany({ where, orderBy: { date: "desc" }, take: input?.limit || 50 });
    }),
  "entries.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.externalTimeEntry.findUniqueOrThrow({ where: { id: input.id } })),
  "entries.review": publicProcedure
    .input(z.object({ entryId: z.string(), approved: z.boolean(), matterId: z.string().optional(), description: z.string().optional(), adjustedDuration: z.number().optional(), isBillable: z.boolean().optional(), activity: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { entryId, approved, ...data } = input;
      const update: any = { isReviewed: true, reviewedAt: new Date(), billingStatus: approved ? "APPROVED" : "NON_BILLABLE" };
      if (data.matterId) update.matterId = data.matterId;
      if (data.description) update.adjustedDescription = data.description;
      if (data.adjustedDuration) update.adjustedDuration = data.adjustedDuration;
      if (data.isBillable !== undefined) update.isBillable = data.isBillable;
      if (data.activity) update.activity = data.activity;
      const entry = await ctx.db.externalTimeEntry.update({ where: { id: entryId }, data: update });
      // Auto-sync if approved
      if (approved && entry.matterId) { try { await syncToBuiltIn(entryId); } catch {} }
      return entry;
    }),
  "entries.bulkReview": publicProcedure
    .input(z.object({ entries: z.array(z.object({ entryId: z.string(), approved: z.boolean(), matterId: z.string().optional() })) }))
    .mutation(async ({ ctx, input }) => {
      let approved = 0, dismissed = 0;
      for (const e of input.entries) {
        await ctx.db.externalTimeEntry.update({ where: { id: e.entryId }, data: { isReviewed: true, reviewedAt: new Date(), billingStatus: e.approved ? "APPROVED" : "NON_BILLABLE", matterId: e.matterId } });
        if (e.approved) { try { await syncToBuiltIn(e.entryId); approved++; } catch { approved++; } }
        else dismissed++;
      }
      return { approved, dismissed };
    }),
  "entries.dismiss": publicProcedure
    .input(z.object({ entryId: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.externalTimeEntry.update({ where: { id: input.entryId }, data: { isReviewed: true, billingStatus: "NON_BILLABLE", isBillable: false, notes: input.reason } })),
  "entries.assignMatter": publicProcedure
    .input(z.object({ entryId: z.string(), matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.findUniqueOrThrow({ where: { id: input.matterId } });
      return ctx.db.externalTimeEntry.update({ where: { id: input.entryId }, data: { matterId: input.matterId, clientId: matter.clientId, matterMatchConfidence: "HIGH", matterMatchMethod: "manual" } });
    }),
  "entries.getUnreviewed": publicProcedure
    .input(z.object({ provider: z.string().optional(), userId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { isReviewed: false };
      if (input?.provider) where.provider = input.provider;
      if (input?.userId) where.userId = input.userId;
      return ctx.db.externalTimeEntry.findMany({ where, orderBy: { date: "desc" }, take: 100 });
    }),

  // ─── Match Rules ───────────────────────────────────────────────
  "rules.list": publicProcedure.query(async ({ ctx }) => ctx.db.timeMatchRule.findMany({ orderBy: { priority: "desc" } })),
  "rules.create": publicProcedure
    .input(z.object({ ruleType: z.string(), pattern: z.string(), matchField: z.string(), matterId: z.string().optional(), clientId: z.string().optional(), activity: z.string().optional(), isBillable: z.boolean().optional(), priority: z.number().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.timeMatchRule.create({ data: input })),
  "rules.update": publicProcedure
    .input(z.object({ id: z.string(), pattern: z.string().optional(), matchField: z.string().optional(), matterId: z.string().optional().nullable(), activity: z.string().optional().nullable(), isBillable: z.boolean().optional(), priority: z.number().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => { const { id, ...data } = input; return ctx.db.timeMatchRule.update({ where: { id }, data }); }),
  "rules.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.timeMatchRule.delete({ where: { id: input.id } })),

  // ─── Reports ───────────────────────────────────────────────────
  "reports.productivity": publicProcedure
    .input(z.object({ from: z.string(), to: z.string(), userId: z.string().optional() }))
    .query(async ({ input }) => getProductivityDashboard(input, input.userId)),
  "reports.capturedVsBilled": publicProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .query(async ({ input }) => getCapturedVsBilled(input)),

  // ─── Dashboard Stats ───────────────────────────────────────────
  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const todayEntries = await ctx.db.externalTimeEntry.findMany({ where: { date: { gte: today } } });
    const weekEntries = await ctx.db.externalTimeEntry.findMany({ where: { date: { gte: weekStart } } });
    const unreviewed = await ctx.db.externalTimeEntry.count({ where: { isReviewed: false } });

    const todayHours = todayEntries.reduce((s, e) => s + Number(e.durationHours), 0);
    const weekHours = weekEntries.reduce((s, e) => s + Number(e.durationHours), 0);
    const billableHours = weekEntries.filter((e) => e.isBillable).reduce((s, e) => s + Number(e.durationHours), 0);
    const billingAmount = weekEntries.filter((e) => e.billingStatus === "APPROVED").reduce((s, e) => s + Number(e.billingAmount || 0), 0);

    return {
      todayHours: Math.round(todayHours * 10) / 10,
      weekHours: Math.round(weekHours * 10) / 10,
      billablePercentage: weekHours > 0 ? Math.round((billableHours / weekHours) * 1000) / 10 : 0,
      unreviewed,
      billingAmount: Math.round(billingAmount * 100) / 100,
      providers: await ctx.db.timeTrackingIntegration.count({ where: { isEnabled: true } }),
    };
  }),
});
