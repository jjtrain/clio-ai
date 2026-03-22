import { NextRequest, NextResponse } from "next/server";
import * as signEngine from "@/lib/mobile-sign-engine";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const expired = await signEngine.expireStaleRequests();
    const reminders = await signEngine.checkAutoReminders();
    return NextResponse.json({ success: true, expired, reminders, timestamp: new Date().toISOString() });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
