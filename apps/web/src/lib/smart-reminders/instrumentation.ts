import { db } from "@/lib/db";

function getWeekOfMonth(date: Date): string {
  const d = date.getDate();
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  if (d <= 7) return "first";
  if (d <= 14) return "second";
  if (d <= 21) return "third";
  if (d > lastDay - 7) return "last";
  return "fourth";
}

export async function trackBehavior(event: {
  userId: string; firmId: string; eventType: string;
  entityType?: string; entityId?: string; matterId?: string; metadata?: Record<string, any>;
}): Promise<void> {
  try {
    const now = new Date();
    const enrichedMetadata = {
      ...event.metadata,
      dayOfWeek: now.getDay(),
      weekOfMonth: getWeekOfMonth(now),
      hour: now.getHours(),
      dayOfMonth: now.getDate(),
      isLastWeekOfMonth: now.getDate() > new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - 7,
      isFirstWeekOfMonth: now.getDate() <= 7,
    };

    await db.behaviorEvent.create({
      data: { ...event, metadata: enrichedMetadata, occurredAt: now },
    });
  } catch {
    // Fire and forget — never throw
  }
}
