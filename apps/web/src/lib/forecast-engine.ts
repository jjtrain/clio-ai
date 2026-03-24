import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export async function generateForecast(firmId: string, userId: string, periodType: string = "quarterly"): Promise<any> {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  const forecastPeriod = periodType === "quarterly" ? `${now.getFullYear()}-Q${quarter}` : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  // Gather data sources
  const assumptions = await db.forecastAssumption.findMany({ where: { firmId } });
  const assumptionMap: Record<string, number> = {};
  for (const a of assumptions) assumptionMap[a.name] = a.currentValue;

  const collectionRate = (assumptionMap["Hourly Collection Rate"] || 91) / 100;

  // Confirmed: scheduled payments
  const scheduledPayments = await db.scheduledPayment.findMany({
    where: { firmId, status: "scheduled", scheduledDate: { gte: now, lte: new Date(now.getTime() + 90 * 86400000) } },
    include: { plan: { select: { clientName: true, matterName: true } } },
  });

  // Confirmed: pending invoices
  const pendingInvoices = await db.generatedInvoice.findMany({
    where: { firmId, status: { in: ["sent", "finalized"] }, totalDue: { gt: 0 } },
  });

  // Build data points
  const dataPoints: any[] = [];
  let totalConfirmed = 0, totalProbable = 0, totalPossible = 0;

  for (const sp of scheduledPayments) {
    const month = `${sp.scheduledDate.getFullYear()}-${String(sp.scheduledDate.getMonth() + 1).padStart(2, "0")}`;
    const dp = { source: "scheduled_payment", matterId: sp.matterId, matterName: sp.plan?.matterName, clientName: sp.plan?.clientName, projectedMonth: month, amount: sp.amount, confidence: "confirmed", confidenceScore: 0.95, description: `Scheduled payment — $${sp.amount}`, firmId };
    dataPoints.push(dp);
    totalConfirmed += sp.amount;
  }

  for (const inv of pendingInvoices) {
    const adjusted = inv.totalDue * collectionRate;
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    dataPoints.push({ source: "pending_invoice", matterId: inv.matterId, matterName: inv.matterName, clientName: inv.clientName, practiceArea: inv.practiceArea, projectedMonth: month, amount: adjusted, confidence: "confirmed", confidenceScore: 0.85, description: `Invoice ${inv.invoiceNumber} — $${inv.totalDue} (${Math.round(collectionRate * 100)}% collection)`, firmId });
    totalConfirmed += adjusted;
  }

  // Probable: subscription/retainer recurring
  const subscriptionPlans = await db.autoPayPlan.findMany({
    where: { firmId, status: "active", planType: { in: ["retainer_replenishment"] }, autoPayEnabled: true },
  });
  for (const plan of subscriptionPlans) {
    for (let m = 0; m < 3; m++) {
      const date = new Date(now); date.setMonth(date.getMonth() + m);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      dataPoints.push({ source: "subscription_recurring", matterName: plan.matterName, clientName: plan.clientName, projectedMonth: month, amount: plan.installmentAmount, confidence: "probable", confidenceScore: 0.80, description: `Retainer replenishment — $${plan.installmentAmount}`, isRecurring: true, firmId });
      totalProbable += plan.installmentAmount;
    }
  }

  // Possible: contingency cases
  const contingencyCases = await db.contingencyCase.findMany({ where: { firmId, status: "active" } });
  for (const cc of contingencyCases) {
    const target = cc.settlementTarget as any;
    if (target?.midpoint) {
      const projectedFee = target.midpoint * (cc.effectiveFeePercentage / 100);
      dataPoints.push({ source: "contingency_expected", matterId: cc.matterId, matterName: cc.matterName, practiceArea: "personal_injury", projectedMonth: `${now.getFullYear()}-${String(now.getMonth() + 2).padStart(2, "0")}`, amount: projectedFee, confidence: cc.demandAmount ? "probable" : "possible", confidenceScore: cc.demandAmount ? 0.45 : 0.25, description: `Contingency fee — ${cc.matterName} — $${Math.round(projectedFee)}`, firmId });
      if (cc.demandAmount) totalProbable += projectedFee; else totalPossible += projectedFee;
    }
  }

  const totalProjected = totalConfirmed + totalProbable + totalPossible;

  // Generate AI insights
  let aiInsights = "";
  try {
    const anthropic = new Anthropic();
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514", max_tokens: 512,
      system: "You are a law firm financial analyst. Write a 3-4 sentence executive summary of this revenue forecast for the managing partner. Be specific with numbers and actionable.",
      messages: [{ role: "user", content: `Forecast: $${Math.round(totalProjected).toLocaleString()} (Confirmed: $${Math.round(totalConfirmed).toLocaleString()}, Probable: $${Math.round(totalProbable).toLocaleString()}, Possible: $${Math.round(totalPossible).toLocaleString()}). ${dataPoints.length} data points. ${contingencyCases.length} contingency cases active. ${scheduledPayments.length} scheduled payments.` }],
    });
    aiInsights = resp.content[0]?.type === "text" ? resp.content[0].text : "";
  } catch {}

  // Save forecast
  const forecast = await db.revenueForecast.create({
    data: {
      forecastPeriod, periodType, totalProjectedRevenue: totalProjected,
      totalProjectedLow: totalConfirmed, totalProjectedHigh: totalProjected * 1.3,
      totalConfirmed, totalProbable, totalPossible,
      aiInsights, userId, firmId,
      dataPoints: { create: dataPoints },
    },
  });

  return forecast;
}

export async function getLatestForecast(firmId: string) {
  return db.revenueForecast.findFirst({
    where: { firmId },
    orderBy: { generatedAt: "desc" },
    include: { dataPoints: { orderBy: [{ confidence: "asc" }, { amount: "desc" }] } },
  });
}

export async function getGoalProgress(firmId: string) {
  return db.revenueGoal.findMany({
    where: { firmId },
    orderBy: [{ period: "desc" }, { practiceArea: "asc" }],
  });
}
