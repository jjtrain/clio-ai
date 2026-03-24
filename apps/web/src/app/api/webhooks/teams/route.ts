import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Teams change notification validation
    if (req.nextUrl.searchParams.has("validationToken")) {
      return new NextResponse(req.nextUrl.searchParams.get("validationToken"), { headers: { "Content-Type": "text/plain" } });
    }

    const notifications = body.value || [];
    for (const notification of notifications) {
      const meetingId = notification.resourceData?.id;
      if (!meetingId) continue;

      const meeting = await db.meetingEvent.findFirst({ where: { externalMeetingId: meetingId } });
      if (!meeting) continue;

      // Handle status changes
      if (notification.changeType === "updated") {
        // Teams doesn't provide granular meeting lifecycle events like Zoom,
        // but we can detect start/end from subscription notifications
        console.log(`[Teams Webhook] Meeting ${meetingId} updated`);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Teams Webhook] Error:", err);
    return NextResponse.json({ ok: true });
  }
}
