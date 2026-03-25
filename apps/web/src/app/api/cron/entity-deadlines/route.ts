import { NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";

// Replicates corporateEntities.checkDeadlines logic for cron execution
export async function GET() {
  try {
    const now = new Date();
    const filings = await db.entityFiling.findMany({ where: { status: { in: ["UPCOMING", "DUE_SOON", "OVERDUE"] } }, include: { entity: true } });
    let tasksCreated = 0;

    for (const f of filings) {
      const daysUntil = Math.round((f.dueDate.getTime() - now.getTime()) / 86400000);
      if (daysUntil < 0) await db.entityFiling.update({ where: { id: f.id }, data: { status: "OVERDUE" } });
      else if (daysUntil <= 30) await db.entityFiling.update({ where: { id: f.id }, data: { status: "DUE_SOON" } });

      const thresholds = daysUntil < 0 ? ["OVERDUE"] : daysUntil <= 7 ? ["7_DAYS"] : daysUntil <= 30 ? ["30_DAYS"] : daysUntil <= 60 ? ["60_DAYS"] : daysUntil <= 90 ? ["90_DAYS"] : [];
      for (const alertType of thresholds) {
        const existing = await db.entityDeadlineAlert.findUnique({ where: { filingId_alertType: { filingId: f.id, alertType } } });
        if (!existing && f.entity.matterId) {
          const task = await db.task.create({ data: { matterId: f.entity.matterId, title: `Filing due: ${f.filingType.replace(/_/g, " ")} — ${f.entity.entityName} (${f.filingJurisdiction})`, dueDate: f.dueDate, priority: daysUntil <= 30 ? "HIGH" : "MEDIUM", status: "NOT_STARTED" } });
          await db.entityDeadlineAlert.create({ data: { entityId: f.entityId, filingId: f.id, alertType, taskId: task.id } });
          tasksCreated++;
        }
      }
    }
    return NextResponse.json({ ok: true, tasksCreated });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
