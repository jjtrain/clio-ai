import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

function getPeriodDates(period: string, periodType: "MONTHLY" | "QUARTERLY" | "ANNUAL") {
  if (periodType === "MONTHLY") {
    const [y, m] = period.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0, 23, 59, 59, 999);
    return { start, end };
  }
  if (periodType === "QUARTERLY") {
    const match = period.match(/(\d{4})-Q(\d)/);
    if (!match) throw new Error("Invalid quarter format");
    const y = parseInt(match[1]), q = parseInt(match[2]);
    const start = new Date(y, (q - 1) * 3, 1);
    const end = new Date(y, q * 3, 0, 23, 59, 59, 999);
    return { start, end };
  }
  const y = parseInt(period);
  return { start: new Date(y, 0, 1), end: new Date(y, 11, 31, 23, 59, 59, 999) };
}

export async function generateSnapshot(period: string, periodType: "MONTHLY" | "QUARTERLY" | "ANNUAL") {
  const { start, end } = getPeriodDates(period, periodType);

  // Revenue: sum paid invoices
  const paidInvoices = await db.invoice.findMany({
    where: { status: "PAID", updatedAt: { gte: start, lte: end } },
    include: { matter: { include: { client: true } } },
  });
  const payments = await db.payment.findMany({
    where: { paymentDate: { gte: start, lte: end } },
    include: { invoice: { include: { matter: true } } },
  });
  const revenue = payments.reduce((s, p) => s + Number(p.amount), 0);

  // Revenue by practice area
  const revByPA: Record<string, number> = {};
  const revByAtty: Record<string, number> = {};
  const revByType: Record<string, number> = {};
  for (const p of payments) {
    const pa = p.invoice?.matter?.practiceArea || "Unknown";
    revByPA[pa] = (revByPA[pa] || 0) + Number(p.amount);
    const atty = p.invoice?.matter?.practiceArea || "General";
    revByAtty[atty] = (revByAtty[atty] || 0) + Number(p.amount);
    const ft = "HOURLY";
    revByType[ft] = (revByType[ft] || 0) + Number(p.amount);
  }

  // Expenses
  const expenseRecords = await db.expense.findMany({ where: { date: { gte: start, lte: end } } });
  const expenses = expenseRecords.reduce((s, e) => s + Number(e.amount), 0);
  const expByCat: Record<string, number> = {};
  for (const e of expenseRecords) { expByCat[e.category] = (expByCat[e.category] || 0) + Number(e.amount); }

  const netIncome = revenue - expenses;
  const profitMargin = revenue > 0 ? netIncome / revenue : 0;

  // AR
  const unpaidInvoices = await db.invoice.findMany({ where: { status: { in: ["SENT", "OVERDUE"] } } });
  const ar = unpaidInvoices.reduce((s, i) => s + Number(i.total) - Number(i.amountPaid || 0), 0);
  const now = new Date();
  const arBuckets: Record<string, number> = { current: 0, "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const inv of unpaidInvoices) {
    const days = Math.floor((now.getTime() - new Date(inv.dueDate).getTime()) / 86400000);
    const bal = Number(inv.total) - Number(inv.amountPaid || 0);
    if (days <= 0) arBuckets["current"] += bal;
    else if (days <= 30) arBuckets["1-30"] += bal;
    else if (days <= 60) arBuckets["31-60"] += bal;
    else if (days <= 90) arBuckets["61-90"] += bal;
    else arBuckets["90+"] += bal;
  }

  // Time entries (duration is in minutes, convert to hours)
  const timeEntries = await db.timeEntry.findMany({ where: { date: { gte: start, lte: end } } });
  const totalHoursWorked = timeEntries.reduce((s, t) => s + Number(t.duration) / 60, 0);
  const billableEntries = timeEntries.filter((t) => t.billable);
  const billableHours = billableEntries.reduce((s, t) => s + Number(t.duration) / 60, 0);
  const billedEntries = timeEntries.filter((t) => t.invoiceLineItemId != null);
  const totalHoursBilled = billedEntries.reduce((s, t) => s + Number(t.duration) / 60, 0);
  const workedValue = billableEntries.reduce((s, t) => s + (Number(t.duration) / 60) * Number(t.rate || 0), 0);
  const billedValue = billedEntries.reduce((s, t) => s + (Number(t.duration) / 60) * Number(t.rate || 0), 0);

  // WIP
  const unbilledEntries = await db.timeEntry.findMany({ where: { billable: true, invoiceLineItemId: null } });
  const wip = unbilledEntries.reduce((s, t) => s + (Number(t.duration) / 60) * Number(t.rate || 0), 0);

  // Rates
  const sentInvoiceTotal = paidInvoices.reduce((s, i) => s + Number(i.total), 0);
  const collectionRate = sentInvoiceTotal > 0 ? revenue / sentInvoiceTotal : 0;
  const realizationRate = workedValue > 0 ? billedValue / workedValue : 0;

  // Utilization: assume 8hr/day, 5 days/week
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  const workDays = Math.floor(diffDays * 5 / 7);
  const availableHours = workDays * 8;
  const utilizationRate = availableHours > 0 ? billableHours / availableHours : 0;

  const avgHourlyRate = totalHoursBilled > 0 ? billedValue / totalHoursBilled : 0;
  const effectiveHourlyRate = totalHoursWorked > 0 ? revenue / totalHoursWorked : 0;

  // Matters
  const newMatters = await db.matter.count({ where: { createdAt: { gte: start, lte: end } } });
  const closedMatters = await db.matter.count({ where: { status: "CLOSED", updatedAt: { gte: start, lte: end } } });
  const activeMatters = await db.matter.count({ where: { status: "OPEN" } });
  const newClients = await db.client.count({ where: { createdAt: { gte: start, lte: end } } });

  const snapshot = await db.financialSnapshot.upsert({
    where: { id: `snapshot-${period}-${periodType}` },
    create: {
      id: `snapshot-${period}-${periodType}`,
      period, periodType, periodStart: start, periodEnd: end,
      revenue, revenueByPracticeArea: JSON.stringify(Object.entries(revByPA).map(([k, v]) => ({ practiceArea: k, amount: v }))),
      revenueByAttorney: JSON.stringify(Object.entries(revByAtty).map(([k, v]) => ({ attorney: k, amount: v }))),
      revenueByBillingType: JSON.stringify(Object.entries(revByType).map(([k, v]) => ({ type: k, amount: v }))),
      expenses, expensesByCategory: JSON.stringify(Object.entries(expByCat).map(([k, v]) => ({ category: k, amount: v }))),
      netIncome, profitMargin, accountsReceivable: ar,
      accountsReceivableAging: JSON.stringify(Object.entries(arBuckets).map(([k, v]) => ({ bucket: k, amount: v }))),
      workInProgress: wip, collectionRate, realizationRate, utilizationRate,
      averageHourlyRate: avgHourlyRate, effectiveHourlyRate,
      totalHoursWorked, totalHoursBilled, totalHoursCollected: revenue > 0 ? revenue / (avgHourlyRate || 1) : 0,
      newMatters, closedMatters, activeMatters, newClients,
    },
    update: {
      revenue, revenueByPracticeArea: JSON.stringify(Object.entries(revByPA).map(([k, v]) => ({ practiceArea: k, amount: v }))),
      revenueByAttorney: JSON.stringify(Object.entries(revByAtty).map(([k, v]) => ({ attorney: k, amount: v }))),
      revenueByBillingType: JSON.stringify(Object.entries(revByType).map(([k, v]) => ({ type: k, amount: v }))),
      expenses, expensesByCategory: JSON.stringify(Object.entries(expByCat).map(([k, v]) => ({ category: k, amount: v }))),
      netIncome, profitMargin, accountsReceivable: ar,
      accountsReceivableAging: JSON.stringify(Object.entries(arBuckets).map(([k, v]) => ({ bucket: k, amount: v }))),
      workInProgress: wip, collectionRate, realizationRate, utilizationRate,
      averageHourlyRate: avgHourlyRate, effectiveHourlyRate,
      totalHoursWorked, totalHoursBilled, totalHoursCollected: revenue > 0 ? revenue / (avgHourlyRate || 1) : 0,
      newMatters, closedMatters, activeMatters, newClients,
    },
  });

  return snapshot;
}

