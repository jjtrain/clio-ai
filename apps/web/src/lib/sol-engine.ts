import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

export function calculateExpiration(accrualDate: Date, limitationDays: number, tollingDays: number): Date {
  return new Date(accrualDate.getTime() + (limitationDays + tollingDays) * 86400000);
}

export function calculateDaysRemaining(expirationDate: Date): number {
  return Math.ceil((expirationDate.getTime() - Date.now()) / 86400000);
}

export async function calculateUrgency(daysRemaining: number): Promise<string> {
  const settings = await db.sOLSettings.findFirst();
  const critical = settings?.criticalThresholdDays ?? 90;
  const warning = settings?.warningThresholdDays ?? 180;
  const monitor = settings?.monitorThresholdDays ?? 365;
  if (daysRemaining <= 0) return "SOL_URG_EXPIRED" as any;
  if (daysRemaining <= critical) return "SOL_CRITICAL" as any;
  if (daysRemaining <= warning) return "SOL_WARNING" as any;
  if (daysRemaining <= monitor) return "SOL_MONITOR" as any;
  return "SOL_SAFE" as any;
}

export function calculateRiskLevel(sol: any): { level: string; notes: string } {
  const days = sol.daysRemaining ?? calculateDaysRemaining(new Date(sol.expirationDate));
  if (days <= 30) return { level: "SRL_EXTREME" as any, notes: `Only ${days} days remaining - immediate action required` };
  if (days <= 90) return { level: "SRL_HIGH" as any, notes: `${days} days remaining - urgent attention needed` };
  if (days <= 180) return { level: "SRL_MEDIUM" as any, notes: `${days} days remaining - monitor closely` };
  return { level: "SRL_LOW" as any, notes: `${days} days remaining - within safe window` };
}

export async function createFromTemplate(params: { templateId: string; matterId: string; accrualDate: Date; assignedTo?: string; notes?: string }) {
  const template = await db.sOLTemplate.findUniqueOrThrow({ where: { id: params.templateId } });
  const settings = await db.sOLSettings.findFirst();
  const expirationDate = calculateExpiration(params.accrualDate, template.limitationDays, 0);
  const daysRemaining = calculateDaysRemaining(expirationDate);
  const urgency = await calculateUrgency(daysRemaining);
  const risk = calculateRiskLevel({ daysRemaining, expirationDate });
  return db.statuteOfLimitations.create({
    data: {
      matterId: params.matterId, practiceArea: template.practiceArea, jurisdiction: template.jurisdiction,
      causeOfAction: template.causeOfAction, accrualDate: params.accrualDate, accrualBasis: template.accrualBasis,
      limitationPeriod: template.limitationPeriod, limitationDays: template.limitationDays,
      expirationDate, statute: template.statute, statuteDescription: template.statuteDescription,
      noticeOfClaimRequired: template.noticeOfClaimRequired, daysRemaining, urgency: urgency as any,
      riskLevel: risk.level as any, riskNotes: risk.notes, assignedTo: params.assignedTo, notes: params.notes,
      alertSchedule: settings?.alertScheduleDays ?? "365,180,90,60,30,14,7,3,1",
    },
  });
}

export async function createCustom(params: {
  matterId: string; practiceArea: string; jurisdiction: string; causeOfAction: string;
  accrualDate: Date; accrualBasis: string; limitationPeriod: string; limitationDays: number;
  statute?: string; assignedTo?: string; notes?: string;
}) {
  const settings = await db.sOLSettings.findFirst();
  const expirationDate = calculateExpiration(params.accrualDate, params.limitationDays, 0);
  const daysRemaining = calculateDaysRemaining(expirationDate);
  const urgency = await calculateUrgency(daysRemaining);
  const risk = calculateRiskLevel({ daysRemaining, expirationDate });
  return db.statuteOfLimitations.create({
    data: {
      matterId: params.matterId, practiceArea: params.practiceArea, jurisdiction: params.jurisdiction,
      causeOfAction: params.causeOfAction, accrualDate: params.accrualDate, accrualBasis: params.accrualBasis as any,
      limitationPeriod: params.limitationPeriod, limitationDays: params.limitationDays,
      expirationDate, statute: params.statute, daysRemaining, urgency: urgency as any,
      riskLevel: risk.level as any, riskNotes: risk.notes, assignedTo: params.assignedTo, notes: params.notes,
      alertSchedule: settings?.alertScheduleDays ?? "365,180,90,60,30,14,7,3,1",
    },
  });
}

