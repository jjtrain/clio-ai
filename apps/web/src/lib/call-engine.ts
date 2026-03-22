import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

export async function initiateCall(params: { phone: string; userId: string; direction?: string; matterId?: string }) {
  const client = await db.client.findFirst({ where: { phone: { contains: params.phone } } });
  const matter = client ? await db.matter.findFirst({ where: { clientId: client.id, status: "active" as any } }) : null;
  const callLog = await db.callLog.create({
    data: {
      userId: params.userId, contactPhone: params.phone, contactName: client?.name ?? "Unknown",
      clientId: client?.id ?? null, matterId: params.matterId ?? matter?.id ?? null,
      direction: params.direction ?? "OUTBOUND", callStarted: new Date(), callStatus: "CLS_INITIATED" as any,
      billingStatus: "CBS_UNBILLED" as any,
    } as any,
  });
  return { callLogId: callLog.id, telUri: `tel:${params.phone}`, contactName: client?.name ?? "Unknown", matterId: matter?.id ?? null, clientId: client?.id ?? null };
}

export async function startCallTimer(callLogId: string) {
  await db.callLog.update({ where: { id: callLogId }, data: { callStatus: "CLS_IN_PROGRESS" as any, callStarted: new Date() } });
}

export async function endCall(callLogId: string, params: { callDuration: number; callStatus: string; notes?: string; subject?: string }) {
  await db.callLog.update({
    where: { id: callLogId },
    data: { callEnded: new Date(), callDuration: params.callDuration, callStatus: params.callStatus as any, notes: params.notes, subject: params.subject } as any,
  });
  if (params.callStatus === "COMPLETED" && params.callDuration > 0) {
    await generateCallNarrative(callLogId);
  }
}

export async function generateCallNarrative(callLogId: string) {
  const call = await db.callLog.findUniqueOrThrow({ where: { id: callLogId } });
  const prompt = `You are a legal billing assistant. Generate a billing narrative for a phone call.\nContact: ${(call as any).contactName}\nDuration: ${(call as any).callDuration}s\nNotes: ${(call as any).notes ?? "None"}\nSubject: ${(call as any).subject ?? "General"}\nReturn JSON: { "narrative": "...", "billableMinutes": number, "activity": "...", "followUpSuggested": boolean }`;
  const result = await aiRouter.complete({ feature: "tap_to_call", systemPrompt: "You are a legal billing assistant.", userPrompt: prompt });
  const parsed = JSON.parse(result.content);
  await db.callLog.update({
    where: { id: callLogId },
    data: { aiNarrative: parsed.narrative, suggestedBillableMinutes: parsed.billableMinutes, suggestedActivity: parsed.activity, followUpRequired: parsed.followUpSuggested } as any,
  });
  return parsed;
}

export async function createTimeEntryFromCall(callLogId: string, overrides?: { duration?: number; description?: string }) {
  const call = await db.callLog.findUniqueOrThrow({ where: { id: callLogId } });
  const entry = await db.timeEntry.create({
    data: {
      matterId: (call as any).matterId, userId: (call as any).userId,
      duration: overrides?.duration ?? (call as any).suggestedBillableMinutes ?? 6,
      description: overrides?.description ?? (call as any).aiNarrative ?? "Phone call",
      date: (call as any).callStarted, billable: true, callLogId: call.id,
    } as any,
  });
  await db.callLog.update({ where: { id: callLogId }, data: { billingStatus: "CBS_DRAFT_CREATED" as any, timeEntryId: entry.id } as any });
  return entry;
}

export async function createFollowUpTask(callLogId: string, params?: { title?: string; dueDate?: Date; notes?: string }) {
  const call = await db.callLog.findUniqueOrThrow({ where: { id: callLogId } });
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const task = await db.task.create({
    data: {
      title: params?.title ?? `Follow up: call with ${(call as any).contactName}`,
      matterId: (call as any).matterId, userId: (call as any).userId,
      dueDate: params?.dueDate ?? tomorrow, status: "NOT_STARTED" as any,
      notes: params?.notes ?? (call as any).aiNarrative,
    } as any,
  });
  await db.callLog.update({ where: { id: callLogId }, data: { followUpTaskId: task.id } as any });
  return task;
}

export async function matchPhoneToContact(phone: string) {
  const client = await db.client.findFirst({ where: { phone: { contains: phone } } });
  if (!client) return null;
  const matters = await db.matter.findMany({ where: { clientId: client.id, status: "active" as any } });
  return { clientId: client.id, contactName: client.name, contactRole: "CCR_CLIENT", matters };
}

export function roundDuration(seconds: number, increment: number = 6, rule: string = "round_up") {
  let minutes = seconds / 60;
  if (rule === "round_up") minutes = Math.ceil(minutes / increment) * increment;
  else if (rule === "round_down") minutes = Math.floor(minutes / increment) * increment;
  else minutes = Math.round(minutes / increment) * increment;
  return Math.max(6, minutes);
}

export async function getRecentCalls(userId: string, limit?: number) {
  return db.callLog.findMany({ where: { userId }, orderBy: { callStarted: "desc" } as any, take: limit ?? 10 });
}

export async function getCallStats(userId: string, dateRange: { start: Date; end: Date }) {
  const where = { userId, callStarted: { gte: dateRange.start, lte: dateRange.end } } as any;
  const [total, completed, totalDuration, unbilled, billed] = await Promise.all([
    db.callLog.count({ where }),
    db.callLog.count({ where: { ...where, callStatus: "CLS_COMPLETED" as any } }),
    db.callLog.aggregate({ where, _sum: { callDuration: true } } as any),
    db.callLog.count({ where: { ...where, billingStatus: "CBS_UNBILLED" as any } }),
    db.callLog.count({ where: { ...where, billingStatus: "CBS_DRAFT_CREATED" as any } }),
  ]);
  return { total, completed, totalDuration: (totalDuration as any)._sum?.callDuration ?? 0, unbilled, billed };
}

export async function processPostCallNotes(callLogId: string, notes: string) {
  const prompt = `Extract key topics, dates, and action items from these call notes. Return JSON: { "topics": [], "dates": [], "actionItems": [], "followUpRequired": boolean, "followUpDate": "ISO date or null" }\nNotes: ${notes}`;
  const result = await aiRouter.complete({ feature: "tap_to_call", systemPrompt: "You are a legal billing assistant.", userPrompt: prompt });
  const parsed = JSON.parse(result.content);
  await db.callLog.update({
    where: { id: callLogId },
    data: { notes, aiTopics: parsed.topics, aiActionItems: parsed.actionItems, followUpRequired: parsed.followUpRequired, followUpDate: parsed.followUpDate ? new Date(parsed.followUpDate) : null } as any,
  });
  return parsed;
}
