import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as intakeEngine from "@/lib/intake-form-engine";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results: string[] = [];
    const now = new Date();

    // Find submissions needing follow-up
    const formsWithFollowUp = await db.publicIntakeForm.findMany({ where: { autoSendFollowUp: true, isActive: true } });
    let followUpsSent = 0;
    for (const form of formsWithFollowUp) {
      const cutoff = new Date(now.getTime() - form.followUpDelayHours * 3600000);
      const needsFollowUp = await db.intakeSubmission.findMany({
        where: { formId: form.id, status: "INTAKE_NEW" as any, createdAt: { lt: cutoff }, contactedAt: null },
      });
      for (const sub of needsFollowUp) {
        await intakeEngine.handleFollowUp(sub.id);
        followUpsSent++;
      }
    }
    results.push(`Follow-ups sent: ${followUpsSent}`);

    // Escalate submissions >48 hours without contact
    const escalationCutoff = new Date(now.getTime() - 48 * 3600000);
    const escalations = await db.intakeSubmission.count({
      where: { status: "INTAKE_NEW" as any, createdAt: { lt: escalationCutoff }, contactedAt: null },
    });
    if (escalations > 0) results.push(`WARNING: ${escalations} submission(s) uncontacted >48 hours`);

    // Calculate daily analytics
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todaySubmissions = await db.intakeSubmission.count({ where: { createdAt: { gte: todayStart } } });
    results.push(`Today's submissions: ${todaySubmissions}`);

    return NextResponse.json({ success: true, results, timestamp: now.toISOString() });
  } catch (error: any) {
    console.error("[Intake Follow-up] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
