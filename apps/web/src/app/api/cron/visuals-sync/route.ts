import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, any> = {};

  try {
    // Update timeline event counts
    const timelines = await db.caseTimeline.findMany({ select: { id: true } });
    for (const t of timelines) {
      const count = await db.timelineEvent.count({ where: { timelineId: t.id } });
      await db.caseTimeline.update({ where: { id: t.id }, data: { eventCount: count } });
    }
    results.timelinesUpdated = timelines.length;

    // Check upcoming depositions without sessions
    const upcoming = await db.depositionSession.count({
      where: { status: "SETUP", depositionDate: { lte: new Date(Date.now() + 48 * 3600000), gte: new Date() } },
    });
    results.upcomingDepositions = upcoming;

    // Check completed sessions without analysis
    const needsAnalysis = await db.depositionSession.count({
      where: { status: "COMPLETED", aiDepoSummary: null },
    });
    results.needsAnalysis = needsAnalysis;

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("[Visuals Sync Cron] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
