import { db } from "@/lib/db";

export async function initializeRequirements(userId: string, firmId: string, jurisdictionCodes: string[]): Promise<any[]> {
  const results = [];
  for (const code of jurisdictionCodes) {
    const jur = await db.cLEJurisdiction.findUnique({ where: { code }, include: { requirements: true } });
    if (!jur) continue;

    const now = new Date();
    const periodMonths = jur.reportingPeriodMonths;
    const periodStart = new Date(now.getFullYear(), 0, 1); // simplified: Jan 1
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + periodMonths);
    const deadline = new Date(periodEnd);
    deadline.setDate(deadline.getDate() + jur.gracePeriodDays);

    const breakdown: Record<string, any> = {};
    for (const req of jur.requirements) {
      breakdown[req.category] = { earned: 0, required: req.creditsRequired, remaining: req.creditsRequired };
    }

    const existing = await db.attorneyCLEReq.findFirst({ where: { userId, jurisdictionId: jur.id, periodStart } });
    if (existing) { results.push(existing); continue; }

    const req = await db.attorneyCLEReq.create({
      data: {
        userId, firmId, jurisdictionId: jur.id, periodStart, periodEnd, reportingDeadline: deadline,
        periodLabel: `${periodStart.getFullYear()}–${periodEnd.getFullYear()} Period`,
        totalRequired: jur.totalCreditsRequired, creditsRemaining: jur.totalCreditsRequired,
        categoryBreakdown: breakdown,
      },
    });
    results.push(req);
  }
  return results;
}

export async function addCredit(input: {
  userId: string; firmId: string; courseName: string; provider: string; format: string; deliveryMethod: string;
  completedAt: Date; totalCredits: number; creditsByCategory: Record<string, number>; jurisdictions: string[];
  certificateUrl?: string; courseNumber?: string; notes?: string;
}): Promise<any> {
  const credit = await db.cLECreditEntry.create({
    data: {
      userId: input.userId, firmId: input.firmId, courseName: input.courseName, provider: input.provider,
      format: input.format, deliveryMethod: input.deliveryMethod, completedAt: input.completedAt,
      totalCredits: input.totalCredits, creditsByCategory: input.creditsByCategory, jurisdictions: input.jurisdictions,
      certificateUrl: input.certificateUrl, courseNumber: input.courseNumber, notes: input.notes,
    },
  });

  // Update requirements for each jurisdiction
  for (const code of input.jurisdictions) {
    const jur = await db.cLEJurisdiction.findUnique({ where: { code } });
    if (!jur) continue;

    const req = await db.attorneyCLEReq.findFirst({
      where: { userId: input.userId, jurisdictionId: jur.id, status: { not: "FILED" } },
      orderBy: { periodEnd: "desc" },
    });
    if (!req) continue;

    // Link credit to requirement
    await db.cLECreditEntry.update({ where: { id: credit.id }, data: { requirementId: req.id } });
    await recalculateRequirement(req.id);
  }

  return credit;
}

export async function recalculateRequirement(reqId: string): Promise<any> {
  const req = await db.attorneyCLEReq.findUnique({ where: { id: reqId }, include: { jurisdiction: { include: { requirements: true } }, credits: true } });
  if (!req) return null;

  const breakdown: Record<string, any> = {};
  for (const rule of req.jurisdiction.requirements) {
    breakdown[rule.category] = { earned: 0, required: rule.creditsRequired, remaining: rule.creditsRequired };
  }

  let totalEarned = 0;
  for (const credit of req.credits) {
    const cats = credit.creditsByCategory as Record<string, number>;
    for (const [cat, amount] of Object.entries(cats)) {
      if (breakdown[cat]) { breakdown[cat].earned += amount; breakdown[cat].remaining = Math.max(0, breakdown[cat].required - breakdown[cat].earned); }
      totalEarned += amount;
    }
  }

  totalEarned = Math.min(totalEarned, req.credits.reduce((s, c) => s + c.totalCredits, 0)); // prevent double-counting
  const creditsRemaining = Math.max(0, req.totalRequired - totalEarned - req.carryoverCreditsApplied);
  const pctComplete = req.totalRequired > 0 ? Math.min(100, Math.round(((totalEarned + req.carryoverCreditsApplied) / req.totalRequired) * 100)) : 100;

  const allMet = Object.values(breakdown).every((b: any) => b.remaining <= 0);
  const status = allMet && creditsRemaining <= 0 ? "COMPLETE" : req.status === "OVERDUE" ? "OVERDUE" : "IN_PROGRESS";

  return db.attorneyCLEReq.update({
    where: { id: reqId },
    data: { totalEarned, creditsRemaining, pctComplete, categoryBreakdown: breakdown, status },
  });
}

