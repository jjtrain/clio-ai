import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { runFullAudit, type AuditableEntry } from "@/lib/billing-audit-engine";

const DEFAULT_USER_ID = "demo-user";
const DEFAULT_FIRM_ID = "demo-firm";

export const billingAuditRouter = router({
  // ==========================================
  // AUDIT EXECUTION
  // ==========================================

  runAudit: publicProcedure
    .input(
      z.object({
        matterId: z.string().optional(),
        invoiceId: z.string().optional(),
        auditType: z.enum(["pre_invoice", "periodic", "matter_close", "manual", "bulk"]).default("manual"),
        periodStart: z.date().optional(),
        periodEnd: z.date().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const startTime = Date.now();

      // Fetch time entries to audit
      const where: any = {};
      if (input.matterId) where.matterId = input.matterId;
      if (input.periodStart || input.periodEnd) {
        where.date = {};
        if (input.periodStart) where.date.gte = input.periodStart;
        if (input.periodEnd) where.date.lte = input.periodEnd;
      }

      const rawEntries = await ctx.db.timeEntry.findMany({
        where,
        include: {
          matter: { select: { name: true, practiceArea: true } },
          user: { select: { name: true } },
        },
        orderBy: { date: "desc" },
        take: 200,
      });

      // Convert to AuditableEntry format
      const entries: AuditableEntry[] = rawEntries.map((e) => ({
        id: e.id,
        matterId: e.matterId,
        matterName: e.matter.name,
        userId: e.userId,
        attorney: e.user?.name || undefined,
        description: e.description,
        duration: e.duration,
        hours: e.hours || e.duration / 60,
        date: e.date,
        rate: e.rate ? Number(e.rate) : undefined,
        amount: e.amount ? Number(e.amount) : (e.rate ? (e.hours || e.duration / 60) * Number(e.rate) : undefined),
        billable: e.billable,
        taskCategory: e.taskCategory || undefined,
        activityCode: e.activityCode || undefined,
        status: e.status || undefined,
      }));

      // Fetch guidelines and benchmarks
      const guidelines = await ctx.db.billingGuideline.findMany({
        where: { firmId: DEFAULT_FIRM_ID, isActive: true },
      });

      const benchmarks = await ctx.db.billingBenchmark.findMany({
        where: { OR: [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }] },
      });

      // Run the audit
      const result = await runFullAudit({
        entries,
        matterId: input.matterId,
        invoiceId: input.invoiceId,
        auditType: input.auditType,
        guidelines: guidelines.map((g) => ({
          id: g.id,
          name: g.name,
          guidelineType: g.guidelineType,
          rule: g.rule,
          description: g.description,
          practiceArea: g.practiceArea,
          clientId: g.clientId,
        })),
        benchmarks: benchmarks.map((b) => ({
          taskCategory: b.taskCategory,
          practiceArea: b.practiceArea,
          experienceLevel: b.experienceLevel,
          minHours: b.minHours,
          maxHours: b.maxHours,
          avgHours: b.avgHours,
        })),
      });

      // Save audit to database
      const audit = await ctx.db.billingAudit.create({
        data: {
          invoiceId: input.invoiceId,
          matterId: input.matterId,
          auditType: input.auditType,
          auditScope: input.matterId ? "matter_all_time" : input.invoiceId ? "single_invoice" : "date_range",
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          totalEntriesReviewed: result.totalEntriesReviewed,
          totalHoursReviewed: result.totalHoursReviewed,
          totalAmountReviewed: result.totalAmountReviewed,
          totalFlags: result.flags.length,
          criticalFlags: result.flags.filter((f) => f.severity === "critical").length,
          highFlags: result.flags.filter((f) => f.severity === "high").length,
          mediumFlags: result.flags.filter((f) => f.severity === "medium").length,
          lowFlags: result.flags.filter((f) => f.severity === "low").length,
          resolvedFlags: 0,
          estimatedSavings: result.estimatedSavings,
          estimatedRisk: result.estimatedRisk,
          overallGrade: result.grade,
          summaryText: result.summary,
          recommendations: result.recommendations as any,
          aiModelUsed: "claude-sonnet-4-20250514",
          processingTime: Math.round((Date.now() - startTime) / 1000),
          status: "completed",
          userId: DEFAULT_USER_ID,
          firmId: DEFAULT_FIRM_ID,
          flags: {
            create: result.flags.map((f) => ({
              timeEntryId: f.timeEntryId || null,
              invoiceId: f.invoiceId || input.invoiceId || null,
              flagType: f.flagType,
              severity: f.severity,
              category: f.category,
              title: f.title,
              description: f.description,
              recommendation: f.recommendation || null,
              suggestedDescription: f.suggestedDescription || null,
              suggestedHours: f.suggestedHours || null,
              currentValue: f.currentValue || null,
              expectedValue: f.expectedValue || null,
              ruleReference: f.ruleReference || null,
              financialImpact: f.financialImpact || null,
              sortOrder: f.sortOrder || 0,
              userId: DEFAULT_USER_ID,
              firmId: DEFAULT_FIRM_ID,
            })),
          },
        },
        include: {
          flags: { orderBy: { sortOrder: "asc" } },
        },
      });

      // Update invoice audit status if applicable
      if (input.invoiceId) {
        await ctx.db.invoice.update({
          where: { id: input.invoiceId },
          data: { auditId: audit.id, auditStatus: "audit_complete" },
        }).catch(() => {}); // non-critical
      }

      return audit;
    }),

  // ==========================================
  // AUDIT QUERIES
  // ==========================================

  getAudit: publicProcedure
    .input(z.object({ auditId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.billingAudit.findUnique({
        where: { id: input.auditId },
        include: {
          flags: { orderBy: { sortOrder: "asc" } },
        },
      });
    }),

  listAudits: publicProcedure
    .input(
      z.object({
        matterId: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().min(1).max(50).optional().default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.matterId) where.matterId = input.matterId;
      if (input.status) where.status = input.status;

      return ctx.db.billingAudit.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: {
          _count: { select: { flags: true } },
        },
      });
    }),

  getAuditStats: publicProcedure.query(async ({ ctx }) => {
    const audits = await ctx.db.billingAudit.findMany({
      where: { firmId: DEFAULT_FIRM_ID },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    const total = audits.length;
    const gradeDistribution: Record<string, number> = {};
    let totalFlags = 0;
    let totalResolved = 0;
    let totalSavings = 0;
    let totalRisk = 0;

    for (const a of audits) {
      gradeDistribution[a.overallGrade || "?"] = (gradeDistribution[a.overallGrade || "?"] || 0) + 1;
      totalFlags += a.totalFlags;
      totalResolved += a.resolvedFlags;
      totalSavings += a.estimatedSavings || 0;
      totalRisk += a.estimatedRisk || 0;
    }

    const commonFlagTypes = await ctx.db.billingFlag.groupBy({
      by: ["flagType"],
      _count: { flagType: true },
      where: { firmId: DEFAULT_FIRM_ID },
      orderBy: { _count: { flagType: "desc" } },
      take: 10,
    });

    return {
      totalAudits: total,
      gradeDistribution,
      totalFlags,
      totalResolved,
      resolutionRate: totalFlags > 0 ? Math.round((totalResolved / totalFlags) * 100) : 100,
      totalEstimatedSavings: totalSavings,
      totalEstimatedRisk: totalRisk,
      commonFlagTypes: commonFlagTypes.map((f) => ({
        type: f.flagType,
        count: f._count.flagType,
      })),
    };
  }),

  // ==========================================
  // FLAG MANAGEMENT
  // ==========================================

  resolveFlag: publicProcedure
    .input(
      z.object({
        flagId: z.string(),
        action: z.enum(["accepted", "rejected", "auto_fixed", "manually_fixed", "deferred"]),
        resolution: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const flag = await ctx.db.billingFlag.update({
        where: { id: input.flagId },
        data: {
          status: input.action,
          resolution: input.resolution,
          resolvedAt: new Date(),
        },
      });

      // If flag was accepted and has suggested changes, apply them
      if (input.action === "accepted" && flag.timeEntryId) {
        const updates: any = {};
        if (flag.suggestedDescription) {
          // Preserve original before rewriting
          const entry = await ctx.db.timeEntry.findUnique({ where: { id: flag.timeEntryId } });
          if (entry && !entry.originalDescription) {
            updates.originalDescription = entry.description;
          }
          updates.description = flag.suggestedDescription;
        }
        if (flag.suggestedHours) {
          updates.hours = flag.suggestedHours;
          updates.duration = Math.round(flag.suggestedHours * 60);
        }
        if (Object.keys(updates).length > 0) {
          updates.status = "revised";
          await ctx.db.timeEntry.update({
            where: { id: flag.timeEntryId },
            data: updates,
          });
        }
      }

      // Update audit resolved count
      await ctx.db.billingAudit.update({
        where: { id: flag.auditId },
        data: { resolvedFlags: { increment: 1 } },
      });

      return flag;
    }),

  acceptSuggestedFix: publicProcedure
    .input(z.object({ flagId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const flag = await ctx.db.billingFlag.findUnique({ where: { id: input.flagId } });
      if (!flag) throw new Error("Flag not found");
      if (!flag.timeEntryId) throw new Error("No time entry linked to this flag");

      const entry = await ctx.db.timeEntry.findUnique({ where: { id: flag.timeEntryId } });
      if (!entry) throw new Error("Time entry not found");

      const updates: any = { status: "revised" };
      if (flag.suggestedDescription) {
        if (!entry.originalDescription) updates.originalDescription = entry.description;
        updates.description = flag.suggestedDescription;
      }
      if (flag.suggestedHours) {
        updates.hours = flag.suggestedHours;
        updates.duration = Math.round(flag.suggestedHours * 60);
        if (entry.rate) {
          updates.amount = flag.suggestedHours * Number(entry.rate);
        }
      }

      await ctx.db.timeEntry.update({ where: { id: flag.timeEntryId }, data: updates });
      await ctx.db.billingFlag.update({
        where: { id: input.flagId },
        data: { status: "auto_fixed", resolvedAt: new Date(), resolution: "Applied AI suggestion" },
      });
      await ctx.db.billingAudit.update({
        where: { id: flag.auditId },
        data: { resolvedFlags: { increment: 1 } },
      });

      return { success: true };
    }),

  bulkResolveFlags: publicProcedure
    .input(
      z.object({
        flagIds: z.array(z.string()),
        action: z.enum(["accepted", "rejected", "deferred"]),
        resolution: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db.billingFlag.updateMany({
        where: { id: { in: input.flagIds } },
        data: {
          status: input.action,
          resolution: input.resolution,
          resolvedAt: new Date(),
        },
      });

      return { updated: result.count };
    }),

  // ==========================================
  // GUIDELINES
  // ==========================================

  listGuidelines: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.billingGuideline.findMany({
      where: { firmId: DEFAULT_FIRM_ID },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  }),

  createGuideline: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        guidelineType: z.string(),
        rule: z.any(),
        description: z.string(),
        practiceArea: z.string().optional(),
        clientId: z.string().optional(),
        clientName: z.string().optional(),
        isDefault: z.boolean().optional(),
        source: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.billingGuideline.create({
        data: {
          ...input,
          isActive: true,
          firmId: DEFAULT_FIRM_ID,
        },
      });
    }),

  updateGuideline: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        rule: z.any().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.billingGuideline.update({ where: { id }, data });
    }),

  deleteGuideline: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.billingGuideline.delete({ where: { id: input.id } });
    }),

  // ==========================================
  // BENCHMARKS
  // ==========================================

  listBenchmarks: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.billingBenchmark.findMany({
      where: { OR: [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }] },
      orderBy: { taskCategory: "asc" },
    });
  }),

  createBenchmark: publicProcedure
    .input(
      z.object({
        taskCategory: z.string(),
        taskDescription: z.string().optional(),
        practiceArea: z.string().optional(),
        experienceLevel: z.string().optional(),
        minHours: z.number(),
        maxHours: z.number(),
        avgHours: z.number(),
        medianHours: z.number().optional(),
        sampleSize: z.number().default(100),
        source: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.billingBenchmark.create({
        data: { ...input, firmId: DEFAULT_FIRM_ID },
      });
    }),
});
