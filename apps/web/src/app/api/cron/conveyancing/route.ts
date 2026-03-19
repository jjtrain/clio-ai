import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 86400000);

    // Find closings in next 7 days
    const upcomingClosings = await db.conveyancingMatter.findMany({
      where: {
        closingDate: { gte: now, lte: sevenDaysFromNow },
        status: { notIn: ["CLOSED", "COMPLETED", "CANCELLED", "RECORDED"] },
      },
      include: { checklists: true, titleExceptions: true, matter: true },
    });

    let totalOpenExceptions = 0;
    let updatedChecklists = 0;

    for (const cm of upcomingClosings) {
      // Count open title exceptions
      const openExceptions = cm.titleExceptions.filter(
        (te) => te.status === "OPEN" || te.status === "IN_PROGRESS"
      );
      totalOpenExceptions += openExceptions.length;

      // Update checklist completion percentages
      for (const cl of cm.checklists) {
        if (cl.totalCount > 0) {
          const percentage = (cl.completedCount / cl.totalCount) * 100;
          await db.closingChecklist.update({
            where: { id: cl.id },
            data: { completionPercentage: percentage, lastUpdated: now },
          });
          updatedChecklists++;
        }
      }
    }

    return NextResponse.json({
      ok: true,
      upcomingClosings: upcomingClosings.length,
      openTitleExceptions: totalOpenExceptions,
      updatedChecklists,
    });
  } catch (error: any) {
    console.error("[Conveyancing Cron] Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
