import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function loadConfig(practiceArea: string) {
  return db.practiceAreaConfig.findFirst({
    where: { practiceArea: practiceArea as any },
  });
}

function parseJson<T>(value: unknown, fallback: T): T {
  try {
    if (!value) return fallback;
    return typeof value === "string" ? JSON.parse(value) : (value as T);
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Default constants
// ---------------------------------------------------------------------------

const DEFAULT_TERMINOLOGY = {
  party1: "Client",
  party2: "Opposing Party",
  case: "Matter",
  judge: "Judge",
  filing: "Filing",
  court: "Court",
};

const DEFAULT_STAGES = [
  { id: "intake", name: "Intake", order: 0 },
  { id: "active", name: "Active", order: 1 },
  { id: "closed", name: "Closed", order: 2 },
];

const DEFAULT_BILLING = { defaultHourlyRate: 300, billingIncrement: 6 };

// ---------------------------------------------------------------------------
// 1. getActiveConfig
// ---------------------------------------------------------------------------

export async function getActiveConfig(userId: string) {
  const pref = await db.userPracticeAreaPreference.findFirst({
    where: { userId },
  });

  if (pref?.activePracticeArea) {
    return loadConfig(pref.activePracticeArea);
  }

  const primary = await db.practiceAreaConfig.findFirst({
    where: { isPrimary: true },
  });

  return primary ?? loadConfig("GENERAL_PRACTICE");
}

// ---------------------------------------------------------------------------
// 2. getTerminology
// ---------------------------------------------------------------------------

export async function getTerminology(practiceArea: string) {
  const config = await loadConfig(practiceArea);
  return parseJson(config?.terminology, DEFAULT_TERMINOLOGY);
}

// ---------------------------------------------------------------------------
// 3. getMatterStages
// ---------------------------------------------------------------------------

export async function getMatterStages(practiceArea: string) {
  const config = await loadConfig(practiceArea);
  return parseJson(config?.matterStages, DEFAULT_STAGES);
}

// ---------------------------------------------------------------------------
// 4. getMatterFields
// ---------------------------------------------------------------------------

export async function getMatterFields(practiceArea: string) {
  const config = await loadConfig(practiceArea);
  return parseJson(config?.matterFields, [] as any[]);
}

// ---------------------------------------------------------------------------
// 5. getIntakeFields
// ---------------------------------------------------------------------------

export async function getIntakeFields(practiceArea: string) {
  const config = await loadConfig(practiceArea);
  return parseJson(config?.intakeFields, [] as any[]);
}

// ---------------------------------------------------------------------------
// 6. getBillingDefaults
// ---------------------------------------------------------------------------

export async function getBillingDefaults(practiceArea: string) {
  const config = await loadConfig(practiceArea);
  return parseJson(config?.billingDefaults, DEFAULT_BILLING);
}

// ---------------------------------------------------------------------------
// 7. getDashboardWidgets
// ---------------------------------------------------------------------------

export async function getDashboardWidgets(practiceArea: string, userId: string) {
  const config = await loadConfig(practiceArea);
  const configWidgets = parseJson(config?.dashboardWidgets, [] as any[]);

  const pref = await db.userPracticeAreaPreference.findFirst({
    where: { userId },
  });
  const userLayout = parseJson(pref?.customDashboardLayout, [] as any[]);

  return [...configWidgets, ...userLayout];
}

// ---------------------------------------------------------------------------
// 8. getSidebarConfig
// ---------------------------------------------------------------------------

export async function getSidebarConfig(practiceArea: string, userId: string) {
  const config = await loadConfig(practiceArea);
  const visibleModules = parseJson(config?.sidebarModules, [] as any[]);
  const hiddenModules = parseJson(config?.hiddenModules, [] as any[]);
  const relatedModules = parseJson(config?.relatedModules, [] as any[]);

  const pref = await db.userPracticeAreaPreference.findFirst({
    where: { userId },
  });
  const order = parseJson(pref?.customSidebarOrder, [] as any[]);

  return { visibleModules: [...visibleModules, ...relatedModules], hiddenModules, order };
}

// ---------------------------------------------------------------------------
// 9. getDocumentTemplates
// ---------------------------------------------------------------------------

export async function getDocumentTemplates(practiceArea: string) {
  const config = await loadConfig(practiceArea);
  return parseJson(config?.documentTemplates, [] as any[]);
}

// ---------------------------------------------------------------------------
// 10. getDeadlineRules
// ---------------------------------------------------------------------------

export async function getDeadlineRules(practiceArea: string) {
  const config = await loadConfig(practiceArea);
  return parseJson(config?.deadlineRules, [] as any[]);
}

// ---------------------------------------------------------------------------
// 11. getChecklistTemplates
// ---------------------------------------------------------------------------

export async function getChecklistTemplates(practiceArea: string) {
  const config = await loadConfig(practiceArea);
  return parseJson(config?.checklistTemplates, [] as any[]);
}

// ---------------------------------------------------------------------------
// 12. switchPracticeArea
// ---------------------------------------------------------------------------

export async function switchPracticeArea(userId: string, practiceArea: string) {
  await db.userPracticeAreaPreference.upsert({
    where: { userId },
    create: { userId, activePracticeArea: practiceArea as any, enabledPracticeAreas: JSON.stringify([practiceArea]), lastSwitchedAt: new Date() },
    update: { activePracticeArea: practiceArea as any, lastSwitchedAt: new Date() },
  });

  return getActiveConfig(userId);
}

// ---------------------------------------------------------------------------
// 13. applyConfigToMatter
// ---------------------------------------------------------------------------

export async function applyConfigToMatter(matterId: string, practiceArea: string) {
  const config = await loadConfig(practiceArea);
  const terminology = parseJson(config?.terminology, DEFAULT_TERMINOLOGY);
  const stages = parseJson(config?.matterStages, DEFAULT_STAGES);
  const matterFields = parseJson(config?.matterFields, [] as any[]);

  const matter = await db.matter.update({
    where: { id: matterId },
    data: {
      practiceArea,
      currentStage: stages[0]?.id ?? "intake",
      stageEnteredAt: new Date(),
      party1Label: terminology.party1,
      party2Label: terminology.party2,
    },
  });

  for (const field of matterFields) {
    await db.customField.create({
      data: {
        matterId,
        practiceArea: practiceArea as any,
        fieldName: field.name ?? field.fieldName,
        fieldLabel: field.label ?? field.fieldLabel ?? field.fieldName,
        fieldType: field.type ?? field.fieldType ?? "text",
        fieldValue: field.defaultValue ?? null,
      },
    });
  }

  return matter;
}

// ---------------------------------------------------------------------------
// 14. advanceMatterStage
// ---------------------------------------------------------------------------

export async function advanceMatterStage(matterId: string, newStage: string, changedBy?: string) {
  const matter = await db.matter.findUniqueOrThrow({ where: { id: matterId } });

  const durationMs = matter.stageEnteredAt
    ? Date.now() - new Date(matter.stageEnteredAt).getTime()
    : 0;
  const durationDays = Math.round(durationMs / (1000 * 60 * 60 * 24));

  await db.matterStageHistory.create({
    data: {
      matterId,
      fromStage: matter.currentStage ?? "unknown",
      toStage: newStage,
      durationInPreviousStage: durationDays,
      changedBy: changedBy ?? null,
      changedAt: new Date(),
    },
  });

  return db.matter.update({
    where: { id: matterId },
    data: { currentStage: newStage, stageEnteredAt: new Date() },
  });
}

// ---------------------------------------------------------------------------
// 15. getStageAnalytics
// ---------------------------------------------------------------------------

export async function getStageAnalytics(
  practiceArea: string,
  dateRange: { from: Date; to: Date },
) {
  const histories = await db.matterStageHistory.findMany({
    where: {
      changedAt: { gte: dateRange.from, lte: dateRange.to },
      matter: { practiceArea },
    },
    include: { matter: true },
  });

  const stageMap: Record<string, { totalDays: number; count: number }> = {};

  for (const h of histories) {
    const key = h.fromStage || "unknown";
    if (!stageMap[key]) stageMap[key] = { totalDays: 0, count: 0 };
    stageMap[key].totalDays += h.durationInPreviousStage ?? 0;
    stageMap[key].count += 1;
  }

  const analytics = Object.entries(stageMap).map(([stage, data]) => ({
    stage,
    avgDays: data.count > 0 ? Math.round(data.totalDays / data.count) : 0,
    matterCount: data.count,
  }));

  return analytics;
}

// ---------------------------------------------------------------------------
// 16. generatePracticeAreaReport
// ---------------------------------------------------------------------------

export async function generatePracticeAreaReport(
  practiceArea: string,
  dateRange: { from: Date; to: Date },
) {
  const matters = await db.matter.findMany({
    where: { practiceArea, createdAt: { gte: dateRange.from, lte: dateRange.to } },
    include: { timeEntries: true },
  });

  const byStage: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let totalRevenue = 0;

  for (const m of matters) {
    byStage[m.currentStage ?? "unknown"] = (byStage[m.currentStage ?? "unknown"] ?? 0) + 1;
    byStatus[m.status ?? "unknown"] = (byStatus[m.status ?? "unknown"] ?? 0) + 1;
    for (const te of m.timeEntries ?? []) {
      totalRevenue += (Number(te.duration) / 60) * Number(te.rate ?? 0);
    }
  }

  const insights = await aiRouter.complete({
    feature: "practice_area_report",
    systemPrompt: "You are a legal practice management analyst. Summarize this practice area report concisely.",
    userPrompt: `Practice area: ${practiceArea}. ${matters.length} matters, revenue $${totalRevenue}. Stages: ${JSON.stringify(byStage)}. Statuses: ${JSON.stringify(byStatus)}.`,
  });

  return { practiceArea, totalMatters: matters.length, byStage, byStatus, totalRevenue, insights };
}

// ---------------------------------------------------------------------------
// 17. createCustomPracticeArea
// ---------------------------------------------------------------------------

export async function createCustomPracticeArea(params: {
  name: string;
  terminology: any;
  matterStages: any;
  [key: string]: any;
}) {
  const { name, terminology, matterStages, ...rest } = params;

  const data: Record<string, any> = {
    practiceArea: "PA_CUSTOM" as any,
    displayName: name,
    isCustom: true,
    terminology: JSON.stringify(terminology),
    matterStages: JSON.stringify(matterStages),
  };

  for (const [k, v] of Object.entries(rest)) {
    data[k] = typeof v === "object" ? JSON.stringify(v) : v;
  }

  return db.practiceAreaConfig.create({ data: data as any });
}

// ---------------------------------------------------------------------------
// 18. clonePracticeAreaConfig
// ---------------------------------------------------------------------------

export async function clonePracticeAreaConfig(fromPracticeArea: string, newName: string) {
  const source = await loadConfig(fromPracticeArea);
  if (!source) throw new Error(`Config not found for ${fromPracticeArea}`);

  const { id, createdAt, updatedAt, ...fields } = source as any;

  return db.practiceAreaConfig.create({
    data: {
      ...fields,
      displayName: newName,
      practiceArea: "PA_CUSTOM" as any,
      isCustom: true,
    },
  });
}