export async function applyTolling(solId: string, params: { reason: string; startDate: Date; endDate: Date }) {
  const sol = await db.statuteOfLimitations.findUniqueOrThrow({ where: { id: solId } });
  const tollingDays = Math.ceil((params.endDate.getTime() - params.startDate.getTime()) / 86400000);
  const newExpiration = calculateExpiration(new Date(sol.accrualDate), sol.limitationDays, tollingDays);
  const daysRemaining = calculateDaysRemaining(newExpiration);
  const urgency = await calculateUrgency(daysRemaining);
  return db.statuteOfLimitations.update({
    where: { id: solId },
    data: {
      tollingApplied: true, tollingReason: params.reason, tollingStartDate: params.startDate,
      tollingEndDate: params.endDate, tollingDays, originalExpirationDate: sol.expirationDate,
      expirationDate: newExpiration, daysRemaining, urgency: urgency as any, status: "SOL_TOLLED" as any,
    },
  });
}

export async function removeTolling(solId: string) {
  const sol = await db.statuteOfLimitations.findUniqueOrThrow({ where: { id: solId } });
  const expiration = sol.originalExpirationDate ?? sol.expirationDate;
  const daysRemaining = calculateDaysRemaining(new Date(expiration));
  const urgency = await calculateUrgency(daysRemaining);
  return db.statuteOfLimitations.update({
    where: { id: solId },
    data: {
      tollingApplied: false, tollingReason: null, tollingStartDate: null, tollingEndDate: null,
      tollingDays: 0, originalExpirationDate: null, expirationDate: expiration,
      daysRemaining, urgency: urgency as any, status: "SOL_ACTIVE" as any,
    },
  });
}

export async function markFiled(solId: string, params: { filedDate: Date; filedDocumentId?: string }) {
  return db.statuteOfLimitations.update({
    where: { id: solId },
    data: { status: "SOL_FILED" as any, filedDate: params.filedDate, filedDocumentId: params.filedDocumentId },
  });
}

export async function checkAlerts() {
  const sols = await db.statuteOfLimitations.findMany({ where: { status: "SOL_ACTIVE" as any } });
  const thresholds = [365, 180, 90, 60, 30, 14, 7, 3, 1, 0];
  const alertTypeMap: Record<number, string> = { 365: "SAT_DAY_365", 180: "SAT_DAY_180", 90: "SAT_DAY_90", 60: "SAT_DAY_60", 30: "SAT_DAY_30", 14: "SAT_DAY_14", 7: "SAT_DAY_7", 3: "SAT_DAY_3", 1: "SAT_DAY_1", 0: "SAT_EXPIRED" };
  const severityMap: Record<number, string> = { 365: "SAS_INFO", 180: "SAS_INFO", 90: "SAS_WARNING", 60: "SAS_WARNING", 30: "SAS_URGENT", 14: "SAS_URGENT", 7: "SAS_CRITICAL", 3: "SAS_CRITICAL", 1: "SAS_CRITICAL", 0: "SAS_CRITICAL" };
  let created = 0;
  for (const sol of sols) {
    const days = calculateDaysRemaining(new Date(sol.expirationDate));
    for (const t of thresholds) {
      if (days <= t) {
        const existing = await db.sOLAlert.findFirst({ where: { solId: sol.id, alertType: alertTypeMap[t] as any } });
        if (!existing) {
          await db.sOLAlert.create({
            data: { solId: sol.id, matterId: sol.matterId, alertType: alertTypeMap[t] as any, severity: severityMap[t] as any, title: `SOL ${t === 0 ? "Expired" : `${t}-Day Warning`}: ${sol.causeOfAction}`, message: `Statute of limitations for ${sol.causeOfAction} ${t === 0 ? "has expired" : `expires in ${days} days`}.` },
          });
          created++;
        }
        break;
      }
    }
  }
  return { checked: sols.length, alertsCreated: created };
}

export async function generateDailyDigest() {
  const sols = await db.statuteOfLimitations.findMany({ where: { status: "SOL_ACTIVE" as any }, orderBy: { expirationDate: "asc" } });
  const groups: Record<string, any[]> = { SOL_CRITICAL: [], SOL_WARNING: [], SOL_MONITOR: [], SOL_SAFE: [] };
  for (const sol of sols) groups[sol.urgency]?.push(sol);
  const lines = [`SOL Daily Digest - ${new Date().toLocaleDateString()}`, `Total Active: ${sols.length}`];
  for (const [urgency, items] of Object.entries(groups)) {
    if (items.length > 0) lines.push(`\n${urgency} (${items.length}):`, ...items.map((s) => `  - ${s.causeOfAction} | ${s.jurisdiction} | Expires: ${new Date(s.expirationDate).toLocaleDateString()}`));
  }
  return lines.join("\n");
}

