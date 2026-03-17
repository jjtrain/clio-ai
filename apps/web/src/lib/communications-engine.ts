import { db } from "@/lib/db";

export async function getUnifiedInbox() {
  const urgentCalls = await db.callRecord.findMany({ where: { OR: [{ actionRequired: true, actionCompletedAt: null }, { isUrgent: true }] }, orderBy: { startedAt: "desc" }, take: 20 });
  const activeChats = await db.chatConversation.findMany({ where: { status: { in: ["ACTIVE", "WAITING"] } }, orderBy: { startedAt: "desc" }, take: 20 });
  const unreadMessages = await db.secureMessage.findMany({ where: { isRead: false, direction: "FROM_CLIENT" }, orderBy: { sentAt: "desc" }, take: 20 });

  const items: any[] = [
    ...urgentCalls.map((c) => ({ type: "call", provider: c.provider, id: c.id, title: c.callerName || c.callerPhone || "Unknown", preview: c.summary || c.actionDescription || "", time: c.startedAt, urgent: c.isUrgent, actionRequired: c.actionRequired })),
    ...activeChats.map((c) => ({ type: "chat", provider: c.provider, id: c.id, title: c.visitorName || "Visitor", preview: c.summary || "", time: c.startedAt, urgent: false, actionRequired: c.status === "WAITING" })),
    ...unreadMessages.map((m) => ({ type: "message", provider: m.provider, id: m.id, title: m.subject || "Secure Message", preview: m.body.slice(0, 100), time: m.sentAt, urgent: false, actionRequired: true })),
  ];

  return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
}

export async function getCallLog(params: { provider?: string; matterId?: string; clientId?: string; limit?: number }) {
  const where: any = {};
  if (params.provider) where.provider = params.provider;
  if (params.matterId) where.matterId = params.matterId;
  if (params.clientId) where.clientId = params.clientId;
  return db.callRecord.findMany({ where, orderBy: { startedAt: "desc" }, take: params.limit || 50 });
}

export async function matchCallerToClient(phone: string) {
  if (!phone) return null;
  const clean = phone.replace(/\D/g, "").slice(-10);
  const client = await db.client.findFirst({ where: { phone: { contains: clean } } });
  if (client) return { type: "client" as const, id: client.id, name: client.name };
  const lead = await db.lead.findFirst({ where: { phone: { contains: clean } } });
  if (lead) return { type: "lead" as const, id: lead.id, name: lead.name };
  return null;
}

export async function getProviderStats() {
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const calls = await db.callRecord.findMany({ where: { startedAt: { gte: monthStart } } });
  const chats = await db.chatConversation.findMany({ where: { startedAt: { gte: monthStart } } });

  const byProvider: Record<string, { calls: number; chats: number; avgDuration: number; leads: number }> = {};
  for (const c of calls) {
    if (!byProvider[c.provider]) byProvider[c.provider] = { calls: 0, chats: 0, avgDuration: 0, leads: 0 };
    byProvider[c.provider].calls++;
    if (c.disposition === "NEW_LEAD") byProvider[c.provider].leads++;
    byProvider[c.provider].avgDuration += c.duration || 0;
  }
  for (const c of chats) {
    if (!byProvider[c.provider]) byProvider[c.provider] = { calls: 0, chats: 0, avgDuration: 0, leads: 0 };
    byProvider[c.provider].chats++;
  }
  for (const p of Object.values(byProvider)) {
    if (p.calls > 0) p.avgDuration = Math.round(p.avgDuration / p.calls);
  }

  return { byProvider, totalCalls: calls.length, totalChats: chats.length, totalLeads: calls.filter((c) => c.disposition === "NEW_LEAD").length };
}
