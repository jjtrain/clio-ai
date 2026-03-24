import { db } from "@/lib/db";

export async function calculateCandidates(firmId: string): Promise<number> {
  const matters = await db.matter.findMany({
    where: { status: "OPEN" },
    include: { client: true, timeEntries: { where: { billable: true, invoiceLineItemId: null } } },
  });

  let count = 0;
  for (const matter of matters) {
    const unbilledHours = matter.timeEntries.reduce((s, e) => s + (e.hours || e.duration / 60), 0);
    const unbilledAmount = matter.timeEntries.reduce((s, e) => s + ((e.hours || e.duration / 60) * Number(e.rate || 350)), 0);

    if (unbilledAmount < 50 && unbilledHours < 0.5) continue;

    // Check last invoice date
    const lastInvoice = await db.generatedInvoice.findFirst({
      where: { matterId: matter.id }, orderBy: { createdAt: "desc" },
    });
    const daysSince = lastInvoice ? Math.ceil((Date.now() - lastInvoice.createdAt.getTime()) / 86400000) : 999;

    // Check trust balance
    const trustLedger = await db.trustClientLedger.findFirst({ where: { matterId: matter.id, status: "active" } });
    const trustBalance = trustLedger?.currentBalance || 0;

    // Determine priority
    let priority = 5;
    if (unbilledAmount > 5000) priority += 2;
    if (daysSince > 30) priority += 2;
    if (daysSince > 60) priority += 1;

    const isOneTapReady = unbilledAmount > 0 && daysSince > 7;

    await db.quickInvoiceCandidate.upsert({
      where: { matterId_firmId: { matterId: matter.id, firmId } },
      create: {
        matterId: matter.id, matterName: matter.name, clientName: matter.client?.name,
        practiceArea: matter.practiceArea, unbilledAmount, unbilledHours, unbilledExpenses: 0,
        daysSinceLastInvoice: daysSince, trustBalance: Number(trustBalance),
        isOneTapReady, priority: Math.min(priority, 10), firmId,
      },
      update: { unbilledAmount, unbilledHours, daysSinceLastInvoice: daysSince, trustBalance: Number(trustBalance), isOneTapReady, priority: Math.min(priority, 10), lastCalculatedAt: new Date() },
    });
    count++;
  }
  return count;
}

export async function quickGenerateInvoice(params: {
  matterId: string; presetId?: string; customNote?: string;
  applyTrustCredit?: boolean; sendMethod?: string[]; userId: string; firmId: string;
}): Promise<any> {
  const startTime = Date.now();

  const matter = await db.matter.findUnique({ where: { id: params.matterId }, include: { client: true } });
  if (!matter) throw new Error("Matter not found");

  // Get unbilled entries
  const entries = await db.timeEntry.findMany({
    where: { matterId: params.matterId, billable: true, invoiceLineItemId: null },
  });

  const hours = entries.reduce((s, e) => s + (e.hours || e.duration / 60), 0);
  const amount = entries.reduce((s, e) => s + ((e.hours || e.duration / 60) * Number(e.rate || 350)), 0);

  // Get trust balance
  let trustCredit = 0;
  if (params.applyTrustCredit) {
    const ledger = await db.trustClientLedger.findFirst({ where: { matterId: params.matterId, status: "active" } });
    if (ledger) trustCredit = Math.min(Number(ledger.currentBalance), amount);
  }

  const amountDue = amount - trustCredit;
  const generatedInSeconds = Math.round((Date.now() - startTime) / 1000);

  // Create quick invoice record
  const qi = await db.quickInvoice.create({
    data: {
      matterId: params.matterId, matterName: matter.name, clientName: matter.client?.name,
      clientEmail: matter.client?.email, presetId: params.presetId,
      amount, hours, trustCreditApplied: trustCredit, amountDue,
      description: `${matter.name} — ${hours.toFixed(1)} hours`,
      customNote: params.customNote, sendMethod: params.sendMethod || ["portal", "email"],
      generatedInSeconds, source: "quick_mobile",
      status: "sent", sentAt: new Date(),
      userId: params.userId, firmId: params.firmId,
    },
  });

  // Update preset usage
  if (params.presetId) {
    await db.quickInvoicePreset.update({
      where: { id: params.presetId },
      data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
    }).catch(() => {});
  }

  return qi;
}

export async function getInvoiceStats(firmId: string) {
  const thisMonth = new Date(); thisMonth.setDate(1); thisMonth.setHours(0, 0, 0, 0);

  const monthlyInvoices = await db.quickInvoice.findMany({ where: { firmId, createdAt: { gte: thisMonth } } });
  const totalAmount = monthlyInvoices.reduce((s, i) => s + i.amountDue, 0);
  const avgSeconds = monthlyInvoices.length > 0 ? Math.round(monthlyInvoices.reduce((s, i) => s + (i.generatedInSeconds || 0), 0) / monthlyInvoices.length) : 0;
  const fastest = monthlyInvoices.length > 0 ? Math.min(...monthlyInvoices.map((i) => i.generatedInSeconds || 999)) : 0;

  const candidates = await db.quickInvoiceCandidate.findMany({ where: { firmId } });
  const totalUnbilled = candidates.reduce((s, c) => s + c.unbilledAmount, 0);
  const oneTapReady = candidates.filter((c) => c.isOneTapReady).length;

  return { monthlyCount: monthlyInvoices.length, totalAmount, avgSeconds, fastest, totalUnbilled, candidateCount: candidates.length, oneTapReady };
}
