import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    let settings = await db.riskSettings.findUnique({ where: { id: "default" } });
    if (!settings) settings = await db.riskSettings.create({ data: { id: "default" } });
    if (!settings.autoScanEnabled) {
      return NextResponse.json({ ok: true, message: "Auto-scan disabled", alertsGenerated: 0 });
    }

    const startTime = Date.now();
    let alertCount = 0;

    // Billing: excessive hours
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const maxHours = parseFloat(settings.unusualTimeEntryHours?.toString() || "10");
    const timeEntries = await db.timeEntry.findMany({ where: { date: { gte: thirtyDaysAgo } }, include: { matter: true, user: true } });

    for (const te of timeEntries) {
      if (te.duration / 60 > maxHours) {
        const title = `Excessive time entry: ${(te.duration / 60).toFixed(1)}h`;
        const exists = await db.riskAlert.count({ where: { title, entityId: te.id, status: { in: ["NEW", "ACKNOWLEDGED", "INVESTIGATING"] } } });
        if (exists === 0) {
          await db.riskAlert.create({ data: { category: "BILLING", severity: "MEDIUM", title, description: `${te.description} on ${te.matter?.name || "unknown"} (${(te.duration / 60).toFixed(1)}h)`, source: "anomaly_scan", entityType: "TimeEntry", entityId: te.id, matterId: te.matterId } });
          alertCount++;
        }
      }
    }

    // Trust overdrafts
    if (settings.trustOverdraftAlert) {
      const overdrafts = await db.trustLedger.findMany({ where: { balance: { lt: 0 } }, include: { client: true } });
      for (const l of overdrafts) {
        const title = `Trust overdraft: ${l.client?.name || "Unknown"}`;
        const exists = await db.riskAlert.count({ where: { title, entityId: l.id, status: { in: ["NEW", "ACKNOWLEDGED", "INVESTIGATING"] } } });
        if (exists === 0) {
          await db.riskAlert.create({ data: { category: "TRUST", severity: "CRITICAL", title, description: `Negative balance: $${parseFloat(l.balance?.toString() || "0").toFixed(2)}`, source: "trust_audit", entityType: "TrustLedger", entityId: l.id, clientId: l.clientId } });
          alertCount++;
        }
      }
    }

    // Overdue tasks
    const overdueTasks = await db.task.findMany({ where: { dueDate: { lt: new Date() }, isComplete: false }, include: { matter: true } });
    for (const t of overdueTasks) {
      const title = `Overdue task: ${t.title}`;
      const exists = await db.riskAlert.count({ where: { title, entityId: t.id, status: { in: ["NEW", "ACKNOWLEDGED", "INVESTIGATING"] } } });
      if (exists === 0) {
        await db.riskAlert.create({ data: { category: "DEADLINE", severity: "HIGH", title, description: `Due ${new Date(t.dueDate!).toLocaleDateString()}`, source: "deadline_check", entityType: "Task", entityId: t.id, matterId: t.matterId || undefined } });
        alertCount++;
      }
    }

    // Matter inactivity
    const inactDays = settings.inactivityAlertDays;
    const inactCutoff = new Date(Date.now() - inactDays * 86400000);
    const openMatters = await db.matter.findMany({
      where: { status: { not: "CLOSED" } },
      include: { timeEntries: { orderBy: { date: "desc" }, take: 1 }, client: true },
    });
    for (const m of openMatters) {
      const lastAct = m.timeEntries[0]?.date || m.openDate;
      if (new Date(lastAct) < inactCutoff) {
        const title = `Inactive matter: ${m.name}`;
        const exists = await db.riskAlert.count({ where: { title, entityId: m.id, status: { in: ["NEW", "ACKNOWLEDGED", "INVESTIGATING"] } } });
        if (exists === 0) {
          await db.riskAlert.create({ data: { category: "PRODUCTIVITY", severity: "MEDIUM", title, description: `No activity for ${Math.floor((Date.now() - new Date(lastAct).getTime()) / 86400000)} days`, source: "anomaly_scan", entityType: "Matter", entityId: m.id, matterId: m.id, clientId: m.clientId } });
          alertCount++;
        }
      }
    }

    const duration = Date.now() - startTime;
    await db.riskScanLog.create({ data: { scanType: "full", alertsGenerated: alertCount, duration, summary: `Cron scan: ${alertCount} alerts` } });

    return NextResponse.json({ ok: true, alertsGenerated: alertCount, duration });
  } catch (error: any) {
    console.error("[Risk Cron] Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
