import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Count today's events
    const todayLogs = await db.auditLog.findMany({ where: { timestamp: { gte: todayStart } } });
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const byUser: Record<string, number> = {};
    for (const log of todayLogs) {
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;
      bySeverity[log.severity] = (bySeverity[log.severity] || 0) + 1;
      if (log.userId) byUser[log.userId] = (byUser[log.userId] || 0) + 1;
    }

    // Critical events not reviewed
    const criticalEvents = todayLogs.filter(l => l.severity === "SEC_CRITICAL" || l.severity === "SEC_ERROR");

    // Failed login spikes
    const failedLogins = todayLogs.filter(l => l.action === "LOGIN_FAILED");

    const snapshot = {
      date: todayStart.toISOString(),
      totalEvents: todayLogs.length,
      byCategory,
      bySeverity,
      topUsers: Object.entries(byUser).sort(([, a], [, b]) => b - a).slice(0, 10),
      criticalEvents: criticalEvents.length,
      failedLogins: failedLogins.length,
    };

    return NextResponse.json({ success: true, snapshot });
  } catch (error: any) {
    console.error("[Audit Snapshot] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
