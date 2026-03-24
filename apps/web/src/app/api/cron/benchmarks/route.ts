import { NextRequest, NextResponse } from "next/server";
import { snapshotFirmMetrics, rebuildPlatformBenchmarks } from "@/lib/benchmark-engine";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  try {
    // Snapshot all firms (in production, iterate distinct firmIds)
    const firms = await db.matter.findMany({ select: { clientId: true }, distinct: ["clientId"], take: 100 });
    let totalSnapshots = 0;
    // For demo, just snapshot default firm
    totalSnapshots += await snapshotFirmMetrics("demo-firm", period);

    // Rebuild platform benchmarks
    const benchmarks = await rebuildPlatformBenchmarks(period);

    return NextResponse.json({ success: true, period, snapshots: totalSnapshots, benchmarks });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
