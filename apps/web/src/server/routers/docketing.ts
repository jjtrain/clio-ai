import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { DeadlineEngine } from "@/lib/docketing/deadline-engine";

const engine = new DeadlineEngine();

const DEADLINE_STATUS = ["ACTIVE", "COMPLETED", "DISMISSED", "MISSED", "OVERRIDDEN"] as const;
const DEADLINE_PRIORITY = ["CRITICAL", "UPCOMING", "SCHEDULED"] as const;

export const docketingRouter = router({
  // ─── Integration Status ────────────────────────────────────────

  getIntegrationStatus: publicProcedure.query(() => engine.getIntegrationStatus()),

  // ─── Deadlines ─────────────────────────────────────────────────

  getDeadlines: publicProcedure
    .input(z.object({
      matterId: z.string().optional(),
      status: z.enum(DEADLINE_STATUS).optional(),
      priority: z.enum(DEADLINE_PRIORITY).optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;
      if (input?.priority) where.priority = input.priority;
      if (input?.dateFrom || input?.dateTo) {
        where.dueDate = {};
        if (input?.dateFrom) where.dueDate.gte = new Date(input.dateFrom);
        if (input?.dateTo) where.dueDate.lte = new Date(input.dateTo);
      }
      return ctx.db.deadline.findMany({
        where, include: { matter: true }, orderBy: { dueDate: "asc" }, take: input?.limit || 50,
      });
    }),

  getUpcomingDeadlines: publicProcedure
    .input(z.object({ days: z.number().default(30) }).optional())
    .query(async ({ ctx, input }) => {
      const days = input?.days || 30;
      return ctx.db.deadline.findMany({
        where: { status: "ACTIVE", dueDate: { lte: new Date(Date.now() + days * 24 * 60 * 60 * 1000) } },
        include: { matter: true },
        orderBy: { dueDate: "asc" },
      });
    }),

  getDeadlineDigest: publicProcedure.query(async () => engine.getDeadlineDigest()),

  addManualDeadline: publicProcedure
    .input(z.object({
      matterId: z.string(), title: z.string().min(1), dueDate: z.string().or(z.date()),
      description: z.string().optional(), ruleAuthority: z.string().optional(),
      jurisdiction: z.string().optional(), notes: z.string().optional(),
      consequenceOfMissing: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dueDate = new Date(input.dueDate);
      const daysOut = Math.floor((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const priority = daysOut <= 14 ? "CRITICAL" : daysOut <= 30 ? "UPCOMING" : "SCHEDULED";

      return ctx.db.deadline.create({
        data: { ...input, dueDate, source: "MANUAL", priority, status: "ACTIVE" },
      });
    }),

  updateDeadline: publicProcedure
    .input(z.object({
      deadlineId: z.string(), title: z.string().optional(), dueDate: z.string().or(z.date()).optional(),
      description: z.string().optional(), ruleAuthority: z.string().optional(), notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { deadlineId, dueDate, ...rest } = input;
      const data: any = { ...rest };
      if (dueDate) data.dueDate = new Date(dueDate);
      return ctx.db.deadline.update({ where: { id: deadlineId }, data });
    }),

  completeDeadline: publicProcedure
    .input(z.object({ deadlineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.deadline.update({ where: { id: input.deadlineId }, data: { status: "COMPLETED", completedAt: new Date() } });
    }),

  dismissDeadline: publicProcedure
    .input(z.object({ deadlineId: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.deadline.update({ where: { id: input.deadlineId }, data: { status: "DISMISSED", dismissedAt: new Date(), dismissReason: input.reason } });
    }),

  overrideDeadline: publicProcedure
    .input(z.object({ deadlineId: z.string(), newDate: z.string().or(z.date()), courtOrderRef: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.deadline.update({ where: { id: input.deadlineId }, data: { dueDate: new Date(input.newDate), status: "OVERRIDDEN", overriddenByOrderRef: input.courtOrderRef } });
    }),

  calculateDeadlines: publicProcedure
    .input(z.object({ matterId: z.string(), rulesetId: z.string(), triggerId: z.string(), triggerDate: z.string().or(z.date()), methodOfService: z.string().optional() }))
    .mutation(async ({ input }) => {
      const result = await engine.getLawToolBox().calculateDeadlines({
        rulesetId: input.rulesetId, triggerId: input.triggerId,
        triggerDate: new Date(input.triggerDate), methodOfService: input.methodOfService,
      });
      return result;
    }),

  saveDeadlines: publicProcedure
    .input(z.object({
      matterId: z.string(),
      deadlines: z.array(z.object({ title: z.string(), dueDate: z.string(), ruleAuthority: z.string().optional(), description: z.string().optional(), consequenceOfMissing: z.string().optional() })),
    }))
    .mutation(async ({ ctx, input }) => {
      const saved = [];
      for (const d of input.deadlines) {
        const dueDate = new Date(d.dueDate);
        const daysOut = Math.floor((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        saved.push(await ctx.db.deadline.create({
          data: { matterId: input.matterId, title: d.title, dueDate, ruleAuthority: d.ruleAuthority, description: d.description, consequenceOfMissing: d.consequenceOfMissing, source: "LAWTOOLBOX", priority: daysOut <= 14 ? "CRITICAL" : daysOut <= 30 ? "UPCOMING" : "SCHEDULED" },
        }));
      }
      return saved;
    }),

  recalculatePriorities: publicProcedure.mutation(async () => engine.recalculatePriorities()),

  // ─── Court Cases ───────────────────────────────────────────────

  getCourtCases: publicProcedure
    .input(z.object({ matterId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      return ctx.db.courtCase.findMany({ where, include: { matter: true, _count: { select: { filings: true } } }, orderBy: { updatedAt: "desc" } });
    }),

  addCourtCase: publicProcedure
    .input(z.object({ matterId: z.string(), courtName: z.string(), caseNumber: z.string(), caseName: z.string().optional(), judge: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const courtCase = await ctx.db.courtCase.create({ data: { ...input, isMonitored: true } });
      // Try to set up monitoring via CourtDrive
      const monitor = await engine.getCourtDrive().monitorCase(input.courtName, input.caseNumber);
      if (monitor.success && monitor.data) {
        await ctx.db.courtCase.update({ where: { id: courtCase.id }, data: { courtDriveId: monitor.data.courtDriveId } });
      }
      return courtCase;
    }),

  getCourtFilings: publicProcedure
    .input(z.object({ courtCaseId: z.string(), onlyNew: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { courtCaseId: input.courtCaseId };
      if (input.onlyNew) where.isNew = true;
      return ctx.db.courtFiling.findMany({ where, orderBy: { filedDate: "desc" } });
    }),

  markFilingReviewed: publicProcedure
    .input(z.object({ filingId: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.courtFiling.update({ where: { id: input.filingId }, data: { isNew: false } })),

  checkForNewFilings: publicProcedure
    .input(z.object({ courtCaseId: z.string() }))
    .mutation(async ({ input }) => engine.checkForNewFilings(input.courtCaseId)),

  removeCourtCase: publicProcedure
    .input(z.object({ courtCaseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cc = await ctx.db.courtCase.findUniqueOrThrow({ where: { id: input.courtCaseId } });
      if (cc.courtDriveId) { await engine.getCourtDrive().unmonitorCase(cc.courtDriveId); }
      return ctx.db.courtCase.delete({ where: { id: input.courtCaseId } });
    }),

  // ─── Trademarks ────────────────────────────────────────────────

  getMonitoredTrademarks: publicProcedure
    .input(z.object({ matterId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      return ctx.db.trademarkDocket.findMany({ where, include: { matter: true }, orderBy: { nextDeadlineDate: "asc" } });
    }),

  checkTrademarkStatus: publicProcedure
    .input(z.object({ serialNumber: z.string() }))
    .mutation(async ({ input }) => engine.getUspto().getStatusBySerial(input.serialNumber)),

  addTrademarkToMonitor: publicProcedure
    .input(z.object({ matterId: z.string().optional(), serialNumber: z.string(), markName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tm = await ctx.db.trademarkDocket.create({
        data: { matterId: input.matterId, serialNumber: input.serialNumber.replace(/\D/g, ""), markName: input.markName, autoMonitor: true },
      });
      // Try to fetch initial status
      try {
        await engine.refreshTrademarkStatus(tm.id);
      } catch {}
      return ctx.db.trademarkDocket.findUniqueOrThrow({ where: { id: tm.id } });
    }),

  refreshTrademarkStatus: publicProcedure
    .input(z.object({ trademarkDocketId: z.string() }))
    .mutation(async ({ input }) => engine.refreshTrademarkStatus(input.trademarkDocketId)),

  refreshTrademarkFull: publicProcedure
    .input(z.object({ trademarkDocketId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const tm = await ctx.db.trademarkDocket.findUniqueOrThrow({ where: { id: input.trademarkDocketId } });
      const result = await engine.getUspto().getFullStatus(tm.serialNumber);
      if (!result.success || !result.data) return { error: result.error, newEvents: 0 };
      const data = result.data as any;
      const oldHistory = (tm.prosecutionHistory as any[] || []);
      const newHistory = data.prosecutionHistory || [];
      const oldKeys = new Set(oldHistory.map((e: any) => `${e.date}|${e.description || e.action}`));
      const newEvents = newHistory.filter((e: any) => !oldKeys.has(`${e.date}|${e.description || e.action}`));
      const maint = data.registrationDate ? engine.getUspto().calculateMaintenanceDeadlines(data.registrationDate, data.currentStatus) : [];
      const next = maint[0];
      await ctx.db.trademarkDocket.update({
        where: { id: input.trademarkDocketId },
        data: {
          currentStatus: data.currentStatus, statusDate: data.statusDate, ownerName: data.ownerName,
          ownerAddress: data.ownerAddress, attorneyOfRecord: data.attorneyOfRecord, internationalClasses: data.internationalClasses,
          filingDate: data.filingDate, publicationDate: data.publicationDate, registrationDate: data.registrationDate,
          registrationNumber: data.registrationNumber, nextDeadlineType: next?.type, nextDeadlineDate: next?.dueDate,
          lastChecked: new Date(), lastStatusChange: data.currentStatus !== tm.currentStatus ? new Date() : undefined,
          prosecutionHistory: newHistory as any, documentsList: data.documents as any, cachedResponse: data as any,
          newEventsSinceView: (tm.newEventsSinceView || 0) + newEvents.length,
        },
      });
      // Auto-create alerts
      if (tm.matterId) {
        for (const ev of newEvents) {
          const desc = (ev.description || ev.action || "").toUpperCase();
          if (desc.includes("OFFICE ACTION")) {
            const oa = engine.getUspto().calculateOfficeActionDeadline(new Date(ev.date));
            await ctx.db.task.create({ data: { title: `Office Action — ${tm.markName}`, description: `Response due ${oa.initialDeadline.toLocaleDateString()}`, matterId: tm.matterId, dueDate: oa.initialDeadline, priority: "HIGH", status: "NOT_STARTED" } });
          }
          if (desc.includes("PUBLISHED FOR OPPOSITION") || desc.includes("PUBLICATION")) {
            const d = new Date(ev.date); d.setDate(d.getDate() + 30);
            await ctx.db.task.create({ data: { title: `Opposition Window — ${tm.markName}`, description: `30-day window ends ${d.toLocaleDateString()}`, matterId: tm.matterId, dueDate: d, priority: "HIGH", status: "NOT_STARTED" } });
          }
          if (desc.includes("NOTICE OF ALLOWANCE")) {
            const sou = engine.getUspto().calculateSouDeadline(new Date(ev.date));
            await ctx.db.task.create({ data: { title: `Statement of Use — ${tm.markName}`, description: `SOU due ${sou.initialDeadline.toLocaleDateString()}`, matterId: tm.matterId, dueDate: sou.initialDeadline, priority: "HIGH", status: "NOT_STARTED" } });
          }
        }
      }
      return { data, newEvents: newEvents.length };
    }),

  markTrademarkViewed: publicProcedure
    .input(z.object({ trademarkDocketId: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.trademarkDocket.update({ where: { id: input.trademarkDocketId }, data: { lastViewedAt: new Date(), newEventsSinceView: 0 } })),

  getTrademarkForMatter: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.trademarkDocket.findFirst({ where: { matterId: input.matterId } })),

  removeTrademarkMonitor: publicProcedure
    .input(z.object({ trademarkDocketId: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.trademarkDocket.delete({ where: { id: input.trademarkDocketId } })),

  // ─── Dashboard Stats ───────────────────────────────────────────

  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const in14 = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const critical = await ctx.db.deadline.count({ where: { status: "ACTIVE", dueDate: { lte: in14 } } });
    const upcoming = await ctx.db.deadline.count({ where: { status: "ACTIVE", dueDate: { gt: in14, lte: in30 } } });
    const unreviewedFilings = await ctx.db.courtFiling.count({ where: { isNew: true } });
    const monitoredTrademarks = await ctx.db.trademarkDocket.count({ where: { autoMonitor: true } });

    return { critical, upcoming, unreviewedFilings, monitoredTrademarks };
  }),
});
