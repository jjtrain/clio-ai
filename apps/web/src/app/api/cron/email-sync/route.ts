import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncInbox } from "@/lib/email-engine";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { provider: string; success: boolean; error?: string }[] = [];

  try {
    const integrations = await db.emailIntegration.findMany({
      where: { isEnabled: true },
    });

    for (const integration of integrations) {
      try {
        await syncInbox(integration.provider as any);
        results.push({ provider: integration.provider, success: true });
      } catch (err: any) {
        results.push({ provider: integration.provider, success: false, error: err.message });
      }
    }

    // Check and send scheduled emails
    const due = await db.emailSchedule.findMany({
      where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } },
    });

    let sent = 0;
    for (const sched of due) {
      try {
        const { sendEmail } = await import("@/lib/email-engine");
        const msgData = JSON.parse(sched.messageData);
        await sendEmail({
          provider: sched.provider as any,
          to: msgData.to || [],
          cc: msgData.cc || undefined,
          subject: msgData.subject || "",
          body: msgData.bodyHtml || msgData.body || "",
          matterId: sched.matterId || undefined,
        });
        await db.emailSchedule.update({
          where: { id: sched.id },
          data: { status: "SENT", sentAt: new Date() },
        });
        sent++;
      } catch (err: any) {
        await db.emailSchedule.update({
          where: { id: sched.id },
          data: { status: "FAILED", error: err.message },
        });
      }
    }

    return NextResponse.json({
      synced: results,
      scheduledSent: sent,
      scheduledFailed: due.length - sent,
    });
  } catch (err: any) {
    console.error("[Email Sync CRON]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
