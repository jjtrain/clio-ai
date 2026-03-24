import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

export async function scheduleRemindersForPattern(pattern: any): Promise<number> {
  if (!pattern.reminderEnabled || pattern.status !== "ACTIVE") return 0;

  let scheduled = 0;
  const now = new Date();

  if (pattern.patternType === "PERIODIC_BILLING" && pattern.typicalDayOfWeek !== null) {
    // Find next occurrence of this day+week pattern
    const targetDay = pattern.typicalDayOfWeek;
    const d = new Date(now);
    while (d.getDay() !== targetDay || d <= now) d.setDate(d.getDate() + 1);

    const scheduledFor = new Date(d);
    scheduledFor.setHours(pattern.typicalHour || 9, 0, 0, 0);
    if (pattern.reminderOffsetHours) scheduledFor.setTime(scheduledFor.getTime() - pattern.reminderOffsetHours * 3600000);

    const existing = await db.smartReminderRecord.findFirst({
      where: { patternId: pattern.id, scheduledFor: { gte: now, lte: new Date(scheduledFor.getTime() + 4 * 3600000) } },
    });
    if (!existing) {
      await db.smartReminderRecord.create({
        data: {
          firmId: pattern.firmId, userId: pattern.userId, patternId: pattern.id,
          reminderType: "BILLING_RUN", title: pattern.label,
          message: pattern.reminderMessage || `${pattern.label}. Time to run billing?`,
          scheduledFor, channels: pattern.reminderChannels,
          actionUrl: "/billing", actionLabel: "Run Billing",
        },
      });
      scheduled++;
    }
  }

  if (pattern.patternType === "POST_HEARING_ACTION" && pattern.typicalOffsetHours) {
    // Find recent court appearances without follow-up
    const recentHearings = await db.behaviorEvent.findMany({
      where: { userId: pattern.userId, eventType: "COURT_APPEARANCE", occurredAt: { gte: new Date(now.getTime() - 7 * 86400000) } },
    });

    for (const hearing of recentHearings) {
      const scheduledFor = new Date(hearing.occurredAt.getTime() + pattern.typicalOffsetHours * 3600000);
      if (scheduledFor < now) continue;

      const existing = await db.smartReminderRecord.findFirst({
        where: { patternId: pattern.id, contextData: { path: ["entityId"], equals: hearing.id } },
      });
      if (!existing) {
        await db.smartReminderRecord.create({
          data: {
            firmId: pattern.firmId, userId: pattern.userId, patternId: pattern.id,
            reminderType: "FOLLOW_UP_DUE", title: "Post-hearing follow-up",
            message: `It's been ${Math.round(pattern.typicalOffsetHours / 24)} days since a hearing. You usually create a follow-up task around now.`,
            scheduledFor, channels: pattern.reminderChannels,
            contextData: { entityId: hearing.id, matterId: hearing.matterId },
            actionUrl: hearing.matterId ? `/matters/${hearing.matterId}` : "/tasks/new",
            actionLabel: "Create Follow-Up Task",
          },
        });
        scheduled++;
      }
    }
  }

  return scheduled;
}

export async function processScheduledReminders(): Promise<number> {
  const now = new Date();
  const due = await db.smartReminderRecord.findMany({
    where: { isSent: false, status: "PENDING", scheduledFor: { lte: now } },
    take: 50,
  });

  for (const reminder of due) {
    await db.smartReminderRecord.update({
      where: { id: reminder.id },
      data: { isSent: true, sentAt: now, status: "SENT" },
    });
  }

  return due.length;
}

export async function expireStaleReminders(): Promise<number> {
  const cutoff = new Date(Date.now() - 24 * 3600000);
  const result = await db.smartReminderRecord.updateMany({
    where: { status: "PENDING", scheduledFor: { lt: cutoff }, isSent: false },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

export async function generateReminderMessage(pattern: any, context?: any): Promise<string> {
  try {
    const anthropic = new Anthropic();
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514", max_tokens: 128,
      system: "Write a friendly, conversational 1-2 sentence reminder for an attorney based on their detected work pattern. Be specific about timing. Use second person.",
      messages: [{ role: "user", content: `Pattern: ${pattern.label}. Type: ${pattern.patternType}. Context: ${JSON.stringify(context || {})}` }],
    });
    return resp.content[0]?.type === "text" ? resp.content[0].text : pattern.label;
  } catch {
    return pattern.reminderMessage || pattern.label;
  }
}
