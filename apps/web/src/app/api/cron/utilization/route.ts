import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as engine from "@/lib/hr-engine";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    const billableEmployees = await db.firmEmployee.findMany({
      where: { isActive: true, role: { in: ["PARTNER", "OF_COUNSEL", "ASSOCIATE", "SENIOR_ASSOCIATE", "JUNIOR_ASSOCIATE", "PARALEGAL"] as any[] } },
    });

    let processed = 0;
    let errors = 0;

    for (const employee of billableEmployees) {
      try {
        await engine.calculateUtilization(employee.id, new Date(dateStr), "MONTHLY");
        processed++;
      } catch (err) {
        console.error(`[Utilization CRON] Failed for employee ${employee.id}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      date: dateStr,
      totalEmployees: billableEmployees.length,
      processed,
      errors,
    });
  } catch (error: any) {
    console.error("[Utilization CRON] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
