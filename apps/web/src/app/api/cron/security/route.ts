import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as secEngine from "@/lib/security-engine";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const results: string[] = [];
    const now = new Date();

    // Run compliance checks for all enabled frameworks
    const secModule = await db.securityModule.findFirst();
    const frameworks = secModule?.complianceFrameworks ? JSON.parse(secModule.complianceFrameworks) : ["SOC2"];
    for (const fw of frameworks) {
      try {
        const check = await secEngine.runComplianceCheck(fw);
        results.push(`${fw}: ${check.passed}/${check.controlsChecked} controls passed`);
      } catch (err: any) { results.push(`${fw} check failed: ${err.message}`); }
    }

    // Check encryption keys needing rotation
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 86400000);
    const keysNeedingRotation = await db.encryptionKey.count({ where: { status: "KEY_ACTIVE" as any, nextRotationDate: { lte: thirtyDaysFromNow } } });
    if (keysNeedingRotation > 0) results.push(`WARNING: ${keysNeedingRotation} encryption key(s) need rotation`);

    // Check vendor assessments overdue
    const overdueVendors = await db.vendorRiskAssessment.count({ where: { nextReviewDate: { lte: now } } });
    if (overdueVendors > 0) results.push(`${overdueVendors} vendor assessment(s) overdue`);

    // Run retention enforcement
    const retention = await secEngine.enforceRetentionPolicies();
    results.push(`Retention: ${retention.policiesChecked} policies checked`);

    return NextResponse.json({ success: true, results, timestamp: now.toISOString() });
  } catch (error: any) {
    console.error("[Security Cron] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
