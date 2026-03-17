import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as zoom from "@/lib/integrations/zoom";
import { processRecordingReady, summarizeMeeting } from "@/lib/zoom-meeting-engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = await db.videoIntegration.findUnique({ where: { provider: "ZOOM" } });
  if (!config?.isEnabled) {
    return NextResponse.json({ skipped: true, reason: "Zoom not enabled" });
  }

  const results: Record<string, any> = {};

  try {
    // 1. Sync upcoming meetings from Zoom
    const upcoming = await zoom.getUpcomingMeetings();
    if (upcoming.success && upcoming.data?.meetings) {
      let synced = 0;
      for (const m of upcoming.data.meetings) {
        const exists = await db.zoomMeeting.findFirst({ where: { zoomMeetingId: String(m.id) } });
        if (!exists) {
          await db.zoomMeeting.create({
            data: {
              zoomMeetingId: String(m.id), zoomUUID: m.uuid, hostEmail: m.host_email,
              topic: m.topic || "Zoom Meeting", startTime: new Date(m.start_time),
              scheduledDuration: m.duration || 30, joinUrl: m.join_url || "",
              meetingType: m.type === 1 ? "INSTANT" : m.type === 8 ? "RECURRING_FIXED" : "SCHEDULED",
            },
          });
          synced++;
        }
      }
      results.syncedUpcoming = synced;
    }

    // 2. Check for ended meetings needing processing
    const unprocessed = await db.zoomMeeting.findMany({
      where: {
        status: "ENDED",
        hasRecording: false,
        autoRecording: "CLOUD",
        endTime: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      take: 10,
    });
    let processed = 0;
    for (const m of unprocessed) {
      try {
        if (m.zoomUUID) {
          const recordings = await zoom.getRecordings(m.zoomUUID);
          if (recordings.success && recordings.data?.recording_files?.length > 0) {
            await processRecordingReady(m.id);
            processed++;
          }
        }
      } catch {}
    }
    results.recordingsProcessed = processed;

    // 3. Generate missing summaries
    const needsSummary = await db.zoomMeeting.findMany({
      where: { status: "ENDED", hasTranscript: true, aiSummary: null },
      take: 5,
    });
    let summarized = 0;
    for (const m of needsSummary) {
      try {
        await summarizeMeeting(m.id);
        summarized++;
      } catch {}
    }
    results.summariesGenerated = summarized;

    // 4. Clean up expired start URLs (older than 24h)
    await db.zoomMeeting.updateMany({
      where: { startUrl: { not: null }, startTime: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      data: { startUrl: null },
    });

    // 5. Refresh token if needed
    await zoom.getAccessToken();

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("[Zoom Sync Cron] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
