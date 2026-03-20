import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as paEngine from "@/lib/practice-area-engine";
import * as cpEngine from "@/lib/community-pipeline-engine";

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

  // ── Community Marketplace ─────────────────────────────────────────
  "community.search": publicProcedure
    .input(z.object({ query: z.string().optional(), practiceArea: z.string().optional(), jurisdiction: z.string().optional(), tags: z.array(z.string()).optional(), minRating: z.number().optional(), sortBy: z.string().optional(), page: z.number().optional(), mine: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      return cpEngine.searchTemplates(input ?? {});
    }),

  "community.browse": publicProcedure
    .input(z.object({ practiceArea: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return cpEngine.searchTemplates({ practiceArea: input?.practiceArea, sortBy: "downloads" });
    }),

  "community.getFeatured": publicProcedure.query(async () => {
    return db.communityPipelineTemplate.findMany({ where: { isFeatured: true, isPublished: true }, orderBy: { downloadCount: "desc" }, take: 10 });
  }),

  "community.getOfficial": publicProcedure
    .input(z.object({ practiceArea: z.string().optional() }).optional())
    .query(async ({ input }) => {
      return cpEngine.getOfficialTemplates(input?.practiceArea);
    }),

  "community.getPopular": publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), jurisdiction: z.string().optional(), limit: z.number().optional() }).optional())
    .query(async () => {
      return db.communityPipelineTemplate.findMany({ where: { isPublished: true }, orderBy: { downloadCount: "desc" }, take: 20 });
    }),

  "community.getTopRated": publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), limit: z.number().optional() }).optional())
    .query(async () => {
      return db.communityPipelineTemplate.findMany({ where: { isPublished: true, ratingCount: { gte: 1 } }, orderBy: { averageRating: "desc" }, take: 20 });
    }),

  "community.getRecommended": publicProcedure
    .input(z.object({ practiceArea: z.string(), jurisdiction: z.string().optional() }))
    .query(async ({ input }) => {
      return cpEngine.getRecommendations(input.practiceArea, input.jurisdiction);
    }),

  "community.getByJurisdiction": publicProcedure
    .input(z.object({ jurisdiction: z.string() }))
    .query(async ({ input }) => {
      return cpEngine.getPopularByJurisdiction(input.jurisdiction);
    }),

  "community.getCollections": publicProcedure
    .input(z.object({ practiceArea: z.string().optional() }).optional())
    .query(async () => {
      return db.communityPipelineCollection.findMany({ orderBy: { downloadCount: "desc" } });
    }),

  "community.getTemplate": publicProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ input }) => {
      return db.communityPipelineTemplate.findUniqueOrThrow({ where: { id: input.templateId }, include: { reviews: { orderBy: { createdAt: "desc" }, take: 20 }, _count: { select: { installs: true } } } });
    }),

  "community.preview": publicProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ input }) => {
      return cpEngine.previewPipeline(input.templateId);
    }),

  "community.diff": publicProcedure
    .input(z.object({ templateId1: z.string(), templateId2: z.string() }))
    .query(async ({ input }) => {
      return cpEngine.diffPipelines(input.templateId1, input.templateId2);
    }),

  "community.getVersionHistory": publicProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ input }) => {
      const template = await db.communityPipelineTemplate.findUniqueOrThrow({ where: { id: input.templateId } });
      return [{ version: template.version, changeLog: template.changeLog, createdAt: template.updatedAt }];
    }),

  "community.install": publicProcedure
    .input(z.object({ templateId: z.string(), targetPracticeArea: z.string(), mergeStrategy: z.enum(["replace", "merge", "append"]) }))
    .mutation(async ({ input }) => {
      return cpEngine.installPipeline(input.templateId, input.targetPracticeArea, input.mergeStrategy);
    }),

  "community.uninstall": publicProcedure
    .input(z.object({ installId: z.string() }))
    .mutation(async ({ input }) => {
      return cpEngine.uninstallPipeline(input.installId);
    }),

  "community.checkUpdates": publicProcedure.query(async () => {
    return cpEngine.checkForUpdates();
  }),

  "community.update": publicProcedure
    .input(z.object({ installId: z.string(), mergeStrategy: z.enum(["replace", "merge"]) }))
    .mutation(async ({ input }) => {
      return cpEngine.updateInstalledPipeline(input.installId, input.mergeStrategy);
    }),

  "community.getInstalled": publicProcedure
    .input(z.object({ practiceArea: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = { isActive: true };
      if (input?.practiceArea) {
        const config = await db.practiceAreaConfig.findFirst({ where: { practiceArea: input.practiceArea as any } });
        if (config) where.practiceAreaConfigId = config.id;
      }
      return db.communityPipelineInstall.findMany({ where, include: { template: true }, orderBy: { installedAt: "desc" } });
    }),

  "community.publish": publicProcedure
    .input(z.object({ practiceAreaConfigId: z.string(), title: z.string(), description: z.string(), jurisdiction: z.string().optional(), tags: z.array(z.string()).optional(), publisherName: z.string().optional() }))
    .mutation(async ({ input }) => {
      return cpEngine.publishPipeline(input);
    }),

  "community.unpublish": publicProcedure
    .input(z.object({ templateId: z.string() }))
    .mutation(async ({ input }) => {
      return db.communityPipelineTemplate.update({ where: { id: input.templateId }, data: { isPublished: false } });
    }),

  "community.updatePublished": publicProcedure
    .input(z.object({ templateId: z.string(), changes: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      const template = await db.communityPipelineTemplate.findUniqueOrThrow({ where: { id: input.templateId } });
      return db.communityPipelineTemplate.update({ where: { id: input.templateId }, data: { ...input.changes, version: template.version + 1, changeLog: input.changes.changeLog || `Updated to v${template.version + 1}` } as any });
    }),

  "community.fork": publicProcedure
    .input(z.object({ templateId: z.string(), newTitle: z.string() }))
    .mutation(async ({ input }) => {
      return cpEngine.forkPipeline(input.templateId, input.newTitle);
    }),

  "community.deprecate": publicProcedure
    .input(z.object({ templateId: z.string(), reason: z.string(), replacementId: z.string().optional() }))
    .mutation(async ({ input }) => {
      return cpEngine.deprecateTemplate(input.templateId, input.reason, input.replacementId);
    }),

  "community.getReviews": publicProcedure
    .input(z.object({ templateId: z.string(), sortBy: z.string().optional() }))
    .query(async ({ input }) => {
      return db.communityPipelineReview.findMany({ where: { templateId: input.templateId }, orderBy: input.sortBy === "helpful" ? { isHelpful: "desc" } : { createdAt: "desc" } });
    }),

  "community.submitReview": publicProcedure
    .input(z.object({ templateId: z.string(), rating: z.number().min(1).max(5), reviewText: z.string().optional(), reviewerName: z.string().optional(), reviewerFirm: z.string().optional(), jurisdiction: z.string().optional() }))
    .mutation(async ({ input }) => {
      return cpEngine.ratePipeline(input.templateId, input);
    }),

  "community.markHelpful": publicProcedure
    .input(z.object({ reviewId: z.string() }))
    .mutation(async ({ input }) => {
      return cpEngine.markReviewHelpful(input.reviewId);
    }),

  "community.export": publicProcedure
    .input(z.object({ practiceAreaConfigId: z.string(), format: z.enum(["json", "yaml"]).optional() }))
    .query(async ({ input }) => {
      return cpEngine.exportPipeline(input.practiceAreaConfigId, input.format ?? "json");
    }),

  "community.import": publicProcedure
    .input(z.object({ fileContent: z.string(), format: z.enum(["json", "yaml"]).optional(), targetPracticeArea: z.string() }))
    .mutation(async ({ input }) => {
      return cpEngine.importPipeline(input.fileContent, input.format ?? "json", input.targetPracticeArea);
    }),

  "community.getPublisherAnalytics": publicProcedure.query(async () => {
    const templates = await db.communityPipelineTemplate.findMany({ where: { isPublished: true } });
    return templates.map(t => ({ id: t.id, title: t.title, downloads: t.downloadCount, activeInstalls: t.activeInstallCount, averageRating: t.averageRating, reviewCount: t.ratingCount }));
  }),

  "community.getInstallAnalytics": publicProcedure
    .input(z.object({ templateId: z.string() }))
    .query(async ({ input }) => {
      return cpEngine.getInstallAnalytics(input.templateId);
    }),
});