export async function generateAllSnapshots(year: number) {
  const snapshots = [];
  for (let m = 1; m <= 12; m++) {
    const period = `${year}-${m.toString().padStart(2, "0")}`;
    snapshots.push(await generateSnapshot(period, "MONTHLY"));
  }
  for (let q = 1; q <= 4; q++) {
    snapshots.push(await generateSnapshot(`${year}-Q${q}`, "QUARTERLY"));
  }
  snapshots.push(await generateSnapshot(`${year}`, "ANNUAL"));
  return snapshots;
}

export async function calculateClientProfitability(clientId: string, period: string, periodType: "MONTHLY" | "QUARTERLY" | "ANNUAL") {
  const { start, end } = getPeriodDates(period, periodType);

  const clientPayments = await db.payment.findMany({
    where: { paymentDate: { gte: start, lte: end }, invoice: { matter: { clientId } } },
    include: { invoice: true },
  });
  const revenue = clientPayments.reduce((s, p) => s + Number(p.amount), 0);

  const timeEntries = await db.timeEntry.findMany({
    where: { date: { gte: start, lte: end }, matter: { clientId } },
  });
  const hoursWorked = timeEntries.reduce((s, t) => s + Number(t.duration) / 60, 0);
  const hoursBilled = timeEntries.filter((t) => t.invoiceLineItemId != null).reduce((s, t) => s + Number(t.duration) / 60, 0);
  const directCosts = timeEntries.reduce((s, t) => s + (Number(t.duration) / 60) * Number(t.rate || 0) * 0.4, 0);

  const clientExpenses = await db.expense.findMany({ where: { clientId, date: { gte: start, lte: end } } });
  const expenseTotal = clientExpenses.reduce((s, e) => s + Number(e.amount), 0);

  // Indirect costs: proportional overhead
  const totalRevenue = (await db.payment.aggregate({ where: { paymentDate: { gte: start, lte: end } }, _sum: { amount: true } }))._sum.amount || 0;
  const totalExpenses = (await db.expense.aggregate({ where: { date: { gte: start, lte: end } }, _sum: { amount: true } }))._sum.amount || 0;
  const overhead = Number(totalExpenses) * 0.3; // estimate 30% as overhead
  const indirectCosts = Number(totalRevenue) > 0 ? overhead * (revenue / Number(totalRevenue)) : 0;

  const grossProfit = revenue - directCosts - expenseTotal;
  const netProfit = grossProfit - indirectCosts;
  const profitMargin = revenue > 0 ? netProfit / revenue : 0;
  const workedValue = timeEntries.filter(t => t.billable).reduce((s, t) => s + (Number(t.duration) / 60) * Number(t.rate || 0), 0);
  const billedValue = timeEntries.filter(t => t.invoiceLineItemId != null).reduce((s, t) => s + (Number(t.duration) / 60) * Number(t.rate || 0), 0);
  const realizationRate = workedValue > 0 ? billedValue / workedValue : 0;

  const invoicesSent = await db.invoice.aggregate({ where: { matter: { clientId }, createdAt: { gte: start, lte: end } }, _sum: { total: true } });
  const collectionRate = Number(invoicesSent._sum.total || 0) > 0 ? revenue / Number(invoicesSent._sum.total) : 0;

  const segment = profitMargin > 0.4 ? "A" : profitMargin > 0.2 ? "B" : profitMargin > 0 ? "C" : "D";

  // Lifetime value
  const allRevenue = await db.payment.aggregate({ where: { invoice: { matter: { clientId } } }, _sum: { amount: true } });
  const lifetimeValue = Number(allRevenue._sum.amount || 0);

  const result = await db.clientProfitability.upsert({
    where: { id: `cp-${clientId}-${period}-${periodType}` },
    create: {
      id: `cp-${clientId}-${period}-${periodType}`, clientId, period, periodType,
      revenue, directCosts, expenses: expenseTotal, indirectCosts,
      grossProfit, netProfit, profitMargin, hoursWorked, hoursBilled,
      realizationRate, collectionRate, lifetimeValue, segment,
    },
    update: {
      revenue, directCosts, expenses: expenseTotal, indirectCosts,
      grossProfit, netProfit, profitMargin, hoursWorked, hoursBilled,
      realizationRate, collectionRate, lifetimeValue, segment,
    },
  });

  return result;
}

