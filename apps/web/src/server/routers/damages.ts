import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  assessDamages,
  projectFutureDamages,
  generateDamagesSummaryReport,
  comparableVerdicts,
} from "@/lib/ai-damages";

const DAMAGE_TYPE_ENUM = [
  "MEDICAL_EXPENSES", "LOST_WAGES", "FUTURE_MEDICAL", "FUTURE_LOST_EARNINGS",
  "PROPERTY_DAMAGE", "OUT_OF_POCKET", "LOSS_OF_CONSORTIUM", "PAIN_AND_SUFFERING",
  "EMOTIONAL_DISTRESS", "LOSS_OF_ENJOYMENT", "DISFIGUREMENT", "DISABILITY",
  "WRONGFUL_DEATH", "PUNITIVE", "STATUTORY_PENALTY", "OTHER",
] as const;

const DAMAGE_CATEGORY_ENUM = ["ECONOMIC", "NON_ECONOMIC", "PUNITIVE", "STATUTORY"] as const;
const VERIFICATION_ENUM = ["UNVERIFIED", "DOCUMENTED", "EXPERT_VERIFIED", "DISPUTED"] as const;

async function recalculateSummary(db: any, matterId: string) {
  const items = await db.damageItem.findMany({ where: { matterId } });

  let totalEconomic = 0, totalNonEconomic = 0, totalPunitive = 0, totalStatutory = 0;
  let totalProjected = 0, totalDocumented = 0;

  for (const item of items) {
    const amt = Number(item.amount || 0);
    switch (item.category) {
      case "ECONOMIC": totalEconomic += amt; break;
      case "NON_ECONOMIC": totalNonEconomic += amt; break;
      case "PUNITIVE": totalPunitive += amt; break;
      case "STATUTORY": totalStatutory += amt; break;
    }
    if (item.isProjected) totalProjected += amt;
    else totalDocumented += amt;
  }

  const grandTotal = totalEconomic + totalNonEconomic + totalPunitive + totalStatutory;

  const existing = await db.damageSummary.findUnique({ where: { matterId } });
  const multiplier = existing?.multiplier ? Number(existing.multiplier) : null;
  const perDiem = existing?.perDiem ? Number(existing.perDiem) : null;
  const perDiemDays = existing?.perDiemDays ?? null;

  // Apply multiplier to non-economic if set
  let adjustedNonEconomic = totalNonEconomic;
  if (multiplier && totalEconomic > 0) {
    adjustedNonEconomic = Math.max(adjustedNonEconomic, totalEconomic * multiplier);
  }
  // Apply per diem if set
  if (perDiem && perDiemDays) {
    adjustedNonEconomic = Math.max(adjustedNonEconomic, perDiem * perDiemDays);
  }

  const adjustedGrand = totalEconomic + adjustedNonEconomic + totalPunitive + totalStatutory;

  return db.damageSummary.upsert({
    where: { matterId },
    create: {
      matterId,
      totalEconomic,
      totalNonEconomic: adjustedNonEconomic,
      totalPunitive,
      totalStatutory,
      grandTotal: adjustedGrand,
      totalProjected,
      totalDocumented,
      lastCalculatedAt: new Date(),
    },
    update: {
      totalEconomic,
      totalNonEconomic: adjustedNonEconomic,
      totalPunitive,
      totalStatutory,
      grandTotal: adjustedGrand,
      totalProjected,
      totalDocumented,
      lastCalculatedAt: new Date(),
    },
  });
}

