import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkUSCISStatus } from "@/lib/immigration-engine";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, any> = {};

  try {
    // Get active cases with receipt numbers, limit to 10 per run
    const cases = await db.immigrationCase.findMany({
      where: {
        receiptNumber: { not: null },
        status: { in: ["PENDING", "BIOMETRICS_SCHEDULED", "BIOMETRICS_COMPLETED", "INTERVIEW_SCHEDULED", "RFE_RESPONSE_FILED", "NOIR_RESPONSE_FILED"] },
      },
      orderBy: { lastCaseStatusCheck: "asc" },
      take: 10,
    });

    let checked = 0, changed = 0;
    for (const c of cases) {
      try {
        const result = await checkUSCISStatus(c.id);
        checked++;
        if (result && (result as any).hasChanged) changed++;
      } catch {}
    }

    results.checked = checked;
    results.changed = changed;
    results.totalPending = cases.length;

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("[USCIS Status Cron] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
