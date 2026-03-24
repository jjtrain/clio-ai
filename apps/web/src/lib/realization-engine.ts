import { db } from "@/lib/db";

// ─── Types ───────────────────────────────────────────────────────

export interface RealizationResult {
  hoursWorked: number;
  hoursBilled: number;
  amountBilled: number;
  amountCollected: number;
  standardRate: number;
  billingRealization: number;   // hoursBilled / hoursWorked
  collectionRealization: number; // amountCollected / amountBilled
  combinedRealization: number;   // amountCollected / (hoursWorked * standardRate)
  severity: "ok" | "warning" | "critical";
}

export type Dimension = "ATTORNEY" | "PRACTICE_AREA" | "CLIENT" | "MATTER_TYPE";

// ─── Core Calculation ────────────────────────────────────────────

export async function calculateRealization(
  firmId: string,
  dimension: Dimension,
  dimensionValue: string,
  startDate: Date,
  endDate: Date,
): Promise<RealizationResult> {
  // Build filters based on dimension
  const timeWhere: any = { date: { gte: startDate, lt: endDate } };
  const invoiceWhere: any = { issueDate: { gte: startDate, lt: endDate } };

  switch (dimension) {
    case "ATTORNEY":
      timeWhere.userId = dimensionValue;
      // For invoices, get matters where the attorney has time entries
      break;
    case "PRACTICE_AREA":
      timeWhere.matter = { practiceArea: dimensionValue };
      invoiceWhere.matter = { practiceArea: dimensionValue };
      break;
    case "CLIENT":
      timeWhere.matter = { clientId: dimensionValue };
      invoiceWhere.matter = { clientId: dimensionValue };
      break;
    case "MATTER_TYPE":
      timeWhere.matter = { practiceArea: dimensionValue };
      invoiceWhere.matter = { practiceArea: dimensionValue };
      break;
  }

  // Fetch time entries
  const timeEntries = await db.timeEntry.findMany({
    where: timeWhere,
    select: { hours: true, duration: true, rate: true, billable: true, invoiceLineItemId: true },
  });

  // Fetch invoices
  let invoices;
  if (dimension === "ATTORNEY") {
    // Get matter IDs from attorney's time entries
    const matterTimeEntries = await db.timeEntry.findMany({
      where: { userId: dimensionValue, date: { gte: startDate, lt: endDate } },
      select: { matterId: true },
      distinct: ["matterId"],
    });
    const matterIds = matterTimeEntries.map((t) => t.matterId);
    invoices = await db.invoice.findMany({
      where: { matterId: { in: matterIds }, issueDate: { gte: startDate, lt: endDate } },
      select: { total: true, amountPaid: true },
    });
  } else {
    invoices = await db.invoice.findMany({
      where: invoiceWhere,
      select: { total: true, amountPaid: true },
    });
  }

  // Calculate metrics
  const hoursWorked = timeEntries.reduce((s, e) => s + (e.hours || e.duration / 60), 0);
  const hoursBilled = timeEntries
    .filter((e) => e.billable && e.invoiceLineItemId)
    .reduce((s, e) => s + (e.hours || e.duration / 60), 0);

  // Weighted average rate
  const totalRateHours = timeEntries.reduce((s, e) => {
    const h = e.hours || e.duration / 60;
    return s + h * Number(e.rate || 0);
  }, 0);
  const standardRate = hoursWorked > 0 ? totalRateHours / hoursWorked : 0;

  const amountBilled = invoices.reduce((s, i) => s + Number(i.total), 0);
  const amountCollected = invoices.reduce((s, i) => s + Number(i.amountPaid), 0);

  const billingRealization = hoursWorked > 0
    ? Math.round((hoursBilled / hoursWorked) * 1000) / 10
    : 0;
  const collectionRealization = amountBilled > 0
    ? Math.round((amountCollected / amountBilled) * 1000) / 10
    : 0;
  const potentialRevenue = hoursWorked * standardRate;
  const combinedRealization = potentialRevenue > 0
    ? Math.round((amountCollected / potentialRevenue) * 1000) / 10
    : 0;

  const severity = combinedRealization < 50 ? "critical"
    : combinedRealization < 70 ? "warning"
    : "ok";

  return {
    hoursWorked: Math.round(hoursWorked * 10) / 10,
    hoursBilled: Math.round(hoursBilled * 10) / 10,
    amountBilled: Math.round(amountBilled),
    amountCollected: Math.round(amountCollected),
    standardRate: Math.round(standardRate),
    billingRealization,
    collectionRealization,
    combinedRealization,
    severity,
  };
}

