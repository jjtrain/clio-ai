import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

export async function publishPipeline(params: {
  practiceAreaConfigId: string; title: string; description: string;
  jurisdiction?: string; tags?: string[]; publisherName?: string; publisherEmail?: string;
}) {
  const config = await db.practiceAreaConfig.findUniqueOrThrow({ where: { id: params.practiceAreaConfigId } });
  const stages = safeParseJson(config.matterStages as any, []);
  return db.communityPipelineTemplate.create({
    data: {
      title: params.title, description: params.description,
      practiceArea: config.practiceArea, jurisdiction: params.jurisdiction,
      tags: JSON.stringify(params.tags ?? []),
      publishedBy: params.publisherName, publishedByEmail: params.publisherEmail,
      stages: config.matterStages, customFields: config.matterFields,
      deadlineRules: (config as any).deadlineRules ?? "[]",
      checklistTemplates: (config as any).checklistTemplates ?? "[]",
      billingDefaults: (config as any).billingDefaults ?? "{}",
      terminology: (config as any).terminology ?? "{}",
      stageCount: stages.length, isPublished: true, version: 1,
    },
  });
}

export async function installPipeline(
  templateId: string, targetPracticeArea: string, mergeStrategy: "replace" | "merge" | "append"
) {
  const template = await db.communityPipelineTemplate.findUniqueOrThrow({ where: { id: templateId } });
  const config = await db.practiceAreaConfig.findFirst({ where: { practiceArea: targetPracticeArea as any } });
  if (!config) throw new Error("Practice area config not found");

  const tplStages = safeParseJson(template.stages as any, []);
  const tplFields = safeParseJson(template.customFields as any, []);
  const tplDeadlines = safeParseJson(template.deadlineRules as any, []);
  const tplChecklists = safeParseJson(template.checklistTemplates as any, []);
  const tplBilling = safeParseJson(template.billingDefaults as any, {});

  let added = 0, skipped = 0;
  let finalStages: any[], finalFields: any[], finalDeadlines: any[], finalChecklists: any[], finalBilling: any;

  if (mergeStrategy === "replace") {
    finalStages = tplStages; finalFields = tplFields; finalDeadlines = tplDeadlines;
    finalChecklists = tplChecklists; finalBilling = tplBilling;
    added = tplStages.length;
  } else if (mergeStrategy === "merge") {
    const existStages = safeParseJson(config.matterStages as any, []);
    const existIds = new Set(existStages.map((s: any) => s.id ?? s.name));
    finalStages = [...existStages];
    for (const s of tplStages) {
      if (existIds.has(s.id ?? s.name)) { skipped++; } else { finalStages.push(s); added++; }
    }
    const existFields = safeParseJson(config.matterFields as any, []);
    const existFieldNames = new Set(existFields.map((f: any) => f.name));
    finalFields = [...existFields, ...tplFields.filter((f: any) => !existFieldNames.has(f.name))];
    finalDeadlines = mergeDedupe(safeParseJson((config as any).deadlineRules, []), tplDeadlines);
    finalChecklists = mergeDedupe(safeParseJson((config as any).checklistTemplates, []), tplChecklists);
    finalBilling = { ...safeParseJson((config as any).billingDefaults, {}), ...tplBilling };
  } else {
    finalStages = [...safeParseJson(config.matterStages as any, []), ...tplStages];
    finalFields = [...safeParseJson(config.matterFields as any, []), ...tplFields];
    finalDeadlines = [...safeParseJson((config as any).deadlineRules, []), ...tplDeadlines];
    finalChecklists = [...safeParseJson((config as any).checklistTemplates, []), ...tplChecklists];
    finalBilling = { ...safeParseJson((config as any).billingDefaults, {}), ...tplBilling };
    added = tplStages.length;
  }

  const updated = await db.practiceAreaConfig.update({
    where: { id: config.id },
    data: {
      matterStages: JSON.stringify(finalStages) as any,
      matterFields: JSON.stringify(finalFields) as any,
    },
  });

  const install = await db.communityPipelineInstall.create({
    data: {
      templateId, practiceAreaConfigId: config.id, installedAt: new Date(),
      templateVersion: template.version ?? 1, isActive: true,
    },
  });

  await db.communityPipelineTemplate.update({
    where: { id: templateId },
    data: { downloadCount: { increment: 1 }, activeInstallCount: { increment: 1 } },
  });

  return { config: updated, install, mergeReport: { added, skipped } };
}

