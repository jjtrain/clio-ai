import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const results: string[] = [];

    // Reset monthly spend on 1st of month
    if (now.getDate() === 1) {
      await db.aIIntegration.updateMany({ data: { currentMonthSpend: 0 } });
      results.push("Reset monthly spend counters");
    }

    // Check budget utilization
    const configs = await db.aIIntegration.findMany();
    for (const config of configs) {
      const cap = Number(config.monthlyBudgetCap || 0);
      const spend = Number(config.currentMonthSpend || 0);
      if (cap > 0 && spend > cap * 0.8) {
        results.push(`WARNING: ${config.provider} spend at ${((spend / cap) * 100).toFixed(0)}% of budget`);
      }
    }

    // Clean up old search cache (>30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const deleted = await db.semanticSearchResult.deleteMany({ where: { createdAt: { lt: thirtyDaysAgo } } });
    results.push(`Cleaned ${deleted.count} old search cache entries`);

    // Calculate daily usage snapshot
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayLogs = await db.aIUsageLog.count({ where: { createdAt: { gte: todayStart } } });
    results.push(`Today's AI requests: ${todayLogs}`);

    return NextResponse.json({ success: true, results, timestamp: now.toISOString() });
  } catch (error: any) {
    console.error("[AI Maintenance] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