export async function calculateMatterProfitability(matterId: string) {
  const matter = await db.matter.findUniqueOrThrow({ where: { id: matterId }, include: { client: true } });

  const payments = await db.payment.findMany({ where: { invoice: { matterId } }, include: { invoice: true } });
  const totalRevenue = payments.reduce((s, p) => s + Number(p.amount), 0);

  const timeEntries = await db.timeEntry.findMany({ where: { matterId } });
  const hoursWorked = timeEntries.reduce((s, t) => s + Number(t.duration) / 60, 0);
  const hoursBilled = timeEntries.filter(t => t.invoiceLineItemId != null).reduce((s, t) => s + Number(t.duration) / 60, 0);
  const totalTimeCost = timeEntries.reduce((s, t) => s + (Number(t.duration) / 60) * Number(t.rate || 0) * 0.4, 0);

  const expenses = await db.expense.findMany({ where: { matterId } });
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const totalCosts = totalTimeCost + totalExpenses;
  const grossProfit = totalRevenue - totalCosts;
  const netProfit = grossProfit;
  const profitMargin = totalRevenue > 0 ? netProfit / totalRevenue : 0;

  const workedValue = timeEntries.filter(t => t.billable).reduce((s, t) => s + (Number(t.duration) / 60) * Number(t.rate || 0), 0);
  const billedValue = timeEntries.filter(t => t.invoiceLineItemId != null).reduce((s, t) => s + (Number(t.duration) / 60) * Number(t.rate || 0), 0);
  const realizationRate = workedValue > 0 ? billedValue / workedValue : 0;
  const invoiceTotal = (await db.invoice.aggregate({ where: { matterId }, _sum: { total: true } }))._sum.total || 0;
  const collectionRate = Number(invoiceTotal) > 0 ? totalRevenue / Number(invoiceTotal) : 0;

  const result = await db.matterProfitability.upsert({
    where: { matterId },
    create: {
      matterId, clientId: matter.clientId, practiceArea: matter.practiceArea, billingType: null,
      totalRevenue, totalTimeCost, totalExpenses, totalCosts, grossProfit, netProfit, profitMargin,
      hoursWorked, hoursBilled, realizationRate, collectionRate, lastCalculated: new Date(),
    },
    update: {
      totalRevenue, totalTimeCost, totalExpenses, totalCosts, grossProfit, netProfit, profitMargin,
      hoursWorked, hoursBilled, realizationRate, collectionRate, lastCalculated: new Date(),
    },
  });

  return result;
}

