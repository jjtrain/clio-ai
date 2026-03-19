import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as engine from "@/lib/hr-engine";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const firms = await db.hRIntegration.findMany({ where: { isEnabled: true } });
    const results = [];

    for (const _firm of firms) {
      const employeeSync = await engine.syncEmployees();
      const timeOffSync = await engine.syncTimeOff();

      const activeAttorneys = await db.firmEmployee.findMany({
        where: { isActive: true, role: { in: ["PARTNER", "OF_COUNSEL", "ASSOCIATE", "SENIOR_ASSOCIATE", "JUNIOR_ASSOCIATE"] as any[] } },
      });

      let utilizationCount = 0;
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split("T")[0];

      for (const attorney of activeAttorneys) {
        await engine.calculateUtilization(attorney.id, new Date(dateStr), "MONTHLY");
        utilizationCount++;
      }

      results.push({
        firmId: _firm.companyId,
        employeeSync,
        timeOffSync,
        utilizationCalculated: utilizationCount,
      });
    }

    return NextResponse.json({ success: true, firmsProcessed: results.length, results });
  } catch (error: any) {
    console.error("[HR Sync CRON] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
