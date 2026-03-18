import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { trackAllActive } from "@/lib/mail-engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const results: Record<string, any> = {};
  try {
    results.trackingSync = await trackAllActive();
    results.returned = await db.mailJob.count({ where: { status: "RETURNED" } });
    results.certifiedPending = await db.mailJob.count({
      where: { jobType: { in: ["CERTIFIED", "CERTIFIED_RETURN_RECEIPT"] }, status: { in: ["MAILED", "IN_TRANSIT"] }, mailedDate: { lt: new Date(Date.now() - 15 * 86400000) } },
    });
    const batches = await db.mailBatch.findMany({ where: { status: { in: ["SUBMITTED", "PROCESSING"] } } });
    for (const batch of batches) {
      const jobs = await db.mailJob.findMany({ where: { batchId: batch.id } });
      const completed = jobs.filter(j => ["DELIVERED", "RETURNED"].includes(j.status)).length;
      const failed = jobs.filter(j => j.status === "FAILED" || j.status === "RETURNED").length;
      if (completed === jobs.length) {
        await db.mailBatch.update({ where: { id: batch.id }, data: { status: failed > 0 ? "PARTIAL_FAILED" : "COMPLETED", completedCount: completed, failedCount: failed, completedAt: new Date() } });
      }
    }
    results.batchesUpdated = batches.length;
    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("[Mail Tracking Cron] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