export async function previewPipeline(templateId: string) {
  const template = await db.communityPipelineTemplate.findUniqueOrThrow({ where: { id: templateId } });
  return {
    stages: safeParseJson(template.stages as any, []),
    customFields: safeParseJson(template.customFields as any, []),
    deadlineRules: safeParseJson(template.deadlineRules as any, []),
    checklists: safeParseJson(template.checklistTemplates as any, []),
    billingDefaults: safeParseJson(template.billingDefaults as any, {}),
    terminology: safeParseJson(template.terminology as any, {}),
    stageCount: template.stageCount,
  };
}

export async function checkForUpdates() {
  const installs = await db.communityPipelineInstall.findMany({
    where: { isActive: true },
    include: { template: true },
  });
  const results = [];
  for (const install of installs) {
    if ((install.template.version ?? 1) > (install.templateVersion ?? 0)) {
      results.push({
        ...install,
        updateAvailable: true,
        latestAvailableVersion: install.template.version,
      });
    }
  }
  return results;
}

export async function updateInstalledPipeline(installId: string, mergeStrategy: "replace" | "merge") {
  const install = await db.communityPipelineInstall.findUniqueOrThrow({
    where: { id: installId }, include: { template: true },
  });
  const config = await db.practiceAreaConfig.findUniqueOrThrow({ where: { id: install.practiceAreaConfigId } });
  const result = await installPipeline(
    install.templateId, config.practiceArea as any, mergeStrategy
  );
  await db.communityPipelineInstall.update({
    where: { id: installId },
    data: { templateVersion: install.template.version ?? 1 },
  });
  return result;
}

export async function uninstallPipeline(installId: string) {
  const install = await db.communityPipelineInstall.update({
    where: { id: installId },
    data: { isActive: false, uninstalledAt: new Date() },
  });
  await db.communityPipelineTemplate.update({
    where: { id: install.templateId },
    data: { activeInstallCount: { decrement: 1 } },
  });
  return { uninstalled: true };
}

export async function searchTemplates(params: {
  query?: string; practiceArea?: string; jurisdiction?: string;
  tags?: string[]; minRating?: number; sortBy?: string; page?: number;
}) {
  const where: any = { isPublished: true };
  if (params.query) where.title = { contains: params.query, mode: "insensitive" as any };
  if (params.practiceArea) where.practiceArea = params.practiceArea;
  if (params.jurisdiction) where.jurisdiction = params.jurisdiction;
  if (params.tags?.length) where.tags = { hasSome: params.tags };
  if (params.minRating) where.averageRating = { gte: params.minRating };

  const page = params.page ?? 1;
  const orderBy: any = params.sortBy === "rating" ? { averageRating: "desc" as any }
    : params.sortBy === "newest" ? { createdAt: "desc" as any }
    : { downloadCount: "desc" as any };

  const [templates, total] = await Promise.all([
    db.communityPipelineTemplate.findMany({
      where, orderBy, skip: (page - 1) * 20, take: 20,
      include: { _count: { select: { reviews: true } } },
    }),
    db.communityPipelineTemplate.count({ where }),
  ]);
  return { templates, total, page };
}

export async function getRecommendations(practiceArea: string, jurisdiction?: string) {
  const where: any = { isPublished: true, practiceArea, averageRating: { gte: 3 } };
  if (jurisdiction) where.jurisdiction = jurisdiction;

  const templates = await db.communityPipelineTemplate.findMany({
    where, orderBy: { averageRating: "desc" as any }, take: 10,
  });

  const response = await aiRouter.complete({
    feature: "pipeline_recommendations",
    systemPrompt: "Rank these pipeline templates and explain why each is recommended for a law firm. Return a brief explanation for each.",
    userPrompt: `Practice area: ${practiceArea}. Jurisdiction: ${jurisdiction || "any"}. Templates: ${JSON.stringify(templates.map(t => ({ id: t.id, title: t.title, description: t.description, rating: Number(t.averageRating) })))}`,
  });

  const ranked = templates.map(t => ({ id: t.id, explanation: "Top rated template" }));
  return ranked.slice(0, 5).map((r: any) => ({
    template: templates.find(t => t.id === r.id),
    explanation: r.explanation,
  }));
}

export async function ratePipeline(templateId: string, params: {
  rating: number; reviewText?: string; reviewerName?: string; reviewerFirm?: string; jurisdiction?: string;
}) {
  const review = await db.communityPipelineReview.create({
    data: {
      templateId, rating: params.rating, reviewText: params.reviewText,
      reviewerName: params.reviewerName, reviewerFirm: params.reviewerFirm,
      jurisdiction: params.jurisdiction,
    },
  });
  await db.communityPipelineTemplate.update({
    where: { id: templateId },
    data: {
      ratingSum: { increment: params.rating },
      ratingCount: { increment: 1 },
      averageRating: await computeAvgRating(templateId, params.rating),
    },
  });
  return review;
}

export async function markReviewHelpful(reviewId: string) {
  return db.communityPipelineReview.update({
    where: { id: reviewId },
    data: { isHelpful: { increment: 1 } },
  });
}

