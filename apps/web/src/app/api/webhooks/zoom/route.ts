import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";

const ZOOM_WEBHOOK_SECRET = process.env.ZOOM_WEBHOOK_SECRET || "";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Zoom URL validation challenge
    if (body.event === "endpoint.url_validation") {
      const crypto = require("crypto");
      const hashForValidate = crypto.createHmac("sha256", ZOOM_WEBHOOK_SECRET).update(body.payload.plainToken).digest("hex");
      return NextResponse.json({ plainToken: body.payload.plainToken, encryptedToken: hashForValidate });
    }

    const event = body.event;
    const payload = body.payload?.object;
    if (!payload?.id) return NextResponse.json({ ok: true });

    const meetingId = String(payload.id);
    const meeting = await db.meetingEvent.findFirst({ where: { externalMeetingId: meetingId } });
    if (!meeting) return NextResponse.json({ ok: true });

    switch (event) {
      case "meeting.started":
        await db.meetingEvent.update({ where: { id: meeting.id }, data: { status: "IN_PROGRESS", startedAt: new Date() } });
        break;

      case "meeting.ended": {
        const endedAt = new Date();
        const actualMins = meeting.startedAt
          ? Math.round((endedAt.getTime() - meeting.startedAt.getTime()) / 60000)
          : meeting.durationMinutes;

        await db.meetingEvent.update({
          where: { id: meeting.id },
          data: { status: "COMPLETED", endedAt, actualDurationMins: actualMins },
        });

        // Update linked time entry with actual duration
        if (meeting.timeEntryId) {
          await db.timeEntry.update({
            where: { id: meeting.timeEntryId },
            data: { duration: actualMins },
          });
        }
        break;
      }

      case "recording.completed":
        if (payload.recording_files?.length > 0) {
          const cloudFile = payload.recording_files.find((f: any) => f.recording_type === "shared_screen_with_speaker_view") || payload.recording_files[0];
          if (cloudFile) {
            await db.meetingEvent.update({
              where: { id: meeting.id },
              data: {
                recordingUrl: cloudFile.play_url || cloudFile.download_url,
                recordingExpiry: new Date(Date.now() + 30 * 86400000),
              },
            });
          }
        }
        break;
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Zoom Webhook] Error:", err);
    return NextResponse.json({ ok: true });
  }
}
