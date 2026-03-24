import { db } from "@/lib/db";

const MIN_OCCURRENCES = 3;
const LOOKBACK_DAYS = 90;

export async function runAllDetectors(userId: string, firmId: string): Promise<any> {
  const startedAt = new Date();
  let patternsFound = 0, patternsNew = 0, patternsUpdated = 0;

  const results = await Promise.all([
    detectPeriodicBilling(userId, firmId),
    detectPostEventFollowUp(userId, firmId),
    detectTimeTrackingHabit(userId, firmId),
  ]);

  for (const patterns of results) {
    for (const p of patterns) {
      patternsFound++;
      const existing = await db.learnedPattern.findFirst({
        where: { userId, patternType: p.patternType, actionEventType: p.actionEventType, triggerEventType: p.triggerEventType || undefined },
      });

      if (existing) {
        await db.learnedPattern.update({
          where: { id: existing.id },
          data: { confidenceScore: p.confidenceScore, occurrenceCount: p.occurrenceCount, lastObservedAt: new Date(), label: p.label, typicalDayOfWeek: p.typicalDayOfWeek, typicalWeekOfMonth: p.typicalWeekOfMonth, typicalHour: p.typicalHour, typicalOffsetHours: p.typicalOffsetHours },
        });
        patternsUpdated++;
      } else {
        await db.learnedPattern.create({
          data: { ...p, userId, firmId, firstObservedAt: new Date(), lastObservedAt: new Date(), status: p.confidenceScore >= 0.65 ? "SHOWN" : "SUGGESTED" },
        });
        patternsNew++;
      }
    }
  }

  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400000);
  const eventsAnalyzed = await db.behaviorEvent.count({ where: { userId, occurredAt: { gte: cutoff } } });

  const run = await db.patternDetectionRun.create({
    data: { firmId, userId, startedAt, completedAt: new Date(), eventsAnalyzed, patternsFound, patternsNew, patternsUpdated },
  });

  return run;
}

async function detectPeriodicBilling(userId: string, firmId: string): Promise<any[]> {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400000);
  const events = await db.behaviorEvent.findMany({
    where: { userId, eventType: { in: ["BILLING_RUN", "INVOICE_CREATED"] }, occurredAt: { gte: cutoff } },
    orderBy: { occurredAt: "asc" },
  });

  if (events.length < MIN_OCCURRENCES) return [];

  // Analyze day of week distribution
  const dayCount: Record<number, number> = {};
  const weekCount: Record<string, number> = {};
  for (const e of events) {
    const meta = e.metadata as any;
    if (meta?.dayOfWeek !== undefined) dayCount[meta.dayOfWeek] = (dayCount[meta.dayOfWeek] || 0) + 1;
    if (meta?.weekOfMonth) weekCount[meta.weekOfMonth] = (weekCount[meta.weekOfMonth] || 0) + 1;
  }

  const patterns: any[] = [];
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Find dominant day + week
  const topDay = Object.entries(dayCount).sort(([, a], [, b]) => b - a)[0];
  const topWeek = Object.entries(weekCount).sort(([, a], [, b]) => b - a)[0];

  if (topDay && topWeek && Number(topDay[1]) >= MIN_OCCURRENCES) {
    const confidence = Number(topDay[1]) / events.length;
    patterns.push({
      patternType: "PERIODIC_BILLING",
      label: `You bill on the ${topWeek[0]} ${days[Number(topDay[0])]} of each month`,
      actionEventType: "BILLING_RUN",
      typicalDayOfWeek: Number(topDay[0]),
      typicalWeekOfMonth: topWeek[0],
      confidenceScore: Math.min(confidence * 1.2, 0.95),
      occurrenceCount: events.length,
    });
  }

  return patterns;
}

async function detectPostEventFollowUp(userId: string, firmId: string): Promise<any[]> {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400000);
  const patterns: any[] = [];

  for (const triggerType of ["COURT_APPEARANCE", "DISCOVERY_DEMAND_SERVED"]) {
    const triggers = await db.behaviorEvent.findMany({
      where: { userId, eventType: triggerType, occurredAt: { gte: cutoff } },
    });

    if (triggers.length < MIN_OCCURRENCES) continue;

    const offsets: number[] = [];
    for (const trigger of triggers) {
      const followUp = await db.behaviorEvent.findFirst({
        where: {
          userId,
          eventType: { in: ["FOLLOW_UP_TASK_CREATED", "FOLLOW_UP_SENT", "TASK_CREATED"] },
          occurredAt: { gte: trigger.occurredAt, lte: new Date(trigger.occurredAt.getTime() + 7 * 86400000) },
          matterId: trigger.matterId,
        },
        orderBy: { occurredAt: "asc" },
      });

      if (followUp) {
        offsets.push((followUp.occurredAt.getTime() - trigger.occurredAt.getTime()) / 3600000);
      }
    }

    if (offsets.length >= MIN_OCCURRENCES) {
      const median = offsets.sort((a, b) => a - b)[Math.floor(offsets.length / 2)];
      const stdDev = Math.sqrt(offsets.reduce((s, v) => s + (v - median) ** 2, 0) / offsets.length);
      const confidence = Math.max(0.3, Math.min(0.95, 1 - stdDev / 48));

      const days = Math.round(median / 24);
      const label = triggerType === "COURT_APPEARANCE"
        ? `You follow up ${days} days after court hearings`
        : `You follow up on discovery after ${days} days`;

      patterns.push({
        patternType: triggerType === "COURT_APPEARANCE" ? "POST_HEARING_ACTION" : "DISCOVERY_FOLLOW_UP",
        label,
        triggerEventType: triggerType,
        actionEventType: "FOLLOW_UP_TASK_CREATED",
        typicalOffsetHours: median,
        confidenceScore: confidence,
        occurrenceCount: offsets.length,
      });
    }
  }

  return patterns;
}

async function detectTimeTrackingHabit(userId: string, firmId: string): Promise<any[]> {
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400000);
  const events = await db.behaviorEvent.findMany({
    where: { userId, eventType: "TIME_ENTRY_CREATED", occurredAt: { gte: cutoff } },
  });

  if (events.length < 10) return []; // need more data for time tracking

  const hourCount: Record<number, number> = {};
  for (const e of events) {
    const meta = e.metadata as any;
    if (meta?.hour !== undefined) hourCount[meta.hour] = (hourCount[meta.hour] || 0) + 1;
  }

  const patterns: any[] = [];
  const topHour = Object.entries(hourCount).sort(([, a], [, b]) => b - a)[0];

  if (topHour && Number(topHour[1]) / events.length > 0.3) {
    const hour = Number(topHour[0]);
    const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    patterns.push({
      patternType: "TIME_TRACKING_HABIT",
      label: `You usually log time in the ${period}`,
      actionEventType: "TIME_ENTRY_CREATED",
      typicalHour: hour,
      confidenceScore: Math.min(Number(topHour[1]) / events.length * 1.5, 0.90),
      occurrenceCount: events.length,
    });
  }

  return patterns;
}
