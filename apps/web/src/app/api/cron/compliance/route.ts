import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as engine from "@/lib/compliance-engine";
import * as legl from "@/lib/integrations/legl";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Record<string, any> = {};

  try {
    // 1. Check for expiring checks (30 days)
    const expiring30 = await engine.checkExpiring(30);
    results.expiringIn30Days = expiring30.length;

    // 2. Check for urgently expiring (7 days)
    const expiring7 = await engine.checkExpiring(7);
    results.expiringIn7Days = expiring7.length;

    // 3. Resend notifications for checks pending >7 days
    const staleChecks = await db.complianceCheck.findMany({
      where: {
        status: "PENDING_CLIENT",
        createdAt: { lt: new Date(Date.now() - 7 * 86400000) },
        reminderSentAt: null,
      },
      take: 10,
    });
    for (const check of staleChecks) {
      if (check.externalCheckId) {
        await legl.resendClientNotification(check.externalCheckId);
      }
      await db.complianceCheck.update({ where: { id: check.id }, data: { reminderSentAt: new Date() } });
      await db.complianceActivity.create({
        data: { checkId: check.id, activityType: "CLIENT_NOTIFIED", description: "Reminder sent — check pending >7 days", performedBy: "system" },
      });
    }
    results.remindersSent = staleChecks.length;

    // 4. Sync in-progress checks from Legl
    const config = await db.complianceIntegration.findUnique({ where: { provider: "LEGL" } });
    if (config?.isEnabled) {
      const inProgress = await db.complianceCheck.findMany({
        where: { provider: "LEGL", status: { in: ["PENDING_CLIENT", "IN_PROGRESS", "AWAITING_DOCUMENTS", "UNDER_REVIEW"] }, externalCheckId: { not: null } },
        take: 20,
      });
      let synced = 0;
      for (const check of inProgress) {
        try {
          const result = await legl.getCheck(check.externalCheckId!);
          if (result.success && result.data) {
            const statusMap: Record<string, string> = {
              pending_client: "PENDING_CLIENT", in_progress: "IN_PROGRESS",
              awaiting_documents: "AWAITING_DOCUMENTS", under_review: "UNDER_REVIEW",
              passed: "PASSED", failed: "FAILED", cancelled: "CANCELLED",
            };
            const newStatus = statusMap[result.data.status?.toLowerCase()] || check.status;
            if (newStatus !== check.status) {
              await db.complianceCheck.update({ where: { id: check.id }, data: { status: newStatus as any, riskScore: result.data.risk_score, rawPayload: JSON.stringify(result.data) } });
              synced++;
            }
          }
        } catch {}
      }
      results.checksSynced = synced;
    }

    // 5. Recalculate risk scores for checks with updates
    const needsRecalc = await db.complianceCheck.findMany({
      where: { status: { in: ["PASSED", "UNDER_REVIEW"] }, riskScore: null },
      take: 10,
    });
    for (const check of needsRecalc) {
      const { score, riskLevel } = engine.calculateRiskScore(check);
      await db.complianceCheck.update({ where: { id: check.id }, data: { riskScore: score, overallRiskLevel: riskLevel as any } });
    }
    results.riskScoresCalculated = needsRecalc.length;

    // 6. Check for matters without compliance checks
    const uncheckedMatters = await db.matter.findMany({
      where: { status: "OPEN", complianceChecks: { none: {} } },
      take: 20, select: { id: true, name: true },
    });
    results.mattersWithoutChecks = uncheckedMatters.length;

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    console.error("[Compliance Cron] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
