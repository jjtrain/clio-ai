import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as paEngine from "@/lib/practice-area-engine";

export const practiceAreaRouter = router({
  // ── Configuration (1-10) ──────────────────────────────────────────

  "config.list": publicProcedure.query(async () => {
    return db.practiceAreaConfig.findMany({ orderBy: { displayName: "asc" } });
  }),

  "config.get": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .query(async ({ input }) => {
      return db.practiceAreaConfig.findFirst({ where: { practiceArea: input.practiceArea as any } });
    }),

  "config.update": publicProcedure
    .input(z.object({ practiceArea: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.practiceAreaConfig.update({
        where: { practiceArea: input.practiceArea as any },
        data: input.data,
      });
    }),

  "config.enable": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .mutation(async ({ input }) => {
      return db.practiceAreaConfig.update({
        where: { practiceArea: input.practiceArea as any },
        data: { isEnabled: true },
      });
    }),

  "config.disable": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .mutation(async ({ input }) => {
      return db.practiceAreaConfig.update({
        where: { practiceArea: input.practiceArea as any },
        data: { isEnabled: false },
      });
    }),

  "config.setPrimary": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .mutation(async ({ input }) => {
      await db.practiceAreaConfig.updateMany({ data: { isPrimary: false } });
      return db.practiceAreaConfig.update({
        where: { practiceArea: input.practiceArea as any },
        data: { isPrimary: true },
      });
    }),

  "config.createCustom": publicProcedure
    .input(z.object({ name: z.string(), config: z.record(z.any()).optional() }))
    .mutation(async ({ input }) => {
      return paEngine.createCustomPracticeArea({ name: input.name, terminology: {}, matterStages: [], ...input.config });
    }),

  "config.clone": publicProcedure
    .input(z.object({ fromPracticeArea: z.string(), newName: z.string() }))
    .mutation(async ({ input }) => {
      return paEngine.clonePracticeAreaConfig(input.fromPracticeArea, input.newName);
    }),

  "config.delete": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .mutation(async ({ input }) => {
      return db.practiceAreaConfig.delete({
        where: { practiceArea: input.practiceArea as any, isCustom: true } as any,
      });
    }),

  "config.getEnabledList": publicProcedure.query(async () => {
    return db.practiceAreaConfig.findMany({
      where: { isEnabled: true },
      select: { practiceArea: true, displayName: true, icon: true, color: true },
    });
  }),

  // ── Terminology (11-16) ───────────────────────────────────────────

  "terminology.get": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .query(async ({ input }) => {
      return paEngine.getTerminology(input.practiceArea);
    }),

  "terminology.getForMatter": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const matter = await db.matter.findUniqueOrThrow({ where: { id: input.matterId } });
      return paEngine.getTerminology(matter.practiceArea as any);
    }),

  "terminology.update": publicProcedure
    .input(z.object({ practiceArea: z.string(), terminology: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.practiceAreaConfig.update({
        where: { practiceArea: input.practiceArea as any },
        data: { terminology: JSON.stringify(input.terminology) },
      });
    }),

  "terminology.getUserOverrides": publicProcedure
    .input(z.object({ userId: z.string().optional() }))
    .query(async ({ input }) => {
      if (!input.userId) return null;
      return db.userPracticeAreaPreference.findFirst({
        where: { userId: input.userId },
        select: { customTerminology: true },
      });
    }),

  "terminology.setUserOverrides": publicProcedure
    .input(z.object({ userId: z.string(), overrides: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.userPracticeAreaPreference.upsert({
        where: { userId: input.userId } as any,
        create: { userId: input.userId, customTerminology: JSON.stringify(input.overrides) } as any,
        update: { customTerminology: JSON.stringify(input.overrides) },
      });
    }),

  "terminology.resolve": publicProcedure
    .input(z.object({ genericTerm: z.string(), practiceArea: z.string().optional() }))
    .query(async ({ input }) => {
      const terminology = await paEngine.getTerminology(input.practiceArea ?? "general");
      return (terminology as any)[input.genericTerm] ?? input.genericTerm;
    }),

  // ── Stages (17-23) ────────────────────────────────────────────────

  "stages.get": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .query(async ({ input }) => {
      return paEngine.getMatterStages(input.practiceArea);
    }),

  "stages.update": publicProcedure
    .input(z.object({ practiceArea: z.string(), stages: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      return db.practiceAreaConfig.update({
        where: { practiceArea: input.practiceArea as any },
        data: { matterStages: JSON.stringify(input.stages) },
      });
    }),

  "stages.getForMatter": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const matter = await db.matter.findUniqueOrThrow({ where: { id: input.matterId } });
      const config = await db.practiceAreaConfig.findFirst({ where: { practiceArea: matter.practiceArea as any } });
      return {
        currentStage: (matter as any).currentStage,
        stageEnteredAt: (matter as any).stageEnteredAt,
        stages: config?.matterStages ? JSON.parse(config.matterStages as string) : [],
      };
    }),

  "stages.advance": publicProcedure
    .input(z.object({ matterId: z.string(), newStage: z.string(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      return paEngine.advanceMatterStage(input.matterId, input.newStage, input.notes);
    }),

  "stages.revert": publicProcedure
    .input(z.object({ matterId: z.string(), newStage: z.string(), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      return paEngine.advanceMatterStage(input.matterId, input.newStage, input.reason);
    }),

  "stages.getHistory": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      return db.matterStageHistory.findMany({
        where: { matterId: input.matterId },
        orderBy: { changedAt: "desc" },
      });
    }),

  "stages.getAnalytics": publicProcedure
    .input(z.object({ practiceArea: z.string(), dateRange: z.object({ from: z.string(), to: z.string() }) }))
    .query(async ({ input }) => {
      return paEngine.getStageAnalytics(input.practiceArea, { from: new Date(input.dateRange.from), to: new Date(input.dateRange.to) });
    }),

  // ── Fields (24-27) ────────────────────────────────────────────────

  "fields.get": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .query(async ({ input }) => {
      return paEngine.getMatterFields(input.practiceArea);
    }),

  "fields.update": publicProcedure
    .input(z.object({ practiceArea: z.string(), fields: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      return db.practiceAreaConfig.update({
        where: { practiceArea: input.practiceArea as any },
        data: { matterFields: JSON.stringify(input.fields) },
      });
    }),

  "fields.getForMatter": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      return db.customField.findMany({ where: { matterId: input.matterId } });
    }),

  "fields.setForMatter": publicProcedure
    .input(z.object({ matterId: z.string(), fieldValues: z.array(z.object({ fieldName: z.string(), fieldValue: z.string() })) }))
    .mutation(async ({ input }) => {
      for (const fv of input.fieldValues) {
        await db.customField.upsert({
          where: { matterId_fieldName: { matterId: input.matterId, fieldName: fv.fieldName } } as any,
          create: { matterId: input.matterId, fieldName: fv.fieldName, fieldValue: fv.fieldValue } as any,
          update: { fieldValue: fv.fieldValue },
        });
      }
      return { updated: input.fieldValues.length };
    }),

  // ── Intake (28-30) ────────────────────────────────────────────────

  "intake.getFields": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .query(async ({ input }) => {
      return paEngine.getIntakeFields(input.practiceArea);
    }),

  "intake.updateFields": publicProcedure
    .input(z.object({ practiceArea: z.string(), intakeFields: z.array(z.any()) }))
    .mutation(async ({ input }) => {
      return db.practiceAreaConfig.update({
        where: { practiceArea: input.practiceArea as any },
        data: { intakeFields: JSON.stringify(input.intakeFields) },
      });
    }),

  "intake.generateForm": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .query(async ({ input }) => {
      const fields = await paEngine.getIntakeFields(input.practiceArea);
      return { practiceArea: input.practiceArea, fields };
    }),

  // ── Billing (31-33) ───────────────────────────────────────────────

  "billing.getDefaults": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .query(async ({ input }) => {
      return paEngine.getBillingDefaults(input.practiceArea);
    }),

  "billing.updateDefaults": publicProcedure
    .input(z.object({ practiceArea: z.string(), billingDefaults: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.practiceAreaConfig.update({
        where: { practiceArea: input.practiceArea as any },
        data: { billingDefaults: JSON.stringify(input.billingDefaults) },
      });
    }),

  "billing.applyToMatter": publicProcedure
    .input(z.object({ matterId: z.string(), practiceArea: z.string() }))
    .mutation(async ({ input }) => {
      return { applied: true, matterId: input.matterId, practiceArea: input.practiceArea };
    }),

  // ── UI (34-40) ────────────────────────────────────────────────────

  "ui.getDashboard": publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), userId: z.string().optional() }))
    .query(async ({ input }) => {
      return paEngine.getDashboardWidgets(input.practiceArea ?? "GENERAL_PRACTICE", input.userId ?? "");
    }),

  "ui.updateDashboard": publicProcedure
    .input(z.object({ userId: z.string(), widgetConfig: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.userPracticeAreaPreference.upsert({
        where: { userId: input.userId } as any,
        create: { userId: input.userId, customDashboardLayout: JSON.stringify(input.widgetConfig) } as any,
        update: { customDashboardLayout: JSON.stringify(input.widgetConfig) },
      });
    }),

  "ui.getSidebar": publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), userId: z.string().optional() }))
    .query(async ({ input }) => {
      return paEngine.getSidebarConfig(input.practiceArea ?? "GENERAL_PRACTICE", input.userId ?? "");
    }),

  "ui.updateSidebar": publicProcedure
    .input(z.object({ userId: z.string(), sidebarConfig: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.userPracticeAreaPreference.upsert({
        where: { userId: input.userId } as any,
        create: { userId: input.userId, customSidebarOrder: JSON.stringify(input.sidebarConfig) } as any,
        update: { customSidebarOrder: JSON.stringify(input.sidebarConfig) },
      });
    }),

  "ui.getDocumentTemplates": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .query(async ({ input }) => {
      return paEngine.getDocumentTemplates(input.practiceArea);
    }),

  "ui.getDeadlineRules": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .query(async ({ input }) => {
      return paEngine.getDeadlineRules(input.practiceArea);
    }),

  "ui.getChecklists": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .query(async ({ input }) => {
      return paEngine.getChecklistTemplates(input.practiceArea);
    }),

  // ── Preferences (41-44) ───────────────────────────────────────────

  "preferences.get": publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      return db.userPracticeAreaPreference.findFirst({ where: { userId: input.userId } });
    }),

  "preferences.setActive": publicProcedure
    .input(z.object({ userId: z.string(), practiceArea: z.string() }))
    .mutation(async ({ input }) => {
      return paEngine.switchPracticeArea(input.userId, input.practiceArea);
    }),

  "preferences.setEnabled": publicProcedure
    .input(z.object({ userId: z.string(), practiceAreas: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      return db.userPracticeAreaPreference.upsert({
        where: { userId: input.userId } as any,
        create: { userId: input.userId, enabledPracticeAreas: JSON.stringify(input.practiceAreas) } as any,
        update: { enabledPracticeAreas: JSON.stringify(input.practiceAreas) },
      });
    }),

  "preferences.switch": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .mutation(async ({ input }) => {
      return paEngine.switchPracticeArea("current-user", input.practiceArea);
    }),

  // ── Matter (45-46) ────────────────────────────────────────────────

  "matter.applyConfig": publicProcedure
    .input(z.object({ matterId: z.string(), practiceArea: z.string() }))
    .mutation(async ({ input }) => {
      return paEngine.applyConfigToMatter(input.matterId, input.practiceArea);
    }),

  "matter.getConfig": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      const matter = await db.matter.findUniqueOrThrow({ where: { id: input.matterId } });
      const config = await db.practiceAreaConfig.findFirst({ where: { practiceArea: matter.practiceArea as any } });
      return config;
    }),

  // ── Reports (47-50) ───────────────────────────────────────────────

  "reports.byPracticeArea": publicProcedure.query(async () => {
    return db.matter.groupBy({ by: ["practiceArea"], _count: { id: true } });
  }),

  "reports.stageAnalytics": publicProcedure
    .input(z.object({ practiceArea: z.string(), dateRange: z.object({ from: z.string(), to: z.string() }) }))
    .query(async ({ input }) => {
      return paEngine.getStageAnalytics(input.practiceArea, { from: new Date(input.dateRange.from), to: new Date(input.dateRange.to) });
    }),

  "reports.practiceAreaComparison": publicProcedure.query(async () => {
    const configs = await db.practiceAreaConfig.findMany();
    const counts = await db.matter.groupBy({ by: ["practiceArea"], _count: { id: true } });
    return { configs, matterCounts: counts };
  }),

  "reports.export": publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), format: z.string().optional() }))
    .query(async ({ input }) => {
      return { status: "pending", practiceArea: input.practiceArea, format: input.format ?? "csv" };
    }),
});