export const damagesRouter = router({
  // ─── Items ─────────────────────────────────────────────────────

  listItems: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db.damageItem.findMany({
        where: { matterId: input.matterId },
        orderBy: [{ category: "asc" }, { createdAt: "asc" }],
      });

      const grouped: Record<string, { items: any[]; total: number }> = {
        ECONOMIC: { items: [], total: 0 },
        NON_ECONOMIC: { items: [], total: 0 },
        PUNITIVE: { items: [], total: 0 },
        STATUTORY: { items: [], total: 0 },
      };

      for (const item of items) {
        const cat = item.category;
        if (grouped[cat]) {
          grouped[cat].items.push(item);
          grouped[cat].total += Number(item.amount || 0);
        }
      }

      return { items, grouped };
    }),

  getItem: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.damageItem.findUniqueOrThrow({ where: { id: input.id } });
    }),

  createItem: publicProcedure
    .input(z.object({
      matterId: z.string(),
      category: z.enum(DAMAGE_CATEGORY_ENUM),
      type: z.enum(DAMAGE_TYPE_ENUM),
      description: z.string().min(1),
      amount: z.number(),
      isProjected: z.boolean().optional(),
      startDate: z.string().or(z.date()).optional(),
      endDate: z.string().or(z.date()).optional(),
      isOngoing: z.boolean().optional(),
      frequency: z.string().optional(),
      recurringAmount: z.number().optional(),
      duration: z.number().optional(),
      supportingEvidence: z.string().optional(),
      verificationStatus: z.enum(VERIFICATION_ENUM).optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { startDate, endDate, ...rest } = input;
      const item = await ctx.db.damageItem.create({
        data: {
          ...rest,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
        },
      });
      await recalculateSummary(ctx.db, input.matterId);
      return item;
    }),

  updateItem: publicProcedure
    .input(z.object({
      id: z.string(),
      category: z.enum(DAMAGE_CATEGORY_ENUM).optional(),
      type: z.enum(DAMAGE_TYPE_ENUM).optional(),
      description: z.string().optional(),
      amount: z.number().optional(),
      isProjected: z.boolean().optional(),
      startDate: z.string().or(z.date()).optional().nullable(),
      endDate: z.string().or(z.date()).optional().nullable(),
      isOngoing: z.boolean().optional(),
      frequency: z.string().optional().nullable(),
      recurringAmount: z.number().optional().nullable(),
      duration: z.number().optional().nullable(),
      supportingEvidence: z.string().optional().nullable(),
      verificationStatus: z.enum(VERIFICATION_ENUM).optional(),
      notes: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, startDate, endDate, ...rest } = input;
      const data: any = { ...rest };
      if (startDate !== undefined) data.startDate = startDate ? new Date(startDate) : null;
      if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
      const item = await ctx.db.damageItem.update({ where: { id }, data });
      await recalculateSummary(ctx.db, item.matterId);
      return item;
    }),

  deleteItem: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.damageItem.delete({ where: { id: input.id } });
      await recalculateSummary(ctx.db, item.matterId);
      return item;
    }),

  bulkCreate: publicProcedure
    .input(z.object({
      matterId: z.string(),
      items: z.array(z.object({
        category: z.enum(DAMAGE_CATEGORY_ENUM),
        type: z.enum(DAMAGE_TYPE_ENUM),
        description: z.string().min(1),
        amount: z.number(),
        isProjected: z.boolean().optional(),
        startDate: z.string().or(z.date()).optional(),
        endDate: z.string().or(z.date()).optional(),
        isOngoing: z.boolean().optional(),
        verificationStatus: z.enum(VERIFICATION_ENUM).optional(),
        notes: z.string().optional(),
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      const data = input.items.map((i) => ({
        ...i,
        matterId: input.matterId,
        startDate: i.startDate ? new Date(i.startDate) : undefined,
        endDate: i.endDate ? new Date(i.endDate) : undefined,
      }));
      await ctx.db.damageItem.createMany({ data });
      await recalculateSummary(ctx.db, input.matterId);
      return { count: data.length };
    }),

  // ─── Summary ───────────────────────────────────────────────────

  getSummary: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      let summary = await ctx.db.damageSummary.findUnique({ where: { matterId: input.matterId } });
      if (!summary) {
        summary = await ctx.db.damageSummary.create({ data: { matterId: input.matterId } });
      }
      return summary;
    }),

  recalculate: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return recalculateSummary(ctx.db, input.matterId);
    }),

  setMultiplier: publicProcedure
    .input(z.object({ matterId: z.string(), multiplier: z.number().min(0).max(10) }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.damageSummary.upsert({
        where: { matterId: input.matterId },
        create: { matterId: input.matterId, multiplier: input.multiplier },
        update: { multiplier: input.multiplier },
      });
      return recalculateSummary(ctx.db, input.matterId);
    }),

  setPerDiem: publicProcedure
    .input(z.object({ matterId: z.string(), dailyRate: z.number(), days: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.damageSummary.upsert({
        where: { matterId: input.matterId },
        create: { matterId: input.matterId, perDiem: input.dailyRate, perDiemDays: input.days },
        update: { perDiem: input.dailyRate, perDiemDays: input.days },
      });
      return recalculateSummary(ctx.db, input.matterId);
    }),

  aiAssess: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const items = await ctx.db.damageItem.findMany({ where: { matterId: input.matterId } });
      const caseDetails = await ctx.db.injuryCaseDetails.findUnique({ where: { matterId: input.matterId } });
      const medicalRecords = await ctx.db.medicalRecord.findMany({ where: { matterId: input.matterId } });

      const assessment = await assessDamages({
        incidentType: caseDetails?.incidentType,
        injuryDescription: caseDetails?.injuryDescription || undefined,
        medicalRecords: medicalRecords.map((r) => ({
          type: r.recordType,
          charges: Number(r.totalCharges || 0),
          description: r.description || undefined,
        })),
        otherLosses: items.length > 0
          ? items.map((i) => `${i.type}: $${Number(i.amount)}`).join(", ")
          : undefined,
      });

      // Create damage items from AI suggestions
      for (const econ of assessment.economicDamages) {
        await ctx.db.damageItem.create({
          data: {
            matterId: input.matterId,
            category: "ECONOMIC",
            type: mapDamageType(econ.type),
            description: econ.description,
            amount: econ.amount,
            isProjected: false,
            verificationStatus: "UNVERIFIED",
            notes: `AI Assessment: ${econ.reasoning}`,
          },
        });
      }
      for (const ne of assessment.nonEconomicDamages) {
        await ctx.db.damageItem.create({
          data: {
            matterId: input.matterId,
            category: "NON_ECONOMIC",
            type: mapDamageType(ne.type),
            description: ne.description,
            amount: ne.estimatedRange.mid,
            isProjected: false,
            verificationStatus: "UNVERIFIED",
            notes: `AI Assessment: ${ne.reasoning}\nRange: $${ne.estimatedRange.low} - $${ne.estimatedRange.high}`,
          },
        });
      }

      // Update summary with AI analysis
      await ctx.db.damageSummary.upsert({
        where: { matterId: input.matterId },
        create: {
          matterId: input.matterId,
          aiValuation: assessment.totalEstimate.mid,
          aiAnalysis: assessment.analysis,
          multiplier: assessment.suggestedMultiplier,
        },
        update: {
          aiValuation: assessment.totalEstimate.mid,
          aiAnalysis: assessment.analysis,
          multiplier: assessment.suggestedMultiplier,
        },
      });

      await recalculateSummary(ctx.db, input.matterId);
      return assessment;
    }),

  aiProjectFuture: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const items = await ctx.db.damageItem.findMany({ where: { matterId: input.matterId } });
      const caseDetails = await ctx.db.injuryCaseDetails.findUnique({ where: { matterId: input.matterId } });

      const projections = await projectFutureDamages(
        items.map((i) => ({ type: i.type, amount: Number(i.amount), description: i.description })),
        caseDetails?.injuryDescription || "Not provided"
      );

      for (const proj of projections) {
        await ctx.db.damageItem.create({
          data: {
            matterId: input.matterId,
            category: "ECONOMIC",
            type: mapDamageType(proj.type),
            description: proj.description,
            amount: proj.projectedAmount,
            isProjected: true,
            verificationStatus: "UNVERIFIED",
            notes: `Projected: ${proj.duration}\nMethodology: ${proj.methodology}`,
          },
        });
      }

      await recalculateSummary(ctx.db, input.matterId);
      return projections;
    }),

  generateReport: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const items = await ctx.db.damageItem.findMany({ where: { matterId: input.matterId } });
      const caseDetails = await ctx.db.injuryCaseDetails.findUnique({
        where: { matterId: input.matterId },
        include: { matter: { include: { client: true } } },
      });

      return generateDamagesSummaryReport(
        items.map((i) => ({
          category: i.category,
          type: i.type,
          description: i.description,
          amount: Number(i.amount),
          isProjected: i.isProjected,
          verificationStatus: i.verificationStatus,
        })),
        {
          incidentType: caseDetails?.incidentType,
          injuryDescription: caseDetails?.injuryDescription,
          clientName: caseDetails?.matter?.client?.name,
          dateOfIncident: caseDetails?.dateOfIncident,
        }
      );
    }),

  getComparables: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const caseDetails = await ctx.db.injuryCaseDetails.findUnique({ where: { matterId: input.matterId } });
      return comparableVerdicts(
        caseDetails?.incidentType || "personal injury",
        "general jurisdiction",
        caseDetails?.injuryDescription ? "moderate to severe" : "moderate"
      );
    }),

  // ─── Timeline ──────────────────────────────────────────────────

  listTimeline: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.damageTimeline.findMany({
        where: { matterId: input.matterId },
        orderBy: { date: "asc" },
      });
    }),

  addTimelineEntry: publicProcedure
    .input(z.object({
      matterId: z.string(),
      date: z.string().or(z.date()),
      event: z.string().min(1),
      damageImpact: z.string().optional(),
      damageItemId: z.string().optional(),
      category: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.damageTimeline.create({
        data: { ...input, date: new Date(input.date) },
      });
    }),

  updateTimelineEntry: publicProcedure
    .input(z.object({
      id: z.string(),
      date: z.string().or(z.date()).optional(),
      event: z.string().optional(),
      damageImpact: z.string().optional().nullable(),
      damageItemId: z.string().optional().nullable(),
      category: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, date, ...rest } = input;
      const data: any = { ...rest };
      if (date) data.date = new Date(date);
      return ctx.db.damageTimeline.update({ where: { id }, data });
    }),

  deleteTimelineEntry: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.damageTimeline.delete({ where: { id: input.id } });
    }),

  autoGenerateTimeline: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const medicalRecords = await ctx.db.medicalRecord.findMany({
        where: { matterId: input.matterId },
        orderBy: { dateOfService: "asc" },
      });
      const damageItems = await ctx.db.damageItem.findMany({
        where: { matterId: input.matterId, startDate: { not: null } },
        orderBy: { startDate: "asc" },
      });
      const caseDetails = await ctx.db.injuryCaseDetails.findUnique({ where: { matterId: input.matterId } });

      const entries: any[] = [];

      // Incident date
      if (caseDetails?.dateOfIncident) {
        entries.push({
          matterId: input.matterId,
          date: caseDetails.dateOfIncident,
          event: `Incident: ${caseDetails.incidentType?.replace(/_/g, " ")}`,
          damageImpact: caseDetails.injuryDescription || null,
          category: "legal",
        });
      }

      // Medical records
      for (const r of medicalRecords) {
        entries.push({
          matterId: input.matterId,
          date: r.dateOfService,
          event: `${r.recordType.replace(/_/g, " ")}: ${r.providerName}`,
          damageImpact: r.totalCharges ? `Charges: $${Number(r.totalCharges).toFixed(2)}` : null,
          category: "medical",
        });
      }

      // Damage items with dates
      for (const d of damageItems) {
        if (d.startDate) {
          entries.push({
            matterId: input.matterId,
            date: d.startDate,
            event: `${d.type.replace(/_/g, " ")}: ${d.description.slice(0, 100)}`,
            damageImpact: `Amount: $${Number(d.amount).toFixed(2)}`,
            damageItemId: d.id,
            category: d.category === "ECONOMIC" ? "employment" : "personal",
          });
        }
      }

      if (entries.length > 0) {
        await ctx.db.damageTimeline.createMany({ data: entries });
      }

      return { count: entries.length };
    }),
});

function mapDamageType(aiType: string): any {
  const mapping: Record<string, string> = {
    medical_expenses: "MEDICAL_EXPENSES",
    lost_wages: "LOST_WAGES",
    future_medical: "FUTURE_MEDICAL",
    future_lost_earnings: "FUTURE_LOST_EARNINGS",
    property_damage: "PROPERTY_DAMAGE",
    out_of_pocket: "OUT_OF_POCKET",
    loss_of_consortium: "LOSS_OF_CONSORTIUM",
    pain_and_suffering: "PAIN_AND_SUFFERING",
    emotional_distress: "EMOTIONAL_DISTRESS",
    loss_of_enjoyment: "LOSS_OF_ENJOYMENT",
    disfigurement: "DISFIGUREMENT",
    disability: "DISABILITY",
    wrongful_death: "WRONGFUL_DEATH",
    punitive: "PUNITIVE",
    statutory_penalty: "STATUTORY_PENALTY",
  };
  const normalized = aiType.toLowerCase().replace(/\s+/g, "_");
  return mapping[normalized] || "OTHER";
}
