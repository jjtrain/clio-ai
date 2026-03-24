import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { snapshotAllDimensions } from "@/lib/realization-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Snapshot prior month
    const now = new Date();
    const priorMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const period = `${priorMonth.getFullYear()}-${String(priorMonth.getMonth() + 1).padStart(2, "0")}`;

    // Get all firms (unique firmIds from time entries)
    const firms = await db.timeEntry.findMany({
      select: { firmId: true },
      distinct: ["firmId"],
    });

    const firmIds = Array.from(new Set(firms.map((f) => f.firmId).filter(Boolean))) as string[];
    if (firmIds.length === 0) firmIds.push("demo-firm");

    let totalSnapshots = 0;
    const errors: string[] = [];

    for (const firmId of firmIds) {
      try {
        const result = await snapshotAllDimensions(firmId, period);
        totalSnapshots += result.count;
      } catch (err: any) {
        errors.push(`${firmId}: ${err.message}`);
      }
    }

    return NextResponse.json({
      ok: true,
      period,
      firms: firmIds.length,
      totalSnapshots,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    console.error("[Realization Cron] Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
