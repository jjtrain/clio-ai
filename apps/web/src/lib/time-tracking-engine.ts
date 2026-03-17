import { db } from "@/lib/db";

export function applyRoundingRule(durationSeconds: number, rule: string, increment: number): number {
  if (rule === "NONE" || !increment) return durationSeconds;
  const incSeconds = increment * 60;
  if (rule === "ROUND_UP") return Math.ceil(durationSeconds / incSeconds) * incSeconds;
  if (rule === "ROUND_DOWN") return Math.floor(durationSeconds / incSeconds) * incSeconds;
  if (rule === "ROUND_NEAREST") return Math.round(durationSeconds / incSeconds) * incSeconds;
  return durationSeconds;
}

export async function matchToMatter(entry: { description?: string; documentName?: string; emailSubject?: string; application?: string }) {
  // Check match rules first
  const rules = await db.timeMatchRule.findMany({ where: { isActive: true }, orderBy: { priority: "desc" } });
  for (const rule of rules) {
    const fieldValue = (entry as any)[rule.matchField] || "";
    if (!fieldValue) continue;
    try {
      if (new RegExp(rule.pattern, "i").test(fieldValue)) {
        return { matterId: rule.matterId, clientId: rule.clientId, confidence: "HIGH", method: `rule:${rule.ruleType}` };
      }
    } catch {
      if (fieldValue.toLowerCase().includes(rule.pattern.toLowerCase())) {
        return { matterId: rule.matterId, clientId: rule.clientId, confidence: "HIGH", method: `rule:${rule.ruleType}` };
      }
    }
  }

  // Fuzzy match against matter names
  const searchText = [entry.documentName, entry.emailSubject, entry.description].filter(Boolean).join(" ").toLowerCase();
  if (searchText) {
    const matters = await db.matter.findMany({ where: { status: "OPEN" }, include: { client: true }, take: 100 });
    for (const m of matters) {
      if (searchText.includes(m.name.toLowerCase()) || searchText.includes(m.matterNumber.toLowerCase())) {
        return { matterId: m.id, clientId: m.clientId, confidence: "HIGH", method: "matter_name" };
      }
      if (m.client && searchText.includes(m.client.name.toLowerCase())) {
        return { matterId: m.id, clientId: m.clientId, confidence: "MEDIUM", method: "client_name" };
      }
    }
  }

  return { matterId: null, clientId: null, confidence: "NONE", method: "no_match" };
}

export async function importEntries(provider: string, entries: any[]) {
  let total = 0, matched = 0, unmatched = 0, skipped = 0;

  const settings = await db.timeTrackingIntegration.findUnique({ where: { provider } });
  const roundingRule = settings?.roundingRule || "NONE";
  const roundingInc = settings?.roundingIncrement || 6;

  for (const e of entries) {
    const extId = e.id || e.entry_id || e.timeslip_id || String(Date.now() + Math.random());
    const existing = await db.externalTimeEntry.findFirst({ where: { provider, externalEntryId: extId } });
    if (existing) { skipped++; continue; }

    let duration = e.duration || e.duration_seconds || 0;
    if (typeof duration === "string") duration = parseInt(duration);
    duration = applyRoundingRule(duration, roundingRule, roundingInc);
    const hours = Math.round((duration / 3600) * 100) / 100;

    const match = await matchToMatter({ description: e.description || e.notes, documentName: e.document_name || e.document, emailSubject: e.email_subject || e.email, application: e.application || e.app });

    await db.externalTimeEntry.create({
      data: {
        provider, externalEntryId: extId,
        matterId: match.matterId, clientId: match.clientId,
        userId: e.user_id || e.userId, userName: e.user_name || e.userName,
        date: new Date(e.date || e.start_time || new Date()),
        startTime: e.start_time ? new Date(e.start_time) : undefined,
        endTime: e.end_time ? new Date(e.end_time) : undefined,
        duration, durationHours: hours,
        description: e.description || e.notes,
        activity: e.activity || e.tag || e.task,
        application: e.application || e.app,
        documentName: e.document_name || e.document,
        emailSubject: e.email_subject || e.email,
        website: e.website || e.url,
        source: e.source || "AUTOMATIC",
        billingStatus: "PENDING_REVIEW",
        matterMatchConfidence: match.confidence,
        matterMatchMethod: match.method,
        billingRate: settings?.defaultBillingRate ? Number(settings.defaultBillingRate) : undefined,
        billingAmount: settings?.defaultBillingRate ? Number(settings.defaultBillingRate) * hours : undefined,
        rawPayload: JSON.stringify(e),
      },
    });

    total++;
    if (match.matterId) matched++; else unmatched++;
  }

  return { total, matched, unmatched, skipped };
}

