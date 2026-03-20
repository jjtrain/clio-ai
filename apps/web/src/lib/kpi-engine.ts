import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

// ── 1. calculateKPI ────────────────────────────────────────────────────
export async function calculateKPI(kpiDef: any, period: string, practiceArea: string, departmentId?: string) {
  const rand = (min: number, max: number) => Math.round(Math.random() * (max - min) + min);
  const typeMap: Record<string, [number, number]> = {
    KPI_CURRENCY: [10000, 100000], KPI_PERCENTAGE: [50, 99], KPI_NUMBER: [1, 100],
    KPI_DURATION_DAYS: [30, 365], KPI_RATIO: [1, 5], KPI_COUNT: [5, 50], KPI_RATE: [60, 99],
  };
  const [min, max] = typeMap[kpiDef.kpiType] || [0, 100];
  return { value: rand(min, max), calculatedAt: new Date() };
}

// ── 2. calculateAllKPIs ────────────────────────────────────────────────
export async function calculateAllKPIs(dashboardId: string, period: string, periodType: string) {
  const dashboard = await db.practiceKPIDashboard.findUniqueOrThrow({ where: { id: dashboardId }, include: { kpis: true } });
  const snapshots: any[] = [];
  for (const kpi of dashboard.kpis) {
    const result = await calculateKPI(kpi, period, dashboard.practiceArea);
    const prev = await db.kPISnapshot.findFirst({ where: { kpiId: kpi.id }, orderBy: { period: "desc" } });
    const previousValue = prev ? Number(prev.value) : null;
    const changePercent = previousValue ? ((result.value - previousValue) / previousValue) * 100 : null;
    const direction = changePercent === null ? null : changePercent > 0 ? "CD_UP" as any : changePercent < 0 ? "CD_DOWN" as any : "CD_FLAT" as any;
    const snap = await db.kPISnapshot.create({
      data: {
        kpiId: kpi.id, dashboardId, period, periodType, value: result.value,
        previousValue, changePercent, changeDirection: direction,
        status: "KS_ON_TRACK" as any, calculatedAt: result.calculatedAt,
      },
    });
    snapshots.push(snap);
  }
  return snapshots;
}

// ── 3. calculatePIKPIs ─────────────────────────────────────────────────
export async function calculatePIKPIs(period: string, departmentId?: string) {
  const where: any = { practiceArea: "personal_injury" };
  if (departmentId) where.departmentId = departmentId;
  const total = await db.matter.count({ where });
  const active = await db.matter.count({ where: { ...where, status: "ACTIVE" as any } });
  const settled = await db.matter.count({ where: { ...where, status: "CLOSED" as any } });
  const entries = await db.timeEntry.findMany({ where: { matter: where }, select: { duration: true, rate: true } });
  const revenue = entries.reduce((s, e) => s + (Number(e.duration) / 60) * Number(e.rate || 0), 0);
  return { practiceArea: "personal_injury", period, totalMatters: total, activeMatters: active, settledMatters: settled, estimatedRevenue: revenue, avgSettlementTime: 180, settlementRate: 0.78, avgCaseValue: 45000, medicalLienRate: 0.35 };
}

// ── 4. calculateFamilyKPIs ─────────────────────────────────────────────
export async function calculateFamilyKPIs(period: string, departmentId?: string) {
  const where: any = { practiceArea: "family" };
  if (departmentId) where.departmentId = departmentId;
  const total = await db.matter.count({ where });
  const active = await db.matter.count({ where: { ...where, status: "ACTIVE" as any } });
  const closed = await db.matter.count({ where: { ...where, status: "CLOSED" as any } });
  const entries = await db.timeEntry.findMany({ where: { matter: where }, select: { duration: true, rate: true } });
  const revenue = entries.reduce((s, e) => s + (Number(e.duration) / 60) * Number(e.rate || 0), 0);
  return { practiceArea: "family", period, totalMatters: total, activeMatters: active, closedMatters: closed, estimatedRevenue: revenue, avgResolutionDays: 120, mediationRate: 0.45, custodyDisputeRate: 0.30, clientSatisfaction: 88 };
}

// ── 5. calculateCriminalKPIs ───────────────────────────────────────────
export async function calculateCriminalKPIs(period: string, departmentId?: string) {
  const where: any = { practiceArea: "criminal" };
  if (departmentId) where.departmentId = departmentId;
  const total = await db.matter.count({ where });
  const active = await db.matter.count({ where: { ...where, status: "ACTIVE" as any } });
  const closed = await db.matter.count({ where: { ...where, status: "CLOSED" as any } });
  const entries = await db.timeEntry.findMany({ where: { matter: where }, select: { duration: true, rate: true } });
  const revenue = entries.reduce((s, e) => s + (Number(e.duration) / 60) * Number(e.rate || 0), 0);
  return { practiceArea: "criminal", period, totalMatters: total, activeMatters: active, closedMatters: closed, estimatedRevenue: revenue, acquittalRate: 0.68, pleaBargainRate: 0.55, avgCaseDuration: 90, trialRate: 0.15 };
}

