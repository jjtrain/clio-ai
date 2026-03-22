import { NextRequest, NextResponse } from "next/server";
import * as pushEngine from "@/lib/push-engine";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const alerts = await pushEngine.checkAllAlerts();
    const cleaned = await pushEngine.cleanupOldNotifications();
    return NextResponse.json({ success: true, alerts, cleaned, timestamp: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