export async function calculateAllProfitability(period: string) {
  const periodType = period.includes("Q") ? "QUARTERLY" : period.length === 4 ? "ANNUAL" : "MONTHLY";
  const clients = await db.client.findMany({ where: { status: "ACTIVE" } });
  const clientResults = [];
  for (const c of clients) {
    clientResults.push(await calculateClientProfitability(c.id, period, periodType as any));
  }
  const matters = await db.matter.findMany({ where: { status: "OPEN" } });
  const matterResults = [];
  for (const m of matters) {
    matterResults.push(await calculateMatterProfitability(m.id));
  }
  return { clients: clientResults, matters: matterResults };
}

export async function generateForecast(forecastType: string, periods: number, granularity: "MONTHLY" | "QUARTERLY") {
  const snapshots = await db.financialSnapshot.findMany({
    where: { periodType: "MONTHLY" },
    orderBy: { periodStart: "desc" },
    take: 24,
  });

  if (snapshots.length < 3) {
    throw new Error("Need at least 3 months of historical data to generate forecasts");
  }

  const metricMap: Record<string, string> = {
    REVENUE: "revenue", EXPENSE: "expenses", CASH_FLOW: "operatingCashFlow",
    PROFITABILITY: "profitMargin", GROWTH: "revenue",
  };
  const metric = metricMap[forecastType] || "revenue";

  const historicalData = snapshots.reverse().map((s) => ({
    period: s.period,
    value: Number((s as any)[metric] || 0),
  }));

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: `You are a financial analyst for a law firm. Based on the following historical financial data, generate a ${forecastType} forecast for the next ${periods} ${granularity.toLowerCase()} periods. Consider seasonal trends, growth trajectory, and any anomalies in the data. Return ONLY a JSON object with: { "predictions": [{ "period": "YYYY-MM", "predicted": number, "lowerBound": number, "upperBound": number, "confidence": number }], "assumptions": "key assumptions", "methodology": "method used", "insights": "narrative explaining the forecast" }`,
    messages: [{ role: "user", content: `Historical data:\n${JSON.stringify(historicalData, null, 2)}` }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Failed to parse AI forecast response");
  const parsed = JSON.parse(jsonMatch[0]);

  const now = new Date();
  const endDate = new Date(now);
  endDate.setMonth(endDate.getMonth() + periods);

  const forecast = await db.financialForecast.create({
    data: {
      forecastType: forecastType as any,
      periodStart: now,
      periodEnd: endDate,
      granularity: granularity as any,
      predictions: JSON.stringify(parsed.predictions),
      assumptions: parsed.assumptions,
      methodology: parsed.methodology || "ai_analysis",
      aiInsights: parsed.insights,
    },
  });

  return forecast;
}

export async function checkFinancialAlerts() {
  const alerts: any[] = [];
  const now = new Date();
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

  const recentSnapshots = await db.financialSnapshot.findMany({
    where: { periodType: "MONTHLY", periodStart: { gte: threeMonthsAgo } },
    orderBy: { periodStart: "desc" },
    take: 4,
  });

  if (recentSnapshots.length >= 2) {
    const current = recentSnapshots[0];
    const avg3m = recentSnapshots.slice(1).reduce((s, snap) => s + Number(snap.revenue), 0) / Math.max(recentSnapshots.length - 1, 1);

    if (avg3m > 0 && Number(current.revenue) < avg3m * 0.6) {
      alerts.push({ alertType: "REVENUE_DECLINE", severity: "CRITICAL", title: "Critical Revenue Decline", description: `Current month revenue ($${Number(current.revenue).toFixed(0)}) is below 60% of the 3-month average ($${avg3m.toFixed(0)}).`, metric: "revenue", currentValue: Number(current.revenue), thresholdValue: avg3m * 0.6 });
    } else if (avg3m > 0 && Number(current.revenue) < avg3m * 0.8) {
      alerts.push({ alertType: "REVENUE_DECLINE", severity: "WARNING", title: "Revenue Decline Warning", description: `Current month revenue ($${Number(current.revenue).toFixed(0)}) is below 80% of the 3-month average ($${avg3m.toFixed(0)}).`, metric: "revenue", currentValue: Number(current.revenue), thresholdValue: avg3m * 0.8 });
    }

    // AR aging
    if (current.accountsReceivableAging) {
      const aging = JSON.parse(current.accountsReceivableAging as string);
      const total = aging.reduce((s: number, a: any) => s + a.amount, 0);
      const over90 = aging.find((a: any) => a.bucket === "90+")?.amount || 0;
      if (total > 0 && over90 / total > 0.3) {
        alerts.push({ alertType: "AR_AGING", severity: "WARNING", title: "Aging Receivables Alert", description: `${((over90 / total) * 100).toFixed(0)}% of AR ($${over90.toFixed(0)}) is over 90 days past due.`, metric: "ar_over_90", currentValue: over90, thresholdValue: total * 0.3 });
      }
    }

    // Utilization
    if (current.utilizationRate && Number(current.utilizationRate) < 0.4) {
      alerts.push({ alertType: "UTILIZATION_DROP", severity: "CRITICAL", title: "Critical Utilization Drop", description: `Utilization rate is ${(Number(current.utilizationRate) * 100).toFixed(0)}%, well below the 60% target.`, metric: "utilization", currentValue: Number(current.utilizationRate), thresholdValue: 0.4 });
    } else if (current.utilizationRate && Number(current.utilizationRate) < 0.6) {
      alerts.push({ alertType: "UTILIZATION_DROP", severity: "WARNING", title: "Low Utilization", description: `Utilization rate is ${(Number(current.utilizationRate) * 100).toFixed(0)}%, below the 60% target.`, metric: "utilization", currentValue: Number(current.utilizationRate), thresholdValue: 0.6 });
    }

    // Collection rate
    if (current.collectionRate && Number(current.collectionRate) < 0.7) {
      alerts.push({ alertType: "COLLECTION_RATE_DROP", severity: "CRITICAL", title: "Critical Collection Rate", description: `Collection rate dropped to ${(Number(current.collectionRate) * 100).toFixed(0)}%.`, metric: "collection_rate", currentValue: Number(current.collectionRate), thresholdValue: 0.7 });
    } else if (current.collectionRate && Number(current.collectionRate) < 0.85) {
      alerts.push({ alertType: "COLLECTION_RATE_DROP", severity: "WARNING", title: "Low Collection Rate", description: `Collection rate is ${(Number(current.collectionRate) * 100).toFixed(0)}%, below 85% target.`, metric: "collection_rate", currentValue: Number(current.collectionRate), thresholdValue: 0.85 });
    }

    // Realization
    if (current.realizationRate && Number(current.realizationRate) < 0.8) {
      alerts.push({ alertType: "REALIZATION_DECLINE", severity: "WARNING", title: "Low Realization Rate", description: `Realization rate is ${(Number(current.realizationRate) * 100).toFixed(0)}%, below 80% target.`, metric: "realization_rate", currentValue: Number(current.realizationRate), thresholdValue: 0.8 });
    }

    // WIP
    const monthlyRevAvg = avg3m;
    if (monthlyRevAvg > 0 && Number(current.workInProgress) > monthlyRevAvg * 2) {
      alerts.push({ alertType: "WIP_BUILDUP", severity: "WARNING", title: "WIP Buildup Warning", description: `Unbilled WIP ($${Number(current.workInProgress).toFixed(0)}) exceeds 2x monthly revenue.`, metric: "wip", currentValue: Number(current.workInProgress), thresholdValue: monthlyRevAvg * 2 });
    }

    // Client concentration
    if (current.revenueByAttorney) {
      const byClient = JSON.parse(current.revenueByPracticeArea as string || "[]");
      const totalRev = Number(current.revenue);
      for (const c of byClient) {
        if (totalRev > 0 && c.amount / totalRev > 0.3) {
          alerts.push({ alertType: "CLIENT_CONCENTRATION", severity: "WARNING", title: "Client Concentration Risk", description: `"${c.practiceArea}" represents ${((c.amount / totalRev) * 100).toFixed(0)}% of revenue.`, metric: "concentration", currentValue: c.amount, thresholdValue: totalRev * 0.3 });
          break;
        }
      }
    }
  }

  // Save alerts
  for (const alert of alerts) {
    await db.financialAlert.create({
      data: {
        alertType: alert.alertType,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        metric: alert.metric,
        currentValue: alert.currentValue,
        thresholdValue: alert.thresholdValue,
        recommendation: `Review ${alert.metric} trends and take corrective action.`,
      },
    });
  }

  return alerts;
}

export async function generateBenchmarkComparison(period: string) {
  const snapshot = await db.financialSnapshot.findFirst({ where: { period }, orderBy: { createdAt: "desc" } });
  if (!snapshot) throw new Error("No snapshot found for period: " + period);

  // Built-in benchmarks for solo/small law firms
  const benchmarks = [
    { metric: "Profit Margin", firmValue: Number(snapshot.profitMargin || 0) * 100, benchmarkValue: 35, unit: "%" },
    { metric: "Collection Rate", firmValue: Number(snapshot.collectionRate || 0) * 100, benchmarkValue: 90, unit: "%" },
    { metric: "Realization Rate", firmValue: Number(snapshot.realizationRate || 0) * 100, benchmarkValue: 88, unit: "%" },
    { metric: "Utilization Rate", firmValue: Number(snapshot.utilizationRate || 0) * 100, benchmarkValue: 65, unit: "%" },
    { metric: "AR Days Outstanding", firmValue: snapshot.averageDaysToCollect || 60, benchmarkValue: 52, unit: "days" },
  ];

  const comparison = benchmarks.map((b) => {
    const pctDiff = b.benchmarkValue > 0 ? ((b.firmValue - b.benchmarkValue) / b.benchmarkValue) * 100 : 0;
    const status = pctDiff >= 5 ? "above" : pctDiff >= -5 ? "at" : "below";
    const percentile = Math.min(99, Math.max(1, 50 + pctDiff * 2));
    return { ...b, percentile: Math.round(percentile), status };
  });

  await db.financialSnapshot.update({
    where: { id: snapshot.id },
    data: { benchmarkComparison: JSON.stringify(comparison) },
  });

  return comparison;
}

export async function generateExecutiveSummary(period: string) {
  const snapshot = await db.financialSnapshot.findFirst({ where: { period }, orderBy: { createdAt: "desc" } });
  if (!snapshot) throw new Error("No snapshot for period: " + period);

  const alerts = await db.financialAlert.findMany({ where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) }, isDismissed: false }, take: 10 });
  const forecasts = await db.financialForecast.findMany({ orderBy: { createdAt: "desc" }, take: 3 });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: `You are a CFO presenting a financial summary to the managing partner of a law firm. Based on this financial data, write a concise executive summary covering: key highlights (revenue, profitability, notable wins), areas of concern (declining metrics, rising costs, aging AR), opportunities (high-growth practice areas, profitable clients to expand), and specific recommended actions. Keep it to 500 words. Use a professional but direct tone — managing partners want actionable insights, not fluff. Use markdown formatting.`,
    messages: [{
      role: "user",
      content: `Financial Snapshot for ${period}:\n${JSON.stringify({
        revenue: Number(snapshot.revenue), expenses: Number(snapshot.expenses), netIncome: Number(snapshot.netIncome),
        profitMargin: Number(snapshot.profitMargin), collectionRate: Number(snapshot.collectionRate),
        realizationRate: Number(snapshot.realizationRate), utilizationRate: Number(snapshot.utilizationRate),
        ar: Number(snapshot.accountsReceivable), wip: Number(snapshot.workInProgress),
        newMatters: snapshot.newMatters, activeMatters: snapshot.activeMatters,
        revenueByPracticeArea: snapshot.revenueByPracticeArea,
      }, null, 2)}\n\nRecent Alerts: ${JSON.stringify(alerts.map(a => ({ type: a.alertType, severity: a.severity, title: a.title })))}\n\nForecasts: ${JSON.stringify(forecasts.map(f => ({ type: f.forecastType, insights: f.aiInsights?.slice(0, 200) })))}`,
    }],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

