import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export async function computePeriod(firmId: string, period: string, periodType: string, startDate: Date, endDate: Date): Promise<any> {
  const profPeriod = await db.profitabilityPeriod.upsert({
    where: { firmId_period_periodType: { firmId, period, periodType } },
    create: { firmId, period, periodType, startDate, endDate, status: "computing" },
    update: { status: "computing" },
  });

  // Get all matters with time entries in this period
  const matters = await db.matter.findMany({ where: { status: { not: "CLOSED" } }, select: { id: true, practiceArea: true } });
  const paMap: Record<string, { matters: string[]; hours: number; billed: number; collected: number }> = {};

  for (const m of matters) {
    const pa = m.practiceArea || "General";
    if (!paMap[pa]) paMap[pa] = { matters: [], hours: 0, billed: 0, collected: 0 };
    paMap[pa].matters.push(m.id);

    const entries = await db.timeEntry.findMany({
      where: { matterId: m.id, date: { gte: startDate, lte: endDate } },
    });
    const hours = entries.reduce((s, e) => s + (e.hours || e.duration / 60), 0);
    const billed = entries.reduce((s, e) => s + ((e.hours || e.duration / 60) * Number(e.rate || 350)), 0);
    paMap[pa].hours += hours;
    paMap[pa].billed += billed;
  }

  // Load overhead
  const overhead = await db.overheadConfig.findUnique({ where: { firmId } });
  const totalOverhead = overhead?.totalMonthly || 40000;
  const months = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (30 * 86400000)));
  const periodOverhead = totalOverhead * months;
  const totalRevenue = Object.values(paMap).reduce((s, p) => s + p.billed, 0);

  // Compute per-PA
  for (const [pa, data] of Object.entries(paMap)) {
    const revenueShare = totalRevenue > 0 ? data.billed / totalRevenue : 1 / Object.keys(paMap).length;
    const allocated = periodOverhead * revenueShare;
    const laborCost = data.hours * 150; // simplified: $150/hr cost rate
    const grossProfit = data.billed - laborCost;
    const netProfit = data.billed - laborCost - allocated;
    const grossMargin = data.billed > 0 ? grossProfit / data.billed : 0;
    const netMargin = data.billed > 0 ? netProfit / data.billed : 0;

    await db.profitabilityByPA.create({
      data: {
        periodId: profPeriod.id, firmId, practiceArea: pa,
        grossBilled: data.billed, realizedRevenue: data.billed * 0.92, collected: data.billed * 0.88,
        uncollected: data.billed * 0.12, realizationRate: 0.92, collectionRate: 0.88,
        billingRate: data.hours > 0 ? data.billed / data.hours : 0,
        effectiveRate: data.hours > 0 ? (data.billed * 0.88) / data.hours : 0,
        matterCount: data.matters.length, activeMatterCount: data.matters.length,
        totalHours: data.hours, billableHours: data.hours,
        directLaborCost: laborCost, overheadAllocated: allocated, totalCost: laborCost + allocated,
        grossProfit, grossMargin: Math.round(grossMargin * 1000) / 10,
        netProfit, netMargin: Math.round(netMargin * 1000) / 10,
      },
    });
  }

  // AI summary
  let aiSummary = "";
  try {
    const anthropic = new Anthropic();
    const paData = Object.entries(paMap).map(([pa, d]) => `${pa}: $${Math.round(d.billed)} revenue, ${Math.round(d.hours)}h`).join("; ");
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514", max_tokens: 256,
      system: "Write a 2-3 sentence executive summary of practice area profitability for a law firm managing partner. Be specific with numbers and actionable.",
      messages: [{ role: "user", content: `Period: ${period}. Practice areas: ${paData}. Total overhead: $${periodOverhead}.` }],
    });
    aiSummary = resp.content[0]?.type === "text" ? resp.content[0].text : "";
  } catch {}

  await db.profitabilityPeriod.update({ where: { id: profPeriod.id }, data: { status: "computed", computedAt: new Date(), aiSummary } });
  return profPeriod;
}

export async function computeScenario(scenarioId: string): Promise<any> {
  const scenario = await db.profitabilityScenario.findUnique({ where: { id: scenarioId } });
  if (!scenario) throw new Error("Scenario not found");

  const baseline = await db.profitabilityPeriod.findFirst({
    where: { firmId: scenario.firmId, period: scenario.baselinePeriod },
    include: { practiceAreas: true },
  });
  if (!baseline) throw new Error("Baseline period not found");

  const assumptions = scenario.assumptions as any[];
  const results: Record<string, any> = {};
  let totalBaseline = 0, totalScenario = 0;

  for (const pa of baseline.practiceAreas) {
    const paAssumptions = assumptions.filter((a: any) => !a.practiceArea || a.practiceArea === pa.practiceArea);
    let adjustedRevenue = pa.collected;
    let adjustedCost = pa.totalCost;

    for (const a of paAssumptions) {
      if (a.metric === "Avg Billing Rate" && a.changeType === "Increase by %") {
        adjustedRevenue *= (1 + a.changeValue / 100);
      }
      if (a.metric === "Matter Volume" && a.changeType === "Increase by %") {
        adjustedRevenue *= (1 + a.changeValue / 100);
        adjustedCost *= (1 + a.changeValue / 100 * 0.6); // costs don't scale linearly
      }
      if (a.metric === "Collection Rate" && a.changeType === "Set to value") {
        adjustedRevenue = pa.grossBilled * (a.changeValue / 100);
      }
    }

    const netProfit = adjustedRevenue - adjustedCost;
    results[pa.practiceArea] = { baseRevenue: pa.collected, scenarioRevenue: adjustedRevenue, baseCost: pa.totalCost, scenarioCost: adjustedCost, baseNet: pa.netProfit, scenarioNet: netProfit };
    totalBaseline += pa.netProfit;
    totalScenario += netProfit;
  }

  const comparedToBase = { baselineTotal: totalBaseline, scenarioTotal: totalScenario, delta: totalScenario - totalBaseline, deltaPct: totalBaseline > 0 ? ((totalScenario - totalBaseline) / totalBaseline) * 100 : 0 };

  await db.profitabilityScenario.update({ where: { id: scenarioId }, data: { results, comparedToBase } });
  return { results, comparedToBase };
}
