import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as engine from "@/lib/financial-insights-engine";
import * as pwc from "@/lib/integrations/pwc-insights";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, any> = {};
  const now = new Date();
  const period = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;

  try {
    // 1. Generate current month snapshot
    results.snapshot = await engine.generateSnapshot(period, "MONTHLY");

    // 2. Run financial alert checks
    results.alerts = await engine.checkFinancialAlerts();

    // 3. Evaluate budgets
    results.budgets = await engine.evaluateBudgets();

    // 4. Calculate profitability
    results.profitability = await engine.calculateAllProfitability(period);

    // 5. If PwC enabled, push data
    const pwcConfig = await db.finInsightsIntegration.findUnique({ where: { provider: "PWC_INSIGHTS" } });
    if (pwcConfig?.isEnabled) {
      try {
        const payments = await db.payment.findMany({ where: { paymentDate: { gte: new Date(period + "-01") } }, include: { invoice: true } });
        const revenue = payments.reduce((s, p) => s + Number(p.amount), 0);
        const expenses = await db.expense.findMany({ where: { date: { gte: new Date(period + "-01") } } });
        const invoices = await db.invoice.findMany({ where: { createdAt: { gte: new Date(period + "-01") } } });
        const timeEntries = await db.timeEntry.findMany({ where: { date: { gte: new Date(period + "-01") } } });
        const trustAccounts = await db.trustAccount.findMany();

        results.pwcSync = await pwc.pushFinancialData({
          period,
          revenue,
          expenses: expenses.map((e) => ({ category: e.category, amount: Number(e.amount) })),
          invoices: invoices.map((i) => ({ id: i.id, amount: Number(i.total), paidAmount: Number(i.amountPaid || 0), dueDate: i.dueDate.toISOString(), status: i.status })),
          timeEntries: timeEntries.map((t) => ({ hours: Number(t.duration) / 60, billingRate: Number(t.rate || 0), matterId: t.matterId, billed: t.invoiceLineItemId != null })),
          trustBalances: trustAccounts.map((t) => ({ account: t.name, balance: Number(t.bankBalance) })),
        });
      } catch (err: any) {
        results.pwcSync = { error: err.message };
      }
    }

    // 6. Check Rainmaker diagnostics
    const rmConfig = await db.finInsightsIntegration.findUnique({ where: { provider: "RAINMAKER" } });
    if (rmConfig?.isEnabled) {
      const pending = await db.rainmakerDiagnostic.findMany({ where: { status: "PENDING" } });
      results.rainmakerPending = pending.length;
    }

    // 7. Generate forecasts if needed
    const existingForecast = await db.financialForecast.findFirst({
      where: { forecastType: "REVENUE", createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
    });
    if (!existingForecast) {
      try {
        results.forecast = await engine.generateForecast("REVENUE", 6, "MONTHLY");
      } catch (err: any) {
        results.forecast = { error: err.message };
      }
    }

    return NextResponse.json({ success: true, period, results });
  } catch (err: any) {
    console.error("[Financial Insights Cron] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
