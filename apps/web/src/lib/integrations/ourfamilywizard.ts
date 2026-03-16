import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getConfig() {
  const settings = await db.oFWSettings.findUnique({ where: { id: "default" } });
  if (!settings?.isEnabled || !settings?.apiKey) return null;
  return { baseUrl: settings.baseUrl || "https://api.ourfamilywizard.com/v1", apiKey: settings.apiKey, accountId: settings.accountId };
}

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export async function testConnection(): Promise<{ success: boolean; accountName?: string; error?: string }> {
  const config = await getConfig();
  if (!config) return { success: false, error: "OurFamilyWizard is not configured. Add API credentials in Settings → Integrations." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/account/verify`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `OFW API returned ${res.status}` };
    const data = await res.json();
    return { success: true, accountName: data.name || data.accountName || "Professional Account" };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function linkFamily(ofwFamilyId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "OFW not configured" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/families/${ofwFamilyId}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Family not found: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getExpenses(ofwFamilyId: string, dateRange?: { from: string; to: string }) {
  const config = await getConfig();
  if (!config) return [];
  try {
    const params = new URLSearchParams();
    if (dateRange?.from) params.set("from", dateRange.from);
    if (dateRange?.to) params.set("to", dateRange.to);
    const res = await makeApiCall(`${config.baseUrl}/families/${ofwFamilyId}/expenses?${params}`, { headers: headers(config.apiKey) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.expenses || data || []).map((e: any) => ({
      ofwExpenseId: e.id, category: e.category || "Other", description: e.description || "",
      amount: Number(e.amount || 0), paidBy: e.paid_by === "parent2" ? "PARENT2" : "PARENT1",
      dateIncurred: new Date(e.date || e.date_incurred), reimbursementStatus: (e.reimbursement_status || "PENDING").toUpperCase(),
      reimbursementAmount: e.reimbursement_amount ? Number(e.reimbursement_amount) : null,
      receiptUrl: e.receipt_url, ofwNotes: e.notes,
    }));
  } catch { return []; }
}

export async function getMessages(ofwFamilyId: string, dateRange?: { from: string; to: string }) {
  const config = await getConfig();
  if (!config) return [];
  try {
    const params = new URLSearchParams();
    if (dateRange?.from) params.set("from", dateRange.from);
    if (dateRange?.to) params.set("to", dateRange.to);
    const res = await makeApiCall(`${config.baseUrl}/families/${ofwFamilyId}/messages?${params}`, { headers: headers(config.apiKey) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.messages || data || []).map((m: any) => ({
      ofwMessageId: m.id, fromParent: m.from === "parent2" ? "PARENT2" : "PARENT1",
      toParent: m.to === "parent2" ? "PARENT2" : "PARENT1",
      subject: m.subject, body: m.body || m.content || "",
      sentAt: new Date(m.sent_at || m.date), isRead: m.is_read ?? false,
      hasAttachments: m.has_attachments ?? false, attachmentUrls: m.attachment_urls ? JSON.stringify(m.attachment_urls) : null,
    }));
  } catch { return []; }
}

export async function getSchedule(ofwFamilyId: string, dateRange: { from: string; to: string }) {
  const config = await getConfig();
  if (!config) return [];
  try {
    const res = await makeApiCall(`${config.baseUrl}/families/${ofwFamilyId}/calendar?from=${dateRange.from}&to=${dateRange.to}`, { headers: headers(config.apiKey) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.events || data || []).map((e: any) => ({
      ofwEventId: e.id, title: e.title || e.name || "Custody",
      startDate: new Date(e.start_date || e.start), endDate: new Date(e.end_date || e.end),
      assignedParent: e.assigned_parent === "parent2" ? "PARENT2" : "PARENT1",
      eventType: e.event_type || e.type || "Regular Custody",
      location: e.location, isOvernight: e.is_overnight ?? false,
      notes: e.notes, wasModified: e.was_modified ?? false, modificationReason: e.modification_reason,
    }));
  } catch { return []; }
}

export async function getJournalEntries(ofwFamilyId: string, dateRange?: { from: string; to: string }) {
  const config = await getConfig();
  if (!config) return [];
  try {
    const params = new URLSearchParams();
    if (dateRange?.from) params.set("from", dateRange.from);
    if (dateRange?.to) params.set("to", dateRange.to);
    const res = await makeApiCall(`${config.baseUrl}/families/${ofwFamilyId}/journal?${params}`, { headers: headers(config.apiKey) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.entries || data || []).map((j: any) => ({
      ofwJournalId: j.id, author: j.author === "parent2" ? "PARENT2" : "PARENT1",
      entryDate: new Date(j.date || j.entry_date), content: j.content || j.body || "",
      category: j.category, attachmentUrls: j.attachment_urls ? JSON.stringify(j.attachment_urls) : null,
    }));
  } catch { return []; }
}

export async function syncAllData(connectionId: string, dateRange?: { from: string; to: string }) {
  const conn = await db.oFWConnection.findUniqueOrThrow({ where: { id: connectionId } });
  if (!conn.ofwFamilyId) return { expensesImported: 0, messagesImported: 0, eventsImported: 0, journalEntriesImported: 0 };

  const range = dateRange || {
    from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
  };

  let expensesImported = 0, messagesImported = 0, eventsImported = 0, journalEntriesImported = 0;

  // Expenses
  const expenses = await getExpenses(conn.ofwFamilyId, range);
  for (const e of expenses) {
    const existing = e.ofwExpenseId ? await db.oFWExpenseRecord.findFirst({ where: { connectionId, ofwExpenseId: e.ofwExpenseId } }) : null;
    if (!existing) {
      await db.oFWExpenseRecord.create({ data: { connectionId, familyCaseId: conn.familyCaseId, ...e } });
      expensesImported++;
    }
  }

  // Messages
  const messages = await getMessages(conn.ofwFamilyId, range);
  for (const m of messages) {
    const existing = m.ofwMessageId ? await db.oFWMessage.findFirst({ where: { connectionId, ofwMessageId: m.ofwMessageId } }) : null;
    if (!existing) {
      await db.oFWMessage.create({ data: { connectionId, familyCaseId: conn.familyCaseId, ...m } });
      messagesImported++;
    }
  }

  // Schedule
  const events = await getSchedule(conn.ofwFamilyId, range);
  for (const e of events) {
    const existing = e.ofwEventId ? await db.oFWScheduleEvent.findFirst({ where: { connectionId, ofwEventId: e.ofwEventId } }) : null;
    if (!existing) {
      await db.oFWScheduleEvent.create({ data: { connectionId, familyCaseId: conn.familyCaseId, ...e } });
      eventsImported++;
    }
  }

  // Journal
  const journal = await getJournalEntries(conn.ofwFamilyId, range);
  for (const j of journal) {
    const existing = j.ofwJournalId ? await db.oFWJournalEntry.findFirst({ where: { connectionId, ofwJournalId: j.ofwJournalId } }) : null;
    if (!existing) {
      await db.oFWJournalEntry.create({ data: { connectionId, familyCaseId: conn.familyCaseId, ...j } });
      journalEntriesImported++;
    }
  }

  await db.oFWConnection.update({ where: { id: connectionId }, data: { lastDataPull: new Date() } });

  return { expensesImported, messagesImported, eventsImported, journalEntriesImported };
}

export function calculateOvernights(events: Array<{ startDate: Date; endDate: Date; assignedParent: string; isOvernight: boolean }>) {
  let parent1 = 0, parent2 = 0;
  for (const e of events) {
    if (!e.isOvernight) continue;
    const nights = Math.max(1, Math.ceil((new Date(e.endDate).getTime() - new Date(e.startDate).getTime()) / (1000 * 60 * 60 * 24)));
    if (e.assignedParent === "PARENT1") parent1 += nights;
    else parent2 += nights;
  }
  const total = parent1 + parent2;
  return {
    parent1Overnights: parent1, parent2Overnights: parent2, totalNights: total,
    parent1Percentage: total > 0 ? Math.round((parent1 / total) * 1000) / 10 : 0,
    parent2Percentage: total > 0 ? Math.round((parent2 / total) * 1000) / 10 : 0,
  };
}