export async function generateClientAdvisory(clientId: string) {
  const client = await db.client.findUniqueOrThrow({ where: { id: clientId } });
  const matters = await db.matter.findMany({ where: { clientId }, take: 20 });
  const profitability = await db.clientProfitability.findFirst({ where: { clientId }, orderBy: { createdAt: "desc" } });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1500,
    system: `You are a business development advisor at a law firm. Generate a client advisory memo suggesting: business the firm should pitch to this client, risks the client should address, seasonal/regulatory upcoming needs. Use markdown. Be specific and actionable.`,
    messages: [{
      role: "user",
      content: `Client: ${client.name}\nMatters: ${JSON.stringify(matters.map(m => ({ name: m.name, practiceArea: m.practiceArea, status: m.status })))}\nProfitability: ${profitability ? JSON.stringify({ revenue: Number(profitability.revenue), margin: Number(profitability.profitMargin), segment: profitability.segment, ltv: Number(profitability.lifetimeValue) }) : "N/A"}`,
    }],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

export async function evaluateBudgets() {
  const budgets = await db.budgetTarget.findMany();
  const now = new Date();
  const results = [];

  for (const budget of budgets) {
    const { start, end } = getPeriodDates(budget.period, budget.periodType);
    const elapsed = Math.max(0, Math.min(1, (now.getTime() - start.getTime()) / (end.getTime() - start.getTime())));
    const proRatedTarget = Number(budget.targetAmount) * elapsed;

    let actual = 0;
    if (budget.targetType === "REVENUE") {
      actual = (await db.payment.aggregate({ where: { paymentDate: { gte: start, lte: end } }, _sum: { amount: true } }))._sum.amount as any || 0;
    } else if (budget.targetType === "EXPENSE") {
      actual = (await db.expense.aggregate({ where: { date: { gte: start, lte: end } }, _sum: { amount: true } }))._sum.amount as any || 0;
    } else if (budget.targetType === "HOURS") {
      actual = ((await db.timeEntry.aggregate({ where: { date: { gte: start, lte: end }, billable: true }, _sum: { duration: true } }))._sum.duration as any || 0) / 60;
    } else if (budget.targetType === "MATTERS") {
      actual = await db.matter.count({ where: { createdAt: { gte: start, lte: end } } });
    }

    actual = Number(actual);
    const variance = actual - Number(budget.targetAmount);
    const variancePercentage = Number(budget.targetAmount) > 0 ? variance / Number(budget.targetAmount) : 0;
    const pctOfProRated = proRatedTarget > 0 ? actual / proRatedTarget : 0;

    let status: string;
    if (actual >= Number(budget.targetAmount)) status = "EXCEEDED";
    else if (pctOfProRated >= 0.9) status = "ON_TRACK";
    else if (pctOfProRated >= 0.8) status = "AT_RISK";
    else status = "BEHIND";

    if (elapsed >= 1 && actual >= Number(budget.targetAmount)) status = "COMPLETED";

    const updated = await db.budgetTarget.update({
      where: { id: budget.id },
      data: { actualAmount: actual, variance, variancePercentage, status: status as any },
    });
    results.push(updated);
  }

  return results;
}

export async function getRevenueBySource() {
  const leads = await db.lead.findMany({ where: { status: "CONVERTED" }, include: { activities: true } });
  const bySource: Record<string, { count: number; revenue: number }> = {};

  for (const lead of leads) {
    const source = lead.source || "Direct";
    if (!bySource[source]) bySource[source] = { count: 0, revenue: 0 };
    bySource[source].count++;

    // Find converted client/matters
    const client = await db.client.findFirst({ where: { email: lead.email } });
    if (client) {
      const payments = await db.payment.aggregate({ where: { invoice: { matter: { clientId: client.id } } }, _sum: { amount: true } });
      bySource[source].revenue += Number(payments._sum.amount || 0);
    }
  }

  return Object.entries(bySource).map(([source, data]) => ({
    source, clients: data.count, revenue: data.revenue,
    avgRevenuePerClient: data.count > 0 ? data.revenue / data.count : 0,
  })).sort((a, b) => b.revenue - a.revenue);
}
