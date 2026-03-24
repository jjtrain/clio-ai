import { db } from "@/lib/db";

export async function computeCAC(firmId: string, period: string): Promise<any[]> {
  // Get all marketing spend for the period
  const spend = await db.marketingSpend.findMany({
    where: { period, OR: [{ firmId }, { firmId: null }] },
  });

  // Get new matters (retained) in this period
  const [year, month] = period.split("-").map(Number);
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59);

  const newMatters = await db.matter.findMany({
    where: { openDate: { gte: periodStart, lte: periodEnd } },
    include: { timeEntries: true, invoices: true },
  });

  // Group spend by practice area
  const spendByPA: Record<string, { total: number; bySrc: Record<string, number> }> = {};
  const firmWideSpend: Record<string, number> = {};

  for (const s of spend) {
    const pa = s.practiceArea || "_firm_wide";
    if (!spendByPA[pa]) spendByPA[pa] = { total: 0, bySrc: {} };
    const amt = Number(s.amount);
    spendByPA[pa].total += amt;
    spendByPA[pa].bySrc[s.source] = (spendByPA[pa].bySrc[s.source] || 0) + amt;
    if (!s.practiceArea) firmWideSpend[s.source] = (firmWideSpend[s.source] || 0) + amt;
  }

  // Group matters by practice area
  const mattersByPA: Record<string, typeof newMatters> = {};
  for (const m of newMatters) {
    const pa = m.practiceArea || "General";
    if (!mattersByPA[pa]) mattersByPA[pa] = [];
    mattersByPA[pa].push(m);
  }

  // Compute CAC per practice area
  const allPAs = new Set([...Object.keys(spendByPA).filter((k) => k !== "_firm_wide"), ...Object.keys(mattersByPA)]);
  const results: any[] = [];

  for (const pa of Array.from(allPAs)) {
    const paSpend = (spendByPA[pa]?.total || 0) + (spendByPA._firm_wide?.total || 0) * (mattersByPA[pa]?.length || 0) / Math.max(newMatters.length, 1);
    const clientCount = mattersByPA[pa]?.length || 0;
    const cac = clientCount > 0 ? paSpend / clientCount : null;

    // Avg revenue per matter (from invoices)
    const paMatters = mattersByPA[pa] || [];
    const totalRevenue = paMatters.reduce((sum, m) => {
      return sum + m.invoices.reduce((is, inv) => is + Number(inv.total), 0);
    }, 0);
    const avgRevenue = paMatters.length > 0 ? totalRevenue / paMatters.length : 0;
    const ltvToCac = cac && cac > 0 ? avgRevenue / cac : null;

    // Save snapshot
    await db.cACSnapshot.upsert({
      where: { firmId_period_practiceArea: { firmId, period, practiceArea: pa } },
      create: { firmId, period, practiceArea: pa, totalSpend: paSpend, newClients: clientCount, cac, avgMatterRevenue: avgRevenue, ltvToCacRatio: ltvToCac },
      update: { totalSpend: paSpend, newClients: clientCount, cac, avgMatterRevenue: avgRevenue, ltvToCacRatio: ltvToCac, computedAt: new Date() },
    });

    results.push({ practiceArea: pa, totalSpend: paSpend, newClients: clientCount, cac, avgMatterRevenue: avgRevenue, ltvToCacRatio: ltvToCac });
  }

  // Firm-wide snapshot
  const totalFirmSpend = spend.reduce((s, x) => s + Number(x.amount), 0);
  const firmCac = newMatters.length > 0 ? totalFirmSpend / newMatters.length : null;
  const firmAvgRev = newMatters.length > 0 ? newMatters.reduce((s, m) => s + m.invoices.reduce((is, inv) => is + Number(inv.total), 0), 0) / newMatters.length : 0;

  await db.cACSnapshot.upsert({
    where: { firmId_period_practiceArea: { firmId, period, practiceArea: "" } },
    create: { firmId, period, practiceArea: null, totalSpend: totalFirmSpend, newClients: newMatters.length, cac: firmCac, avgMatterRevenue: firmAvgRev, ltvToCacRatio: firmCac && firmCac > 0 ? firmAvgRev / firmCac : null },
    update: { totalSpend: totalFirmSpend, newClients: newMatters.length, cac: firmCac, avgMatterRevenue: firmAvgRev, computedAt: new Date() },
  });

  return results;
}

export async function getCACTrend(firmId: string, months: number = 6): Promise<any[]> {
  return db.cACSnapshot.findMany({
    where: { firmId, practiceArea: null },
    orderBy: { period: "desc" },
    take: months,
  });
}

export async function getSourceBreakdown(firmId: string, period: string): Promise<any[]> {
  const spend = await db.marketingSpend.findMany({
    where: { period, OR: [{ firmId }, { firmId: null }] },
  });

  const [year, month] = period.split("-").map(Number);
  const periodStart = new Date(year, month - 1, 1);
  const periodEnd = new Date(year, month, 0, 23, 59, 59);

  const matters = await db.matter.findMany({
    where: { openDate: { gte: periodStart, lte: periodEnd }, intakeSource: { not: null } },
    include: { invoices: true },
  });

  // Group by source
  const sources: Record<string, { spend: number; clients: number; revenue: number }> = {};

  for (const s of spend) {
    if (!sources[s.source]) sources[s.source] = { spend: 0, clients: 0, revenue: 0 };
    sources[s.source].spend += Number(s.amount);
  }

  for (const m of matters) {
    const src = m.intakeSource || "unknown";
    if (!sources[src]) sources[src] = { spend: 0, clients: 0, revenue: 0 };
    sources[src].clients += 1;
    sources[src].revenue += m.invoices.reduce((s, inv) => s + Number(inv.total), 0);
  }

  return Object.entries(sources).map(([source, data]) => ({
    source,
    ...data,
    cac: data.clients > 0 ? data.spend / data.clients : null,
    revenuePerClient: data.clients > 0 ? data.revenue / data.clients : 0,
  })).sort((a, b) => (a.cac || 999999) - (b.cac || 999999));
}
