import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as kpiEngine from "@/lib/kpi-engine";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results: string[] = [];
    const now = new Date();
    const period = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;

    const dashboards = await db.practiceKPIDashboard.findMany({ where: { isActive: true } });
    for (const dashboard of dashboards) {
      const snapshots = await kpiEngine.calculateAllKPIs(dashboard.id, period, "MONTHLY");
      results.push(`${dashboard.name}: ${snapshots.length} KPIs calculated`);
    }

    return NextResponse.json({ success: true, results, timestamp: now.toISOString() });
  } catch (error: any) {
    console.error("[KPI Calculator] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