// ─── Snapshot All Dimensions ────────────────────────────────────

export async function snapshotAllDimensions(firmId: string, period: string) {
  const [yearStr, monthStr] = period.split("-");
  const year = parseInt(yearStr);
  const month = parseInt(monthStr) - 1;
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 1);

  // Prior period for trend
  const priorStart = new Date(year, month - 1, 1);
  const priorEnd = new Date(year, month, 1);
  const priorPeriod = `${priorStart.getFullYear()}-${String(priorStart.getMonth() + 1).padStart(2, "0")}`;

  const snapshots: any[] = [];

  // ── Attorney dimension ──
  const attorneys = await db.timeEntry.findMany({
    where: { date: { gte: startDate, lt: endDate } },
    select: { userId: true, user: { select: { name: true } } },
    distinct: ["userId"],
  });

  for (const att of attorneys) {
    if (!att.userId) continue;
    const result = await calculateRealization(firmId, "ATTORNEY", att.userId, startDate, endDate);
    if (result.hoursWorked === 0) continue;
    const prior = await getPriorRate(firmId, "ATTORNEY", att.userId, priorPeriod);
    snapshots.push({
      firmId,
      dimension: "ATTORNEY",
      dimensionId: att.userId,
      dimensionLabel: att.user?.name || att.userId,
      period,
      ...flattenResult(result),
      trend: getTrend(result.combinedRealization, prior),
    });
  }

  // ── Practice Area dimension ──
  const practiceAreas = await db.matter.findMany({
    where: { timeEntries: { some: { date: { gte: startDate, lt: endDate } } } },
    select: { practiceArea: true },
    distinct: ["practiceArea"],
  });

  for (const pa of practiceAreas) {
    if (!pa.practiceArea) continue;
    const result = await calculateRealization(firmId, "PRACTICE_AREA", pa.practiceArea, startDate, endDate);
    if (result.hoursWorked === 0) continue;
    const prior = await getPriorRate(firmId, "PRACTICE_AREA", pa.practiceArea, priorPeriod);
    snapshots.push({
      firmId,
      dimension: "PRACTICE_AREA",
      dimensionId: pa.practiceArea,
      dimensionLabel: pa.practiceArea.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      period,
      ...flattenResult(result),
      trend: getTrend(result.combinedRealization, prior),
    });
  }

  // ── Client dimension ──
  const clients = await db.matter.findMany({
    where: { timeEntries: { some: { date: { gte: startDate, lt: endDate } } } },
    select: { clientId: true, client: { select: { name: true } } },
    distinct: ["clientId"],
  });

  for (const cl of clients) {
    if (!cl.clientId) continue;
    const result = await calculateRealization(firmId, "CLIENT", cl.clientId, startDate, endDate);
    if (result.hoursWorked === 0) continue;
    const prior = await getPriorRate(firmId, "CLIENT", cl.clientId, priorPeriod);
    snapshots.push({
      firmId,
      dimension: "CLIENT",
      dimensionId: cl.clientId,
      dimensionLabel: cl.client?.name || cl.clientId,
      period,
      ...flattenResult(result),
      trend: getTrend(result.combinedRealization, prior),
    });
  }

  // ── Matter Type dimension (same as practice area for now) ──
  // In practice this could be litigation vs transactional, but we use practiceArea
  for (const pa of practiceAreas) {
    if (!pa.practiceArea) continue;
    const result = await calculateRealization(firmId, "MATTER_TYPE", pa.practiceArea, startDate, endDate);
    if (result.hoursWorked === 0) continue;
    const prior = await getPriorRate(firmId, "MATTER_TYPE", pa.practiceArea, priorPeriod);
    snapshots.push({
      firmId,
      dimension: "MATTER_TYPE",
      dimensionId: pa.practiceArea,
      dimensionLabel: pa.practiceArea.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
      period,
      ...flattenResult(result),
      trend: getTrend(result.combinedRealization, prior),
    });
  }

  // Upsert all snapshots
  let count = 0;
  for (const snap of snapshots) {
    await db.realizationSnapshot.upsert({
      where: {
        firmId_dimension_dimensionId_period: {
          firmId: snap.firmId,
          dimension: snap.dimension,
          dimensionId: snap.dimensionId,
          period: snap.period,
        },
      },
      create: snap,
      update: snap,
    });
    count++;
  }

  return { count, dimensions: { attorneys: attorneys.length, practiceAreas: practiceAreas.length, clients: clients.length } };
}