export async function forkPipeline(templateId: string, newTitle: string) {
  const template = await db.communityPipelineTemplate.findUniqueOrThrow({ where: { id: templateId } });
  const { id, createdAt, updatedAt, ...data } = template as any;
  return db.communityPipelineTemplate.create({
    data: {
      ...data, title: newTitle, isPublished: false,
      downloadCount: 0, ratingSum: 0, ratingCount: 0, averageRating: 0,
      activeInstallCount: 0, forkedFromId: templateId,
    },
  });
}

export async function diffPipelines(templateId1: string, templateId2: string) {
  const [t1, t2] = await Promise.all([
    db.communityPipelineTemplate.findUniqueOrThrow({ where: { id: templateId1 } }),
    db.communityPipelineTemplate.findUniqueOrThrow({ where: { id: templateId2 } }),
  ]);
  const stages1 = safeParseJson(t1.stages as any, []);
  const stages2 = safeParseJson(t2.stages as any, []);
  const names1 = new Set(stages1.map((s: any) => s.name));
  const names2 = new Set(stages2.map((s: any) => s.name));

  const fields1 = safeParseJson(t1.customFields as any, []);
  const fields2 = safeParseJson(t2.customFields as any, []);
  const fieldNames1 = new Set(fields1.map((f: any) => f.name));
  const fieldNames2 = new Set(fields2.map((f: any) => f.name));

  return {
    stagesOnlyIn1: stages1.filter((s: any) => !names2.has(s.name)),
    stagesOnlyIn2: stages2.filter((s: any) => !names1.has(s.name)),
    stagesInBoth: stages1.filter((s: any) => names2.has(s.name)),
    fieldsAdded: fields2.filter((f: any) => !fieldNames1.has(f.name)),
    fieldsRemoved: fields1.filter((f: any) => !fieldNames2.has(f.name)),
  };
}

export async function getPopularByJurisdiction(jurisdiction: string) {
  return db.communityPipelineTemplate.findMany({
    where: { jurisdiction, isPublished: true },
    orderBy: { downloadCount: "desc" as any },
    take: 20,
  });
}

export async function getOfficialTemplates(practiceArea?: string) {
  const where: any = { isOfficial: true, isPublished: true };
  if (practiceArea) where.practiceArea = practiceArea;
  return db.communityPipelineTemplate.findMany({ where });
}

export async function deprecateTemplate(templateId: string, reason: string, replacementId?: string) {
  return db.communityPipelineTemplate.update({
    where: { id: templateId },
    data: {
      isDeprecated: true, deprecatedReason: reason,
      ...(replacementId ? { replacedByTemplateId: replacementId } : {}),
    },
  });
}

export async function getInstallAnalytics(templateId: string) {
  const template = await db.communityPipelineTemplate.findUniqueOrThrow({ where: { id: templateId } });
  return {
    totalInstalls: template.downloadCount,
    activeInstalls: template.activeInstallCount,
    averageRating: template.averageRating,
    reviewCount: template.ratingCount,
  };
}

export async function exportPipeline(practiceAreaConfigId: string, format: "json" | "yaml") {
  const config = await db.practiceAreaConfig.findUniqueOrThrow({ where: { id: practiceAreaConfigId } });
  const content = JSON.stringify(config, null, 2);
  return { content, format: "json" as const };
}

export async function importPipeline(fileContent: string, format: "json" | "yaml", targetPracticeArea: string) {
  const parsed = safeParseJson(fileContent, null);
  if (!parsed) throw new Error("Invalid file content");
  const config = await db.practiceAreaConfig.findFirst({ where: { practiceArea: targetPracticeArea as any } });
  if (!config) throw new Error("Practice area config not found");
  return db.practiceAreaConfig.update({
    where: { id: config.id },
    data: {
      matterStages: (parsed.matterStages ?? config.matterStages) as any,
      matterFields: (parsed.matterFields ?? config.matterFields) as any,
    },
  });
}

// --- Helpers ---

function safeParseJson(value: any, fallback: any) {
  if (typeof value !== "string") return value ?? fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}

function mergeDedupe(existing: any[], incoming: any[]) {
  const ids = new Set(existing.map((e: any) => e.id ?? e.name ?? JSON.stringify(e)));
  return [...existing, ...incoming.filter((i: any) => !ids.has(i.id ?? i.name ?? JSON.stringify(i)))];
}

async function computeAvgRating(templateId: string, newRating: number) {
  const tpl = await db.communityPipelineTemplate.findUniqueOrThrow({ where: { id: templateId } });
  return ((tpl.ratingSum ?? 0) + newRating) / ((tpl.ratingCount ?? 0) + 1);
}
