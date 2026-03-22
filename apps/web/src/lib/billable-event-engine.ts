import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

export async function detectAndCreateEvent(params: {
  eventType: string; source: string; externalId?: string; userId: string;
  contactName?: string; contactEmail?: string; contactPhone?: string; contactRole?: string;
  subject?: string; startTime: Date; endTime?: Date; durationSeconds?: number; metadata?: any;
}) {
  if (params.externalId) {
    const existing = await db.billableEvent.findFirst({ where: { externalId: params.externalId } });
    if (existing) return existing;
  }
  const match = await matchEventToMatter({
    contactPhone: params.contactPhone, contactEmail: params.contactEmail,
    contactName: params.contactName, subject: params.subject,
  });
  const event = await db.billableEvent.create({
    data: {
      ...params as any, status: "BEVS_PENDING" as any,
      matterId: match.matterId, clientId: match.clientId,
      matterMatchConfidence: match.confidence, matterMatchMethod: match.method,
      expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
    } as any,
  });
  return event;
}

export async function matchEventToMatter(params: {
  contactPhone?: string; contactEmail?: string; contactName?: string; subject?: string;
}) {
  if (params.contactPhone) {
    const client = await db.client.findFirst({ where: { phone: { contains: params.contactPhone } } });
    if (client) {
      const matter = await db.matter.findFirst({ where: { clientId: client.id, status: "active" as any } });
      return { matterId: matter?.id ?? null, clientId: client.id, confidence: "HIGH" as any, method: "phone" };
    }
  }
  if (params.contactEmail) {
    const client = await db.client.findFirst({ where: { email: params.contactEmail } });
    if (client) {
      const matter = await db.matter.findFirst({ where: { clientId: client.id, status: "active" as any } });
      return { matterId: matter?.id ?? null, clientId: client.id, confidence: "HIGH" as any, method: "email" };
    }
  }
  if (params.subject) {
    const matter = await db.matter.findFirst({ where: { name: { contains: params.subject } } });
    if (matter) {
      return { matterId: matter.id, clientId: matter.clientId, confidence: "MEDIUM" as any, method: "subject" };
    }
  }
  return { matterId: null, clientId: null, confidence: "NONE" as any, method: null };
}

export async function matchContactToClient(params: { phone?: string; email?: string; name?: string }) {
  if (params.phone) {
    const client = await db.client.findFirst({ where: { phone: { contains: params.phone } } });
    if (client) return client.id;
  }
  if (params.email) {
    const client = await db.client.findFirst({ where: { email: params.email } });
    if (client) return client.id;
  }
  if (params.name) {
    const client = await db.client.findFirst({ where: { name: { contains: params.name } } });
    if (client) return client.id;
  }
  return null;
}

export async function generateSuggestions(eventId: string) {
  const event = await db.billableEvent.findUniqueOrThrow({ where: { id: eventId } });
  const prompt = `You are a legal billing assistant. Given this event, suggest a billing narrative, billable minutes, activity code, and whether it is billable. Event: ${JSON.stringify(event)}. Respond as JSON: { narrative, billableMinutes, activity, isBillable }`;
  const response = await aiRouter.complete({ feature: "swipe_to_bill", systemPrompt: "You are a legal billing assistant.", userPrompt: prompt });
  const suggestions = JSON.parse(response.content);
  await db.billableEvent.update({
    where: { id: eventId },
    data: {
      suggestedNarrative: suggestions.narrative,
      suggestedBillableMinutes: suggestions.billableMinutes,
      suggestedActivity: suggestions.activity,
      aiProcessed: true,
    },
  });
  return suggestions;
}

export function roundToIncrement(minutes: number, increment: number, rule: string): number {
  if (rule === "ROUND_UP") return Math.ceil(minutes / increment) * increment;
  if (rule === "ROUND_DOWN") return Math.floor(minutes / increment) * increment;
  if (rule === "ROUND_NEAREST") return Math.round(minutes / increment) * increment;
  return minutes;
}