// ─── Helpers ─────────────────────────────────────────────────────

function flattenResult(r: RealizationResult) {
  return {
    hoursWorked: r.hoursWorked,
    hoursBilled: r.hoursBilled,
    amountBilled: r.amountBilled,
    amountCollected: r.amountCollected,
    standardRate: r.standardRate,
    billingRealizationRate: r.billingRealization,
    collectionRealizationRate: r.collectionRealization,
    combinedRealizationRate: r.combinedRealization,
    severity: r.severity === "ok" ? null : r.severity,
  };
}

async function getPriorRate(firmId: string, dimension: string, dimensionId: string, priorPeriod: string): Promise<number | null> {
  const prior = await db.realizationSnapshot.findUnique({
    where: {
      firmId_dimension_dimensionId_period: { firmId, dimension, dimensionId, period: priorPeriod },
    },
    select: { combinedRealizationRate: true },
  });
  return prior?.combinedRealizationRate ?? null;
}

function getTrend(current: number, prior: number | null): string {
  if (prior === null) return "stable";
  const diff = current - prior;
  if (diff > 3) return "improving";
  if (diff < -3) return "declining";
  return "stable";
}

// ─── Firm-Wide Summary ──────────────────────────────────────────

export async function getFirmWideSummary(firmId: string, period: string) {
  const snapshots = await db.realizationSnapshot.findMany({
    where: { firmId, period, dimension: "ATTORNEY" },
  });

  if (snapshots.length === 0) return null;

  const totals = snapshots.reduce(
    (acc, s) => ({
      hoursWorked: acc.hoursWorked + s.hoursWorked,
      hoursBilled: acc.hoursBilled + s.hoursBilled,
      amountBilled: acc.amountBilled + s.amountBilled,
      amountCollected: acc.amountCollected + s.amountCollected,
    }),
    { hoursWorked: 0, hoursBilled: 0, amountBilled: 0, amountCollected: 0 }
  );

  const avgRate = snapshots.reduce((s, snap) => s + snap.standardRate, 0) / snapshots.length;
  const potentialRevenue = totals.hoursWorked * avgRate;

  return {
    ...totals,
    billingRealization: totals.hoursWorked > 0
      ? Math.round((totals.hoursBilled / totals.hoursWorked) * 1000) / 10
      : 0,
    collectionRealization: totals.amountBilled > 0
      ? Math.round((totals.amountCollected / totals.amountBilled) * 1000) / 10
      : 0,
    combinedRealization: potentialRevenue > 0
      ? Math.round((totals.amountCollected / potentialRevenue) * 1000) / 10
      : 0,
  };
}

// ─── Trailing 12 months ─────────────────────────────────────────

export async function getTrailing12(firmId: string) {
  const now = new Date();
  const periods: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const results: Array<{ period: string; billing: number; collection: number; combined: number }> = [];

  for (const period of periods) {
    const summary = await getFirmWideSummary(firmId, period);
    results.push({
      period,
      billing: summary?.billingRealization || 0,
      collection: summary?.collectionRealization || 0,
      combined: summary?.combinedRealization || 0,
    });
  }

  return results;
}
