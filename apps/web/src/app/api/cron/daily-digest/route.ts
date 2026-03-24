import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { buildDigestForUser, renderDigestHtml } from "@/lib/digest-engine";
import { sendDigestEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prefs = await db.digestPreference.findMany({
      where: { enabled: true },
    });

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const pref of prefs) {
      try {
        const payload = await buildDigestForUser(pref.userId);

        // Skip if no sections have data (other than stats which always has data)
        const nonStatsSections = payload.sections.filter((s) => s.key !== "stats");
        if (nonStatsSections.length === 0 && payload.sections.length <= 1) {
          continue; // Nothing interesting to send
        }

        const html = renderDigestHtml(payload);

        const result = await sendDigestEmail({
          to: payload.userEmail,
          subject: `Your Daily Digest — ${payload.date}`,
          html,
          fromEmail: "digest@managal.com",
        });

        await db.digestLog.create({
          data: {
            userId: pref.userId,
            status: result.success ? "sent" : "failed",
            previewHtml: result.previewHtml || null,
            error: result.error,
          },
        });

        if (result.success) sent++;
        else {
          failed++;
          errors.push(`${pref.userId}: ${result.error}`);
        }
      } catch (err: any) {
        failed++;
        errors.push(`${pref.userId}: ${err.message}`);
        await db.digestLog.create({
          data: {
            userId: pref.userId,
            status: "failed",
            error: err.message,
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      eligible: prefs.length,
      sent,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[Daily Digest Cron] Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
