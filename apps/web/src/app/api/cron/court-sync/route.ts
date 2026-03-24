import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncAllWatchedCases } from "@/lib/court-sync-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Get all firms with active court integrations
    const integrations = await db.courtIntegration.findMany({
      where: { status: "active" },
      select: { firmId: true },
      distinct: ["firmId"],
    });

    const firmIds = integrations.map((i) => i.firmId);
    if (firmIds.length === 0) {
      return NextResponse.json({ ok: true, message: "No active court integrations" });
    }

    let totalCreated = 0;
    let totalUpdated = 0;
    const allErrors: string[] = [];

    for (const firmId of firmIds) {
      const result = await syncAllWatchedCases(firmId);
      totalCreated += result.totalCreated;
      totalUpdated += result.totalUpdated;
      allErrors.push(...result.errors);
    }

    return NextResponse.json({
      ok: true,
      firms: firmIds.length,
      totalCreated,
      totalUpdated,
      errors: allErrors.length > 0 ? allErrors : undefined,
    });
  } catch (error: any) {
    console.error("[Court Sync Cron] Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
