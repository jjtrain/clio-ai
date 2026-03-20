import { NextRequest, NextResponse } from "next/server";
import * as solEngine from "@/lib/sol-engine";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results: string[] = [];

    // Update all days remaining and urgency levels
    const updated = await solEngine.bulkUpdateDaysRemaining();
    results.push(`Updated ${updated} SOL records`);

    // Check and send due alerts
    const alertResult = await solEngine.checkAlerts();
    results.push(`Alerts: ${alertResult.alertsCreated} created, ${alertResult.checked} checked`);

    // Generate daily digest
    const digest = await solEngine.generateDailyDigest();
    results.push(`Daily digest generated`);

    return NextResponse.json({ success: true, results, timestamp: new Date().toISOString() });
  } catch (error: any) {
    console.error("[SOL Tracker Cron] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