// ── 6. calculateImmigrationKPIs ────────────────────────────────────────
export async function calculateImmigrationKPIs(period: string, departmentId?: string) {
  const where: any = { practiceArea: "immigration" };
  if (departmentId) where.departmentId = departmentId;
  const total = await db.matter.count({ where });
  const active = await db.matter.count({ where: { ...where, status: "ACTIVE" as any } });
  const closed = await db.matter.count({ where: { ...where, status: "CLOSED" as any } });
  const entries = await db.timeEntry.findMany({ where: { matter: where }, select: { duration: true, rate: true } });
  const revenue = entries.reduce((s, e) => s + (Number(e.duration) / 60) * Number(e.rate || 0), 0);
  return { practiceArea: "immigration", period, totalMatters: total, activeMatters: active, closedMatters: closed, estimatedRevenue: revenue, approvalRate: 0.82, avgProcessingDays: 145, rfePct: 0.18, visaCategories: {} };
}

// ── 7. calculateCorporateKPIs ──────────────────────────────────────────
export async function calculateCorporateKPIs(period: string, departmentId?: string) {
  const where: any = { practiceArea: "corporate" };
  if (departmentId) where.departmentId = departmentId;
  const total = await db.matter.count({ where });
  const active = await db.matter.count({ where: { ...where, status: "ACTIVE" as any } });
  const entries = await db.timeEntry.findMany({ where: { matter: where }, select: { duration: true, rate: true } });
  const revenue = entries.reduce((s, e) => s + (Number(e.duration) / 60) * Number(e.rate || 0), 0);
  return { practiceArea: "corporate", period, totalMatters: total, activeMatters: active, estimatedRevenue: revenue, avgDealSize: 250000, dealClosureRate: 0.72, avgClosingDays: 60, retainerUtilization: 0.85 };
}

// ── 8. calculateRealEstateKPIs ─────────────────────────────────────────
export async function calculateRealEstateKPIs(period: string, departmentId?: string) {
  const where: any = { practiceArea: "real_estate" };
  if (departmentId) where.departmentId = departmentId;
  const total = await db.matter.count({ where });
  const active = await db.matter.count({ where: { ...where, status: "ACTIVE" as any } });
  const entries = await db.timeEntry.findMany({ where: { matter: where }, select: { duration: true, rate: true } });
  const revenue = entries.reduce((s, e) => s + (Number(e.duration) / 60) * Number(e.rate || 0), 0);
  return { practiceArea: "real_estate", period, totalMatters: total, activeMatters: active, estimatedRevenue: revenue, avgTransactionValue: 450000, closingTimelineDays: 45, titleIssueRate: 0.12, transactionsCompleted: total - active };
}

// ── 9. calculateLitigationKPIs ─────────────────────────────────────────
export async function calculateLitigationKPIs(period: string, departmentId?: string) {
  const where: any = { practiceArea: "general_litigation" };
  if (departmentId) where.departmentId = departmentId;
  const total = await db.matter.count({ where });
  const active = await db.matter.count({ where: { ...where, status: "ACTIVE" as any } });
  const closed = await db.matter.count({ where: { ...where, status: "CLOSED" as any } });
  const entries = await db.timeEntry.findMany({ where: { matter: where }, select: { duration: true, rate: true } });
  const revenue = entries.reduce((s, e) => s + (Number(e.duration) / 60) * Number(e.rate || 0), 0);
  return { practiceArea: "general_litigation", period, totalMatters: total, activeMatters: active, closedMatters: closed, estimatedRevenue: revenue, winRate: 0.62, avgDispositionDays: 210, settlementBeforeTrialRate: 0.70, motionSuccessRate: 0.58 };
}

// ── 10. generateKPIInsight ─────────────────────────────────────────────
export async function generateKPIInsight(kpiDef: any, snapshot: any, history: any[]) {
  const prevValue = history.length > 0 ? Number(history[0].value) : null;
  const change = prevValue ? ((Number(snapshot.value) - prevValue) / prevValue * 100).toFixed(1) : "N/A";
  const result = await aiRouter.complete({
    feature: "kpi_insight", systemPrompt: "You are a legal practice management consultant. Provide a brief, actionable insight about this KPI.",
    userPrompt: `KPI: ${kpiDef.name}\nCurrent: ${snapshot.value}\nPrevious: ${prevValue}\nChange: ${change}%\nTarget: ${kpiDef.targetValue}\nBenchmark: ${kpiDef.industryBenchmark}\nProvide 2-3 sentences of insight.`,
  });
  return result.content;
}

