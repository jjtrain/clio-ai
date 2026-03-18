import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as tracers from "@/lib/integrations/tracers";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, any> = {};

  try {
    // 1. Check pending searches
    const pending = await db.investigationSearch.findMany({
      where: { status: { in: ["PENDING", "PROCESSING"] }, createdAt: { lt: new Date(Date.now() - 30 * 60000) } },
      take: 20,
    });
    results.pendingSearches = pending.length;

    // 2. Check expiring monitoring subscriptions
    const expiring = await db.monitoringSubscription.findMany({
      where: { isActive: true, expiresAt: { lte: new Date(Date.now() + 7 * 86400000) } },
    });
    results.expiringSubscriptions = expiring.length;

    // 3. Unacknowledged alerts >48h
    const staleAlerts = await db.monitoringAlert.count({
      where: { isRead: false, isDismissed: false, createdAt: { lt: new Date(Date.now() - 48 * 3600000) } },
    });
    results.staleAlerts = staleAlerts;

    // 4. Update credits balance
    try {
      const credits = await tracers.getCreditsBalance();
      if (credits.success) {
        await db.investigationsIntegration.update({
          where: { provider: "TRACERS" },
          data: { creditsRemaining: credits.data?.remaining, lastSyncAt: new Date() },
        }).catch(() => {});
      }
    } catch {}

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("[Investigations Cron] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
