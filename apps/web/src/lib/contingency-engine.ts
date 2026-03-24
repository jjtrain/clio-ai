import { db } from "@/lib/db";

export function calculateSettlementScenario(params: {
  settlementAmount: number; feePercentage: number; feeBase: string;
  expenses: number; liens: number; totalHours: number; blendedRate: number;
  feeSplitOurPercentage?: number;
}): { feeAmount: number; firmNet: number; clientNet: number; effectiveHourlyRate: number; roi: number; breakEven: number } {
  const { settlementAmount, feePercentage, feeBase, expenses, liens, totalHours, blendedRate, feeSplitOurPercentage } = params;

  let feeAmount: number;
  if (feeBase === "net_after_expenses") {
    feeAmount = (settlementAmount - expenses) * (feePercentage / 100);
  } else {
    feeAmount = settlementAmount * (feePercentage / 100);
  }

  const firmNet = feeSplitOurPercentage ? feeAmount * (feeSplitOurPercentage / 100) : feeAmount;
  const clientNet = settlementAmount - feeAmount - expenses - liens;
  const effectiveHourlyRate = totalHours > 0 ? firmNet / totalHours : 0;
  const roi = expenses > 0 ? ((firmNet - expenses) / expenses) * 100 : 0;
  const breakEven = feePercentage > 0 ? expenses / (feePercentage / 100) : 0;

  return { feeAmount, firmNet, clientNet, effectiveHourlyRate: Math.round(effectiveHourlyRate), roi: Math.round(roi), breakEven: Math.round(breakEven) };
}

export async function getCaseFinancialSummary(matterId: string) {
  const ccase = await db.contingencyCase.findUnique({
    where: { matterId },
    include: { expenses: true, liens: true, damages: true, negotiations: { orderBy: { date: "desc" } }, scenarios: true, providers: true, policies: true, budgetItems: true },
  });
  if (!ccase) return null;

  const totalExpenses = ccase.expenses.reduce((s, e) => s + e.amount, 0);
  const totalLiensOriginal = ccase.liens.reduce((s, l) => s + l.originalAmount, 0);
  const totalLiensNegotiated = ccase.liens.reduce((s, l) => s + (l.negotiatedAmount || l.originalAmount), 0);
  const totalSpecials = ccase.medicalSpecials + ccase.lostWages + ccase.propertyDamage;
  const budgetRemaining = ccase.totalExpensesBudgeted - totalExpenses;
  const totalCoverage = ccase.policies.reduce((s, p) => s + p.policyLimits, 0);

  // Damages range
  const damagesLow = ccase.damages.reduce((s, d) => s + (d.amountActual || d.amountLow || 0), 0);
  const damagesHigh = ccase.damages.reduce((s, d) => s + (d.amountActual || d.amountHigh || 0), 0);
  const damagesMid = ccase.damages.reduce((s, d) => s + (d.amountActual || d.amountMidpoint || ((d.amountLow || 0) + (d.amountHigh || 0)) / 2), 0);

  return {
    ...ccase,
    totalExpenses,
    totalLiensOriginal,
    totalLiensNegotiated,
    lienSavings: totalLiensOriginal - totalLiensNegotiated,
    totalSpecials,
    budgetRemaining,
    totalCoverage,
    damagesRange: { low: damagesLow, midpoint: damagesMid, high: damagesHigh },
  };
}

export async function getPortfolioStats(firmId: string) {
  const cases = await db.contingencyCase.findMany({
    where: { firmId },
    include: { expenses: true, liens: true },
  });

  const active = cases.filter((c) => c.status === "active");
  const settled = cases.filter((c) => c.status === "settled");
  const totalExpensesAdvanced = cases.reduce((s, c) => s + c.expenses.reduce((es, e) => es + e.amount, 0), 0);
  const totalRecovered = settled.reduce((s, c) => s + (c.settledAmount || 0), 0);
  const totalFees = settled.reduce((s, c) => s + ((c.settledAmount || 0) * c.effectiveFeePercentage / 100), 0);
  const avgROI = totalExpensesAdvanced > 0 ? ((totalFees - totalExpensesAdvanced) / totalExpensesAdvanced) * 100 : 0;

  return {
    totalCases: cases.length,
    activeCases: active.length,
    settledCases: settled.length,
    totalExpensesAdvanced,
    totalRecovered,
    totalFees,
    avgROI: Math.round(avgROI),
    totalPolicyLimitsExposure: active.reduce((s, c) => s + (c.insurancePolicyLimits || 0), 0),
  };
}