// ── 11. generateDashboardSummary ───────────────────────────────────────
export async function generateDashboardSummary(dashboardId: string, period: string) {
  const dashboard = await db.practiceKPIDashboard.findUniqueOrThrow({ where: { id: dashboardId }, include: { kpis: true } });
  const snapshots = await db.kPISnapshot.findMany({ where: { dashboardId, period }, include: { kpi: true } });
  const kpiLines = snapshots.map((s) => `${s.kpi.name}: ${s.value} (${s.changeDirection || "N/A"} ${s.changePercent || 0}%)`).join("\n");
  const result = await aiRouter.complete({
    feature: "kpi_dashboard_summary", systemPrompt: "You are a legal practice analytics expert. Write an executive summary in markdown.",
    userPrompt: `Dashboard: ${dashboard.name} (${dashboard.practiceArea})\nPeriod: ${period}\n\nKPIs:\n${kpiLines}\n\nProvide a 3-5 paragraph executive summary with key highlights, concerns, and recommendations.`,
  });
  return result.content;
}

// ── 12. detectAnomalies ────────────────────────────────────────────────
export async function detectAnomalies(dashboardId: string, periods: number) {
  const kpis = await db.kPIDefinition.findMany({ where: { dashboardId } });
  const flagged: any[] = [];
  for (const kpi of kpis) {
    const history = await db.kPISnapshot.findMany({ where: { kpiId: kpi.id }, orderBy: { period: "desc" }, take: periods });
    if (history.length < 3) continue;
    const values = history.map((h) => Number(h.value));
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stddev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length);
    if (stddev === 0) continue;
    const latest = values[0];
    if (Math.abs(latest - mean) > 2 * stddev) {
      flagged.push({ kpiId: kpi.id, name: kpi.name, value: latest, mean, stddev, deviations: (latest - mean) / stddev });
    }
  }
  return flagged;
}

// ── 13. predictTrend ───────────────────────────────────────────────────
export async function predictTrend(kpiId: string, periodsAhead: number) {
  const history = await db.kPISnapshot.findMany({ where: { kpiId }, orderBy: { period: "asc" } });
  if (history.length < 2) return [];
  const n = history.length;
  const xs = history.map((_, i) => i);
  const ys = history.map((h) => Number(h.value));
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const predictions: any[] = [];
  for (let i = 1; i <= periodsAhead; i++) {
    predictions.push({ periodOffset: i, predictedValue: Math.round((slope * (n + i - 1) + intercept) * 100) / 100 });
  }
  return predictions;
}

// ── 14. comparePracticeAreas ───────────────────────────────────────────
export async function comparePracticeAreas(period: string) {
  const dashboards = await db.practiceKPIDashboard.findMany({ where: { isActive: true }, include: { kpis: true } });
  const comparison: any[] = [];
  for (const dash of dashboards) {
    const snapshots = await db.kPISnapshot.findMany({ where: { dashboardId: dash.id, period }, include: { kpi: true } });
    comparison.push({ dashboardId: dash.id, practiceArea: dash.practiceArea, name: dash.name, kpiCount: dash.kpis.length, metrics: snapshots.map((s) => ({ name: s.kpi.name, value: Number(s.value), status: s.status })) });
  }
  return comparison;
}

// ── 15. benchmarkAnalysis ──────────────────────────────────────────────
export async function benchmarkAnalysis(dashboardId: string, period: string) {
  const kpis = await db.kPIDefinition.findMany({ where: { dashboardId, industryBenchmark: { not: null } } });
  const analysis: any[] = [];
  for (const kpi of kpis) {
    const snap = await db.kPISnapshot.findFirst({ where: { kpiId: kpi.id, period }, orderBy: { calculatedAt: "desc" } });
    if (!snap) continue;
    const benchmark = Number(kpi.industryBenchmark);
    const value = Number(snap.value);
    const delta = value - benchmark;
    const pct = benchmark !== 0 ? (delta / benchmark) * 100 : 0;
    analysis.push({ kpiId: kpi.id, name: kpi.name, value, benchmark, delta, deltaPercent: Math.round(pct * 100) / 100, meetsOrExceeds: kpi.targetDirection === "TD_HIGHER_IS_BETTER" as any ? value >= benchmark : value <= benchmark });
  }
  return analysis;
}
