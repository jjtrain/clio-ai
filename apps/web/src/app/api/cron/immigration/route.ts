import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, any> = {};
  const now = new Date();

  try {
    // Update deadline statuses
    const deadlines = await db.immigrationDeadline.findMany({
      where: { status: { in: ["UPCOMING", "WARNING", "URGENT"] } },
    });
    let warned = 0, urgent = 0, overdue = 0;
    for (const d of deadlines) {
      const days = Math.ceil((new Date(d.dueDate).getTime() - now.getTime()) / 86400000);
      let newStatus: string | null = null;
      if (days < 0 && d.status !== "OVERDUE") { newStatus = "OVERDUE"; overdue++; }
      else if (days >= 0 && days <= 7 && d.status !== "URGENT") { newStatus = "URGENT"; urgent++; }
      else if (days > 7 && days <= 30 && d.status !== "WARNING") { newStatus = "WARNING"; warned++; }
      if (newStatus) {
        await db.immigrationDeadline.update({ where: { id: d.id }, data: { status: newStatus as any } });
      }
    }
    results.deadlines = { warned, urgent, overdue };

    // Count expiring statuses
    const expiringStatuses = await db.immigrationCase.count({
      where: { beneficiaryStatusExpiry: { lte: new Date(Date.now() + 90 * 86400000), gte: now } },
    });
    results.expiringStatuses = expiringStatuses;

    // Count active RFEs
    const activeRFEs = await db.immigrationCase.count({
      where: { rfeDate: { not: null }, rfeResponseDate: null, status: "RFE_ISSUED" },
    });
    results.activeRFEs = activeRFEs;

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("[Immigration Cron] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