export async function convertToTimeEntry(eventId: string, overrides?: any) {
  const event = await db.billableEvent.findUniqueOrThrow({ where: { id: eventId } });
  const duration = overrides?.duration ?? event.suggestedBillableMinutes;
  const description = overrides?.description ?? event.suggestedNarrative;
  const timeEntry = await db.timeEntry.create({
    data: {
      matterId: overrides?.matterId ?? event.matterId,
      userId: event.userId, duration, description,
      date: event.startTime, billable: true,
      ...(overrides?.activity ? { activity: overrides.activity } : {}),
      ...(overrides?.rate ? { rate: overrides.rate } : {}),
    },
  });
  await db.billableEvent.update({
    where: { id: eventId },
    data: { status: "BEVS_BILLED" as any, billedAt: new Date(), timeEntryId: timeEntry.id },
  });
  return timeEntry;
}

export async function dismissEvent(eventId: string, reason: string) {
  await db.billableEvent.update({
    where: { id: eventId },
    data: { status: "BEVS_DISMISSED" as any, dismissedAt: new Date(), dismissedReason: reason },
  });
}

export async function snoozeEvent(eventId: string) {
  const settings = await db.swipeToBillSettings.findFirst();
  const maxSnooze = settings?.maxSnoozeCount ?? 3;
  const snoozeMinutes = settings?.snoozeMinutes ?? 60;
  const event = await db.billableEvent.findUniqueOrThrow({ where: { id: eventId } });
  const newCount = (event.snoozeCount ?? 0) + 1;
  if (newCount >= maxSnooze) {
    await dismissEvent(eventId, "Max snooze count reached");
    return;
  }
  await db.billableEvent.update({
    where: { id: eventId },
    data: {
      snoozeCount: newCount,
      snoozedUntil: new Date(Date.now() + snoozeMinutes * 60 * 1000),
      status: "BEVS_SNOOZED" as any,
    },
  });
}

export async function expireStaleEvents() {
  const result = await db.billableEvent.updateMany({
    where: { status: "BEVS_PENDING" as any, expiresAt: { lt: new Date() } },
    data: { status: "BEVS_EXPIRED" as any },
  });
  return result.count;
}

export async function checkSnoozedEvents() {
  const result = await db.billableEvent.updateMany({
    where: { status: "BEVS_SNOOZED" as any, snoozedUntil: { lte: new Date() } },
    data: { status: "BEVS_PENDING" as any },
  });
  return result.count;
}

export async function processCalendarEvents() {
  return { created: 0 };
}

export async function getEventStats(userId: string, dateRange: { from: Date; to: Date }) {
  const where = { userId, startTime: { gte: dateRange.from, lte: dateRange.to } };
  const [pending, billed, dismissed, expired, snoozed] = await Promise.all([
    db.billableEvent.count({ where: { ...where, status: "BEVS_PENDING" as any } }),
    db.billableEvent.count({ where: { ...where, status: "BEVS_BILLED" as any } }),
    db.billableEvent.count({ where: { ...where, status: "BEVS_DISMISSED" as any } }),
    db.billableEvent.count({ where: { ...where, status: "BEVS_EXPIRED" as any } }),
    db.billableEvent.count({ where: { ...where, status: "BEVS_SNOOZED" as any } }),
  ]);
  const total = billed + dismissed + expired;
  const captureRate = total > 0 ? billed / total : 0;
  return { pending, billed, dismissed, expired, snoozed, captureRate };
}

export async function getPendingEvents(userId: string) {
  return db.billableEvent.findMany({
    where: {
      userId,
      OR: [
        { status: "BEVS_PENDING" as any },
        { status: "BEVS_SNOOZED" as any, snoozedUntil: { lte: new Date() } },
      ],
    },
    orderBy: [{ priority: "desc" }, { startTime: "desc" }],
    
  });
}

export async function getNotificationPayload(eventId: string) {
  const event = await db.billableEvent.findUniqueOrThrow({
    where: { id: eventId },
    
  });
  const durationMin = event.durationSeconds ? Math.round(event.durationSeconds / 60) : 0;
  const formatted = durationMin >= 60 ? `${Math.floor(durationMin / 60)}h ${durationMin % 60}m` : `${durationMin}m`;
  return {
    id: event.id, eventType: event.eventType, contactName: event.contactName,
    matterName: (event as any).matter?.name ?? null, duration: formatted,
    suggestedTime: event.suggestedBillableMinutes,
    narrativePreview: event.suggestedNarrative?.slice(0, 120) ?? null,
  };
}
