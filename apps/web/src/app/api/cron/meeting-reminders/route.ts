import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendDigestEmail } from "@/lib/email";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3600000);

    const meetings = await db.meetingEvent.findMany({
      where: { status: "SCHEDULED", reminderSent: false, scheduledAt: { gt: now, lt: in24h } },
      include: { attendees: true },
    });

    let sent = 0;
    for (const meeting of meetings) {
      const dateStr = new Date(meeting.scheduledAt).toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" });
      for (const att of meeting.attendees) {
        await sendDigestEmail({
          to: att.email,
          subject: `Reminder: ${meeting.title} — ${dateStr}`,
          html: `<div style="font-family:sans-serif;max-width:500px;margin:0 auto;"><h2>Meeting Reminder</h2><p><strong>${meeting.title}</strong></p><p>${dateStr}</p><div style="text-align:center;margin:20px 0;"><a href="${meeting.joinUrl}" style="display:inline-block;background:#3B82F6;color:white;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;">Join Meeting</a></div></div>`,
          fromEmail: "meetings@managal.com",
        });
      }
      await db.meetingEvent.update({ where: { id: meeting.id }, data: { reminderSent: true } });
      sent++;
    }

    return NextResponse.json({ ok: true, reminders: sent });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