export async function generateWeeklyReport() {
  const sols = await db.statuteOfLimitations.findMany({ include: { matter: true }, orderBy: { expirationDate: "asc" } });
  const active = sols.filter((s) => s.status === "SOL_ACTIVE");
  const filed = sols.filter((s) => s.status === "SOL_FILED");
  const expired = sols.filter((s) => s.status === "SOL_EXPIRED");
  const critical = active.filter((s) => s.urgency === "SOL_CRITICAL");
  return {
    generatedAt: new Date(), totalSOLs: sols.length, active: active.length, filed: filed.length,
    expired: expired.length, critical: critical.length,
    expiringThisWeek: active.filter((s) => calculateDaysRemaining(new Date(s.expirationDate)) <= 7),
    expiringThisMonth: active.filter((s) => calculateDaysRemaining(new Date(s.expirationDate)) <= 30),
    byJurisdiction: Object.groupBy ? Object.groupBy(active, (s: any) => s.jurisdiction) : {},
  };
}

export async function suggestSOL(matterId: string) {
  const matter = await db.matter.findUniqueOrThrow({ where: { id: matterId } });
  const templates = await db.sOLTemplate.findMany({
    where: { isActive: true, ...(matter.practiceArea ? { practiceArea: matter.practiceArea } : {}) },
    orderBy: { displayOrder: "asc" },
  });
  return templates.map((t) => ({ templateId: t.id, causeOfAction: t.causeOfAction, limitationPeriod: t.limitationPeriod, limitationDays: t.limitationDays, statute: t.statute }));
}

export async function analyzeRisk(matterId: string) {
  const sols = await db.statuteOfLimitations.findMany({ where: { matterId }, include: { matter: true } });
  if (sols.length === 0) return { matterId, analysis: "No statutes of limitations tracked for this matter." };
  const solSummary = sols.map((s) => `${s.causeOfAction}: ${s.daysRemaining} days remaining (${s.urgency})`).join("\n");
  const result = await aiRouter.complete({
    feature: "sol-risk-analysis", matterId,
    systemPrompt: "You are a legal risk analyst. Analyze statute of limitations risks and provide actionable recommendations.",
    userPrompt: `Analyze SOL risk for matter with these statutes:\n${solSummary}\nProvide risk assessment and recommendations.`,
  });
  return { matterId, solCount: sols.length, analysis: result };
}

export async function bulkUpdateDaysRemaining() {
  const sols = await db.statuteOfLimitations.findMany({ where: { status: { in: ["SOL_ACTIVE" as any, "SOL_TOLLED" as any] } } });
  let count = 0;
  for (const sol of sols) {
    const daysRemaining = calculateDaysRemaining(new Date(sol.expirationDate));
    const urgency = await calculateUrgency(daysRemaining);
    const risk = calculateRiskLevel({ daysRemaining, expirationDate: sol.expirationDate });
    await db.statuteOfLimitations.update({ where: { id: sol.id }, data: { daysRemaining, urgency: urgency as any, riskLevel: risk.level as any, riskNotes: risk.notes } });
    count++;
  }
  return count;
}

export async function getExpirationCalendar(dateRange: { start: Date; end: Date }) {
  const sols = await db.statuteOfLimitations.findMany({
    where: { expirationDate: { gte: dateRange.start, lte: dateRange.end }, status: { in: ["SOL_ACTIVE" as any, "SOL_TOLLED" as any] } },
    include: { matter: true }, orderBy: { expirationDate: "asc" },
  });
  return sols.map((s) => ({
    id: s.id, date: s.expirationDate, title: `${s.causeOfAction} - ${s.matter.name}`,
    urgency: s.urgency, matterId: s.matterId, jurisdiction: s.jurisdiction, daysRemaining: s.daysRemaining,
  }));
}

export async function detectMissedClaims(matterId: string) {
  const matter = await db.matter.findUniqueOrThrow({ where: { id: matterId }, include: { solEntries: true } });
  const existing = matter.solEntries.map((s: any) => s.causeOfAction).join(", ");
  const result = await aiRouter.complete({
    feature: "sol-missed-claims", matterId,
    systemPrompt: "You are a legal analyst specializing in statute of limitations. Identify potentially missed causes of action.",
    userPrompt: `Matter: ${matter.name}\nPractice Area: ${matter.practiceArea}\nJurisdiction: ${matter.practiceArea}\nExisting claims: ${existing || "None"}\n\nSuggest any missed causes of action with their limitation periods.`,
  });
  return { matterId, existingClaims: matter.solEntries.length, suggestions: result };
}
