import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { analyzeAnomalies, assessMatterRisk, detectBillingAnomalies } from "@/lib/ai-risk";

function toNum(v: any): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : parseFloat(v.toString()) || 0;
}

async function ensureSettings(db: any) {
  let s = await db.riskSettings.findUnique({ where: { id: "default" } });
  if (!s) s = await db.riskSettings.create({ data: { id: "default" } });
  return s;
}

async function alertExists(db: any, title: string, entityId?: string): Promise<boolean> {
  const where: any = { title, status: { in: ["NEW", "ACKNOWLEDGED", "INVESTIGATING"] } };
  if (entityId) where.entityId = entityId;
  return (await db.riskAlert.count({ where })) > 0;
}

export const riskAlertsRouter = router({
  // ── Alerts ─────────────────────────────────────────────────────────────
  list: publicProcedure
    .input(z.object({
      category: z.string().optional(),
      severity: z.string().optional(),
      status: z.string().optional(),
      matterId: z.string().optional(),
      clientId: z.string().optional(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.category) where.category = input.category;
      if (input?.severity) where.severity = input.severity;
      if (input?.status) where.status = input.status;
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.clientId) where.clientId = input.clientId;
      const [alerts, total] = await Promise.all([
        ctx.db.riskAlert.findMany({
          where, orderBy: [{ severity: "asc" }, { createdAt: "desc" }],
          include: { matter: { select: { name: true } }, client: { select: { name: true } } },
          take: input?.limit || 50, skip: input?.offset || 0,
        }),
        ctx.db.riskAlert.count({ where }),
      ]);
      return { alerts, total };
    }),

  getById: publicProcedure.input(z.object({ id: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.riskAlert.findUniqueOrThrow({
      where: { id: input.id },
      include: { matter: { select: { name: true, matterNumber: true } }, client: { select: { name: true } } },
    });
  }),

  acknowledge: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.riskAlert.update({ where: { id: input.id }, data: { status: "ACKNOWLEDGED" } });
  }),

  investigate: publicProcedure.input(z.object({ id: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.riskAlert.update({ where: { id: input.id }, data: { status: "INVESTIGATING" } });
  }),

  resolve: publicProcedure.input(z.object({ id: z.string(), resolution: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.riskAlert.update({
      where: { id: input.id },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolution: input.resolution },
    });
  }),

  dismiss: publicProcedure.input(z.object({ id: z.string(), reason: z.string().optional() })).mutation(async ({ ctx, input }) => {
    return ctx.db.riskAlert.update({
      where: { id: input.id },
      data: { status: "DISMISSED", resolution: input.reason || "Dismissed" },
    });
  }),

  bulkResolve: publicProcedure.input(z.object({ ids: z.array(z.string()), resolution: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.riskAlert.updateMany({
      where: { id: { in: input.ids } },
      data: { status: "RESOLVED", resolvedAt: new Date(), resolution: input.resolution },
    });
  }),

  bulkDismiss: publicProcedure.input(z.object({ ids: z.array(z.string()) })).mutation(async ({ ctx, input }) => {
    return ctx.db.riskAlert.updateMany({ where: { id: { in: input.ids } }, data: { status: "DISMISSED" } });
  }),

  getStats: publicProcedure.query(async ({ ctx }) => {
    const byCategory = await ctx.db.riskAlert.groupBy({ by: ["category"], _count: true, where: { status: { in: ["NEW", "ACKNOWLEDGED", "INVESTIGATING"] } } });
    const bySeverity = await ctx.db.riskAlert.groupBy({ by: ["severity"], _count: true, where: { status: { in: ["NEW", "ACKNOWLEDGED", "INVESTIGATING"] } } });
    const byStatus = await ctx.db.riskAlert.groupBy({ by: ["status"], _count: true });

    // Weekly trend (last 8 weeks)
    const eightWeeksAgo = new Date(Date.now() - 56 * 86400000);
    const recentAlerts = await ctx.db.riskAlert.findMany({
      where: { createdAt: { gte: eightWeeksAgo } },
      select: { createdAt: true, severity: true },
    });
    const weekMap: Record<string, { total: number; critical: number; high: number }> = {};
    for (let i = 7; i >= 0; i--) {
      const d = new Date(Date.now() - i * 7 * 86400000);
      const wk = `W${Math.ceil((d.getDate()) / 7)}-${d.getMonth() + 1}`;
      weekMap[wk] = { total: 0, critical: 0, high: 0 };
    }
    const weekKeys = Object.keys(weekMap);
    for (const a of recentAlerts) {
      const weeksAgo = Math.floor((Date.now() - new Date(a.createdAt).getTime()) / (7 * 86400000));
      const idx = Math.max(0, weekKeys.length - 1 - weeksAgo);
      if (weekKeys[idx] && weekMap[weekKeys[idx]]) {
        weekMap[weekKeys[idx]].total++;
        if (a.severity === "CRITICAL") weekMap[weekKeys[idx]].critical++;
        if (a.severity === "HIGH") weekMap[weekKeys[idx]].high++;
      }
    }
    const weeklyTrend = Object.entries(weekMap).map(([week, d]) => ({ week, ...d }));

    const totalOpen = await ctx.db.riskAlert.count({ where: { status: { in: ["NEW", "ACKNOWLEDGED", "INVESTIGATING"] } } });
    const thisWeek = await ctx.db.riskAlert.count({ where: { createdAt: { gte: new Date(Date.now() - 7 * 86400000) } } });
    const thisMonth = await ctx.db.riskAlert.count({ where: { createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } });
    const resolvedThisMonth = await ctx.db.riskAlert.count({ where: { status: "RESOLVED", resolvedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } });

    const lastScan = await ctx.db.riskScanLog.findFirst({ orderBy: { createdAt: "desc" } });

    return {
      byCategory: byCategory.map((c) => ({ category: c.category, count: c._count })),
      bySeverity: bySeverity.map((s) => ({ severity: s.severity, count: s._count })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
      weeklyTrend,
      totalOpen,
      thisWeek,
      resolutionRate: thisMonth > 0 ? Math.round((resolvedThisMonth / thisMonth) * 1000) / 10 : 0,
      lastScan: lastScan?.createdAt || null,
    };
  }),

  // ── Scanning ───────────────────────────────────────────────────────────
  runFullScan: publicProcedure.mutation(async ({ ctx }) => {
    const startTime = Date.now();
    const settings = await ensureSettings(ctx.db);
    if (!settings.isEnabled) return { message: "Risk detection is disabled", alertsGenerated: 0 };

    const alerts: Array<{ category: string; severity: string; title: string; description: string; source: string; entityType?: string; entityId?: string; matterId?: string; clientId?: string; aiAnalysis?: string; aiRecommendation?: string; data?: string }> = [];

    // ── a) BILLING ANOMALIES ──
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const timeEntries = await ctx.db.timeEntry.findMany({
      where: { date: { gte: thirtyDaysAgo } },
      include: { matter: true, user: true },
    });

    // Excessive hours
    const maxHours = toNum(settings.unusualTimeEntryHours);
    for (const te of timeEntries) {
      if (te.duration / 60 > maxHours) {
        const title = `Excessive time entry: ${(te.duration / 60).toFixed(1)}h`;
        if (!(await alertExists(ctx.db, title, te.id))) {
          alerts.push({ category: "BILLING", severity: "MEDIUM", title, description: `Time entry "${te.description}" on ${te.matter?.name || "unknown matter"} by ${te.user?.name || "unknown"} is ${(te.duration / 60).toFixed(1)} hours, exceeding the ${maxHours}h threshold.`, source: "anomaly_scan", entityType: "TimeEntry", entityId: te.id, matterId: te.matterId });
        }
      }
    }

    // Duplicates
    if (settings.duplicateEntryDetection) {
      const seen = new Map<string, any>();
      for (const te of timeEntries) {
        const key = `${te.matterId}-${new Date(te.date).toISOString().split("T")[0]}-${te.duration}-${te.description?.slice(0, 50)}`;
        if (seen.has(key)) {
          const title = `Potential duplicate time entry`;
          if (!(await alertExists(ctx.db, title, te.id))) {
            alerts.push({ category: "BILLING", severity: "MEDIUM", title, description: `Entry "${te.description}" (${(te.duration / 60).toFixed(1)}h) appears to be a duplicate on ${te.matter?.name || "unknown"}.`, source: "anomaly_scan", entityType: "TimeEntry", entityId: te.id, matterId: te.matterId });
          }
        } else {
          seen.set(key, te);
        }
      }
    }

    // Vague descriptions
    for (const te of timeEntries) {
      if (te.description && te.description.split(/\s+/).length < 3 && te.duration > 60) {
        const title = `Vague time entry description`;
        if (!(await alertExists(ctx.db, title, te.id))) {
          alerts.push({ category: "BILLING", severity: "LOW", title, description: `Entry "${te.description}" on ${te.matter?.name || "unknown"} (${(te.duration / 60).toFixed(1)}h) has a very brief description.`, source: "anomaly_scan", entityType: "TimeEntry", entityId: te.id, matterId: te.matterId });
        }
      }
    }

    // ── b) TRUST ACCOUNT CHECKS ──
    if (settings.trustOverdraftAlert) {
      const ledgers = await ctx.db.trustLedger.findMany({ where: { balance: { lt: 0 } }, include: { client: true, trustAccount: true } });
      for (const l of ledgers) {
        const title = `Trust account overdraft: ${l.client?.name || "Unknown"}`;
        if (!(await alertExists(ctx.db, title, l.id))) {
          alerts.push({ category: "TRUST", severity: "CRITICAL", title, description: `Trust ledger for ${l.client?.name || "unknown client"} in account ${l.trustAccount?.name || "unknown"} has a negative balance of $${toNum(l.balance).toFixed(2)}.`, source: "trust_audit", entityType: "TrustLedger", entityId: l.id, clientId: l.clientId });
        }
      }

      const staleAccounts = await ctx.db.trustAccount.findMany({
        where: { isActive: true, OR: [{ lastReconciledAt: null }, { lastReconciledAt: { lt: new Date(Date.now() - 30 * 86400000) } }] },
      });
      for (const a of staleAccounts) {
        const title = `Trust account not reconciled: ${a.name}`;
        if (!(await alertExists(ctx.db, title, a.id))) {
          alerts.push({ category: "TRUST", severity: "HIGH", title, description: `Trust account "${a.name}" has not been reconciled in over 30 days.`, source: "trust_audit", entityType: "TrustAccount", entityId: a.id });
        }
      }
    }

    // ── c) DEADLINE RISKS ──
    const days = settings.deadlineAlertDays;
    const upcoming = new Date(Date.now() + days * 86400000);
    const overdueTasks = await ctx.db.task.findMany({
      where: { dueDate: { lt: new Date() }, isComplete: false },
      include: { matter: true },
    });
    for (const t of overdueTasks) {
      const title = `Overdue task: ${t.title}`;
      if (!(await alertExists(ctx.db, title, t.id))) {
        alerts.push({ category: "DEADLINE", severity: "HIGH", title, description: `Task "${t.title}" on ${t.matter?.name || "unknown matter"} was due ${new Date(t.dueDate!).toLocaleDateString()} and is still incomplete.`, source: "deadline_check", entityType: "Task", entityId: t.id, matterId: t.matterId || undefined });
      }
    }

    // ── d) MATTER INACTIVITY ──
    const inactDays = settings.inactivityAlertDays;
    const inactCutoff = new Date(Date.now() - inactDays * 86400000);
    const openMatters = await ctx.db.matter.findMany({
      where: { status: { not: "CLOSED" } },
      include: { timeEntries: { orderBy: { date: "desc" }, take: 1 }, activities: { orderBy: { createdAt: "desc" }, take: 1 }, client: true },
    });
    for (const m of openMatters) {
      const lastTE = m.timeEntries[0]?.date;
      const lastAct = m.activities[0]?.createdAt;
      const lastActivity = lastTE && lastAct ? new Date(Math.max(new Date(lastTE).getTime(), new Date(lastAct).getTime())) : lastTE ? new Date(lastTE) : lastAct ? new Date(lastAct) : new Date(m.openDate);
      if (lastActivity < inactCutoff) {
        const daysSince = Math.floor((Date.now() - lastActivity.getTime()) / 86400000);
        const title = `Inactive matter: ${m.name}`;
        if (!(await alertExists(ctx.db, title, m.id))) {
          alerts.push({
            category: "PRODUCTIVITY", severity: m.pipelineStage === "NEW" && daysSince > 14 ? "HIGH" : "MEDIUM",
            title, description: `Matter "${m.name}" (${m.client?.name || "unknown client"}) has had no activity for ${daysSince} days.`,
            source: "anomaly_scan", entityType: "Matter", entityId: m.id, matterId: m.id, clientId: m.clientId,
          });
        }
      }
    }

    // ── e) CLIENT RISKS ──
    const overdueInvoices = await ctx.db.invoice.findMany({
      where: { status: "OVERDUE", dueDate: { lt: new Date(Date.now() - 60 * 86400000) } },
      include: { matter: { include: { client: true } } },
    });
    const clientOverdue = new Map<string, { name: string; total: number; count: number }>();
    for (const inv of overdueInvoices) {
      const cid = inv.matter?.clientId;
      const cname = inv.matter?.client?.name || "Unknown";
      if (cid) {
        const existing = clientOverdue.get(cid) || { name: cname, total: 0, count: 0 };
        existing.total += toNum(inv.total) - toNum(inv.amountPaid);
        existing.count++;
        clientOverdue.set(cid, existing);
      }
    }
    for (const [cid, data] of clientOverdue) {
      const title = `Client with overdue invoices: ${data.name}`;
      if (!(await alertExists(ctx.db, title, cid))) {
        alerts.push({ category: "CLIENT", severity: data.total > 10000 ? "HIGH" : "MEDIUM", title, description: `${data.name} has ${data.count} invoices overdue >60 days, totaling $${data.total.toFixed(2)} outstanding.`, source: "billing_review", entityType: "Client", entityId: cid, clientId: cid });
      }
    }

    // ── f) COMPLIANCE ──
    if (settings.conflictAutoCheck) {
      const clientNames = await ctx.db.client.findMany({ select: { name: true }, where: { status: "ACTIVE" } });
      const clientNameSet = new Set(clientNames.map((c: any) => c.name.toLowerCase()));
      const opposingParties = await ctx.db.relatedParty.findMany({
        where: { role: "OPPOSING_PARTY" },
        include: { matter: { include: { client: true } } },
      });
      for (const rp of opposingParties) {
        if (clientNameSet.has(rp.name.toLowerCase())) {
          const title = `Potential conflict: ${rp.name} is both a client and opposing party`;
          if (!(await alertExists(ctx.db, title, rp.id))) {
            alerts.push({ category: "CONFLICT", severity: "CRITICAL", title, description: `"${rp.name}" appears as an opposing party in matter "${rp.matter?.name}" but also matches an active client name. Immediate conflict review required.`, source: "compliance_check", entityType: "RelatedParty", entityId: rp.id, matterId: rp.matterId || undefined });
          }
        }
      }
    }

    // ── g) FINANCIAL ──
    const now = new Date();
    const months: number[] = [];
    for (let i = 2; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const invs = await ctx.db.invoice.findMany({ where: { status: { in: ["SENT", "PAID", "OVERDUE"] }, issueDate: { gte: mStart, lte: mEnd } } });
      months.push(invs.reduce((s: number, inv: any) => s + toNum(inv.total), 0));
    }
    if (months[0] > months[1] && months[1] > months[2] && months[2] > 0) {
      const title = "Revenue declining 3 consecutive months";
      if (!(await alertExists(ctx.db, title))) {
        alerts.push({ category: "FINANCIAL", severity: "HIGH", title, description: `Monthly revenue has declined for 3 consecutive months: $${months[0].toFixed(0)} → $${months[1].toFixed(0)} → $${months[2].toFixed(0)}.`, source: "anomaly_scan" });
      }
    }

    // ── Save all alerts ──
    let created = 0;
    for (const a of alerts) {
      await ctx.db.riskAlert.create({ data: { ...a, category: a.category as any, severity: a.severity as any } });
      created++;
    }

    const duration = Date.now() - startTime;
    await ctx.db.riskScanLog.create({ data: { scanType: "full", alertsGenerated: created, duration, summary: `Found ${created} new alerts across all categories.` } });

    return { alertsGenerated: created, duration, categories: alerts.reduce((acc, a) => { acc[a.category] = (acc[a.category] || 0) + 1; return acc; }, {} as Record<string, number>) };
  }),

  runBillingScan: publicProcedure.mutation(async ({ ctx }) => {
    // Simplified billing-only scan
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const entries = await ctx.db.timeEntry.findMany({ where: { date: { gte: thirtyDaysAgo } }, include: { matter: true, user: true } });
    const settings = await ensureSettings(ctx.db);
    let count = 0;
    for (const te of entries) {
      if (te.duration / 60 > toNum(settings.unusualTimeEntryHours)) {
        const title = `Excessive time entry: ${(te.duration / 60).toFixed(1)}h`;
        if (!(await alertExists(ctx.db, title, te.id))) {
          await ctx.db.riskAlert.create({ data: { category: "BILLING", severity: "MEDIUM", title, description: `${te.description} on ${te.matter?.name}`, source: "billing_review", entityType: "TimeEntry", entityId: te.id, matterId: te.matterId } });
          count++;
        }
      }
    }
    return { alertsGenerated: count };
  }),

  assessMatter: publicProcedure.input(z.object({ matterId: z.string() })).mutation(async ({ ctx, input }) => {
    const matter = await ctx.db.matter.findUniqueOrThrow({
      where: { id: input.matterId },
      include: { client: true, valuation: true, timeEntries: true, invoices: true, tasks: true, relatedParties: true, activities: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    const billed = matter.invoices.reduce((s: number, i: any) => s + toNum(i.total), 0);
    const daysOpen = Math.floor((Date.now() - new Date(matter.openDate).getTime()) / 86400000);
    const lastAct = matter.activities[0]?.createdAt || matter.openDate;

    const result = await assessMatterRisk({
      name: matter.name, practiceArea: matter.practiceArea || undefined,
      daysOpen, lastActivity: new Date(lastAct).toISOString(),
      billing: billed, valuation: matter.valuation ? toNum(matter.valuation.estimatedValue) : 0,
      deadlines: matter.tasks.filter((t: any) => !t.isComplete && t.dueDate).length,
      parties: matter.relatedParties.length,
    });

    if (result.riskLevel === "HIGH" || result.riskLevel === "CRITICAL") {
      await ctx.db.riskAlert.create({
        data: {
          category: "COMPLIANCE", severity: result.riskLevel as any, title: `${result.riskLevel} risk: ${matter.name}`,
          description: result.factors.join("; "), source: "anomaly_scan",
          entityType: "Matter", entityId: matter.id, matterId: matter.id, clientId: matter.clientId,
          aiAnalysis: result.factors.join("\n"), aiRecommendation: result.recommendations.join("\n"),
        },
      });
    }

    return result;
  }),

  // ── Settings ───────────────────────────────────────────────────────────
  getSettings: publicProcedure.query(async ({ ctx }) => ensureSettings(ctx.db)),

  updateSettings: publicProcedure
    .input(z.object({
      isEnabled: z.boolean().optional(),
      autoScanEnabled: z.boolean().optional(),
      scanFrequency: z.string().optional(),
      billingAnomalyThreshold: z.number().optional(),
      trustOverdraftAlert: z.boolean().optional(),
      deadlineAlertDays: z.number().optional(),
      inactivityAlertDays: z.number().optional(),
      unusualTimeEntryHours: z.number().optional(),
      duplicateEntryDetection: z.boolean().optional(),
      conflictAutoCheck: z.boolean().optional(),
      notifyOnCritical: z.boolean().optional(),
      notifyEmail: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ensureSettings(ctx.db);
      return ctx.db.riskSettings.update({ where: { id: "default" }, data: input });
    }),

  getScanHistory: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.riskScanLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  }),
});