export async function syncToBuiltIn(externalEntryId: string) {
  const ext = await db.externalTimeEntry.findUniqueOrThrow({ where: { id: externalEntryId } });
  if (!ext.matterId) throw new Error("Entry must be assigned to a matter before syncing");

  const matter = await db.matter.findUniqueOrThrow({ where: { id: ext.matterId } });
  const users = await db.user.findMany({ take: 1 });
  const userId = users[0]?.id;
  if (!userId) throw new Error("No user found");

  const te = await db.timeEntry.create({
    data: {
      matterId: ext.matterId,
      userId,
      description: ext.adjustedDescription || ext.description || "Imported time entry",
      duration: Math.round((ext.adjustedDuration || ext.duration) / 60),
      date: ext.date,
      billable: ext.isBillable,
      rate: ext.billingRate,
    },
  });

  await db.externalTimeEntry.update({
    where: { id: externalEntryId },
    data: { timeEntryId: te.id, syncStatus: "SYNCED", billingStatus: "APPROVED" },
  });

  return te;
}

export async function getProductivityDashboard(dateRange: { from: string; to: string }, userId?: string) {
  const where: any = { date: { gte: new Date(dateRange.from), lte: new Date(dateRange.to) } };
  if (userId) where.userId = userId;

  const entries = await db.externalTimeEntry.findMany({ where });
  const totalSeconds = entries.reduce((s, e) => s + e.duration, 0);
  const billableSeconds = entries.filter((e) => e.isBillable).reduce((s, e) => s + e.duration, 0);
  const reviewed = entries.filter((e) => e.isReviewed).length;
  const unreviewed = entries.filter((e) => !e.isReviewed).length;

  const byApp: Record<string, number> = {};
  const byActivity: Record<string, number> = {};
  for (const e of entries) {
    if (e.application) byApp[e.application] = (byApp[e.application] || 0) + e.duration;
    if (e.activity) byActivity[e.activity] = (byActivity[e.activity] || 0) + e.duration;
  }

  const billingAmount = entries.reduce((s, e) => s + Number(e.billingAmount || 0), 0);

  return {
    totalHours: Math.round(totalSeconds / 36) / 100,
    billableHours: Math.round(billableSeconds / 36) / 100,
    billablePercentage: totalSeconds > 0 ? Math.round((billableSeconds / totalSeconds) * 1000) / 10 : 0,
    reviewed, unreviewed, billingAmount,
    byApplication: Object.entries(byApp).map(([app, secs]) => ({ app, hours: Math.round(secs / 36) / 100 })).sort((a, b) => b.hours - a.hours),
    byActivity: Object.entries(byActivity).map(([act, secs]) => ({ activity: act, hours: Math.round(secs / 36) / 100 })).sort((a, b) => b.hours - a.hours),
    entryCount: entries.length,
  };
}

export async function getCapturedVsBilled(dateRange: { from: string; to: string }) {
  const captured = await db.externalTimeEntry.findMany({ where: { date: { gte: new Date(dateRange.from), lte: new Date(dateRange.to) } } });
  const billed = await db.timeEntry.findMany({ where: { date: { gte: new Date(dateRange.from), lte: new Date(dateRange.to) }, billable: true } });

  const capturedHours = captured.reduce((s, e) => s + Number(e.durationHours), 0);
  const billedHours = billed.reduce((s, e) => s + e.duration / 60, 0);
  const leakageHours = Math.max(0, capturedHours - billedHours);

  return { capturedHours: Math.round(capturedHours * 10) / 10, billedHours: Math.round(billedHours * 10) / 10, leakageHours: Math.round(leakageHours * 10) / 10, leakagePercentage: capturedHours > 0 ? Math.round((leakageHours / capturedHours) * 1000) / 10 : 0 };
}
