import { NextRequest, NextResponse } from "next/server";
import * as billEngine from "@/lib/billable-event-engine";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expired = await billEngine.expireStaleEvents();
    const reactivated = await billEngine.checkSnoozedEvents();
    const calendar = await billEngine.processCalendarEvents();

    return NextResponse.json({
      success: true,
      expired,
      reactivated,
      calendarEvents: calendar.created,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Swipe-to-Bill Cron] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