export async function getComplianceSummary(userId: string): Promise<any> {
  const reqs = await db.attorneyCLEReq.findMany({
    where: { userId, status: { not: "FILED" } },
    include: { jurisdiction: true, credits: { orderBy: { completedAt: "desc" }, take: 5 } },
    orderBy: { reportingDeadline: "asc" },
  });

  const now = new Date();
  const jurisdictions = reqs.map((req) => {
    const days = Math.ceil((req.reportingDeadline.getTime() - now.getTime()) / 86400000);
    const urgency = days < 0 ? "overdue" : days <= 7 ? "critical" : days <= 30 ? "urgent" : days <= 90 ? "warning" : "ok";
    const cats = req.categoryBreakdown as Record<string, any>;
    const gaps = Object.entries(cats).filter(([, v]: any) => v.remaining > 0).map(([cat, v]: any) => ({ category: cat, ...v }));
    const weeksLeft = Math.max(1, days / 7);
    return { jurisdiction: req.jurisdiction, requirement: req, daysUntilDeadline: days, urgencyLevel: urgency, categoryGaps: gaps, suggestedHoursPerWeek: Math.round((req.creditsRemaining / weeksLeft) * 10) / 10, recentCredits: req.credits };
  });

  const overdue = jurisdictions.some((j) => j.urgencyLevel === "overdue");
  const critical = jurisdictions.some((j) => j.urgencyLevel === "critical" || j.urgencyLevel === "urgent");

  return {
    jurisdictions,
    overallStatus: overdue ? "overdue" : critical ? "critical" : jurisdictions.some((j) => j.urgencyLevel === "warning") ? "at_risk" : "compliant",
    nextDeadline: reqs[0]?.reportingDeadline,
    nextDeadlineJurisdiction: reqs[0]?.jurisdiction.code,
  };
}

export async function checkAndSendAlerts(userId: string, firmId: string): Promise<any[]> {
  const reqs = await db.attorneyCLEReq.findMany({ where: { userId, status: { in: ["IN_PROGRESS", "OVERDUE", "GRACE_PERIOD"] } }, include: { jurisdiction: true } });
  const now = new Date();
  const alerts: any[] = [];

  const thresholds = [
    { days: 90, type: "NINETY_DAYS" }, { days: 60, type: "SIXTY_DAYS" }, { days: 30, type: "THIRTY_DAYS" },
    { days: 14, type: "TWO_WEEKS" }, { days: 7, type: "ONE_WEEK" }, { days: 3, type: "THREE_DAYS" },
    { days: 1, type: "ONE_DAY" }, { days: 0, type: "OVERDUE" },
  ];

  for (const req of reqs) {
    const days = Math.ceil((req.reportingDeadline.getTime() - now.getTime()) / 86400000);

    for (const t of thresholds) {
      if (days <= t.days) {
        const existing = await db.cLEAlertRecord.findFirst({ where: { requirementId: req.id, alertType: t.type } });
        if (existing) continue;

        const message = days > 0
          ? `${req.jurisdiction.name} CLE deadline in ${days} days. ${req.creditsRemaining} credits remaining.`
          : `Your ${req.jurisdiction.name} CLE deadline has passed. ${req.creditsRemaining} credits still needed.`;

        const alert = await db.cLEAlertRecord.create({
          data: { userId, firmId, requirementId: req.id, alertType: t.type, daysUntilDeadline: days, creditsRemaining: req.creditsRemaining, message },
        });
        alerts.push(alert);
      }
    }
  }

  return alerts;
}
