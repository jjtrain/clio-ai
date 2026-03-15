import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon
    const dayOfMonth = now.getUTCDate();

    const scheduled = await db.reportDefinition.findMany({
      where: { isScheduled: true, scheduleRecipients: { not: null } },
    });

    let sent = 0;

    for (const report of scheduled) {
      // Check frequency
      if (report.scheduleFrequency === "weekly" && dayOfWeek !== 1) continue;
      if (report.scheduleFrequency === "monthly" && dayOfMonth !== 1) continue;

      try {
        const recipients: string[] = report.scheduleRecipients ? JSON.parse(report.scheduleRecipients) : [];
        if (recipients.length === 0) continue;

        // Import and run executeReport logic inline
        const columns = JSON.parse(report.columns);
        const visibleCols = columns.filter((c: any) => c.visible);

        // Simple inline execution for cron
        let rows: any[] = [];
        const filters = JSON.parse(report.filters);
        const where: any = {};
        for (const f of filters) {
          if (f.operator === "equals") where[f.field] = f.value;
          else if (f.operator === "in") where[f.field] = { in: f.value };
          else if (f.operator === "notIn") where[f.field] = { notIn: f.value };
        }

        switch (report.dataSource) {
          case "invoices":
            rows = await db.invoice.findMany({ where, include: { matter: { include: { client: true } } }, take: 500 });
            break;
          case "timeEntries":
            rows = await db.timeEntry.findMany({ where, include: { matter: { include: { client: true } }, user: true }, take: 500 });
            break;
          case "matters":
            rows = await db.matter.findMany({ where, include: { client: true }, take: 500 });
            break;
          case "clients":
            rows = await db.client.findMany({ where, take: 500 });
            break;
          case "leads":
            rows = await db.lead.findMany({ where, take: 500 });
            break;
          case "appointments":
            rows = await db.appointment.findMany({ where, take: 500 });
            break;
        }

        // Build HTML table for email
        const tableHtml = `
          <h2>${report.name}</h2>
          <p>${report.description || ""}</p>
          <p>Generated: ${now.toLocaleDateString()}</p>
          <p>Total rows: ${rows.length}</p>
          <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse; font-family:sans-serif; font-size:14px;">
            <thead><tr>${visibleCols.map((c: any) => `<th style="background:#f3f4f6;text-align:left;">${c.label}</th>`).join("")}</tr></thead>
            <tbody>${rows.slice(0, 100).map((row: any) =>
              `<tr>${visibleCols.map((c: any) => {
                const val = c.field.includes(".") ? c.field.split(".").reduce((v: any, k: string) => v?.[k], row) : row[c.field];
                return `<td>${val ?? ""}</td>`;
              }).join("")}</tr>`
            ).join("")}</tbody>
          </table>
          ${rows.length > 100 ? `<p><em>Showing first 100 of ${rows.length} rows</em></p>` : ""}
        `;

        // Send via Resend
        const RESEND_API_KEY = process.env.RESEND_API_KEY;
        if (RESEND_API_KEY) {
          for (const email of recipients) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                from: process.env.FROM_EMAIL || "reports@clio.ai",
                to: [email],
                subject: `Scheduled Report: ${report.name}`,
                html: tableHtml,
              }),
            });
          }
        }

        await db.reportExecution.create({
          data: {
            reportId: report.id,
            resultData: JSON.stringify({ rowCount: rows.length }),
            rowCount: rows.length,
            exportFormat: "email",
          },
        });

        await db.reportDefinition.update({
          where: { id: report.id },
          data: { lastRunAt: new Date() },
        });

        sent++;
      } catch (err) {
        console.error(`[Reports Cron] Error running report ${report.name}:`, err);
      }
    }

    return NextResponse.json({ ok: true, scheduled: scheduled.length, sent });
  } catch (error: any) {
    console.error("[Reports Cron] Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
