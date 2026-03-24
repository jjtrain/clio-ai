import { db } from "@/lib/db";

interface AgingBucket {
  label: string;
  minDays: number;
  maxDays: number | null;
  invoices: any[];
  totalOutstanding: number;
  count: number;
}

const STAGES = [
  { stage: "REMINDER_30", minDays: 30, label: "30-Day Reminder" },
  { stage: "REMINDER_60", minDays: 60, label: "60-Day Reminder" },
  { stage: "DEMAND_90", minDays: 90, label: "90-Day Demand" },
  { stage: "COLLECTIONS", minDays: 120, label: "Collections" },
] as const;

export async function getAgingBuckets(firmId: string): Promise<AgingBucket[]> {
  const now = new Date();

  const unpaid = await db.invoice.findMany({
    where: { status: { in: ["SENT", "OVERDUE"] }, matter: { client: { isNot: undefined } } },
    include: { matter: { select: { name: true, client: { select: { name: true, email: true } } } } },
  });

  const buckets: AgingBucket[] = [
    { label: "Current", minDays: 0, maxDays: 30, invoices: [], totalOutstanding: 0, count: 0 },
    { label: "31–60 Days", minDays: 31, maxDays: 60, invoices: [], totalOutstanding: 0, count: 0 },
    { label: "61–90 Days", minDays: 61, maxDays: 90, invoices: [], totalOutstanding: 0, count: 0 },
    { label: "90+ Days", minDays: 91, maxDays: null, invoices: [], totalOutstanding: 0, count: 0 },
  ];

  for (const inv of unpaid) {
    const outstanding = Number(inv.total) - Number(inv.amountPaid);
    if (outstanding <= 0) continue;

    const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000);
    const enriched = { ...inv, daysOverdue, outstanding, clientName: inv.matter?.client?.name, matterName: inv.matter?.name, clientEmail: inv.matter?.client?.email };

    for (const bucket of buckets) {
      if (daysOverdue >= bucket.minDays && (bucket.maxDays === null || daysOverdue <= bucket.maxDays)) {
        bucket.invoices.push(enriched);
        bucket.totalOutstanding += outstanding;
        bucket.count++;
        break;
      }
    }
  }

  return buckets;
}

export async function getEscalationQueue(firmId: string): Promise<any[]> {
  const now = new Date();
  const queue: any[] = [];

  const unpaid = await db.invoice.findMany({
    where: { status: { in: ["SENT", "OVERDUE"] } },
    include: { matter: { select: { name: true, client: { select: { name: true, email: true } } } } },
  });

  for (const inv of unpaid) {
    const outstanding = Number(inv.total) - Number(inv.amountPaid);
    if (outstanding <= 0) continue;

    const daysOverdue = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86400000);
    const currentStage = inv.escalationStage;

    // Determine next escalation stage
    for (const stageConfig of STAGES) {
      if (daysOverdue >= stageConfig.minDays) {
        // Check if this stage was already sent
        if (currentStage === stageConfig.stage) continue;

        // Check ordering: only escalate if current stage is lower
        const currentIdx = STAGES.findIndex((s) => s.stage === currentStage);
        const targetIdx = STAGES.findIndex((s) => s.stage === stageConfig.stage);
        if (currentIdx >= targetIdx) continue;

        queue.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          daysOverdue,
          outstanding,
          clientName: inv.matter?.client?.name,
          clientEmail: inv.matter?.client?.email,
          matterName: inv.matter?.name,
          currentStage: currentStage || "NONE",
          nextStage: stageConfig.stage,
          nextStageLabel: stageConfig.label,
        });
        break; // only queue the next escalation, not all
      }
    }
  }

  return queue.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

export async function executeEscalation(invoiceId: string, stage: string, firmId: string, sentBy?: string): Promise<any> {
  const inv = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { matter: { select: { name: true, client: { select: { name: true, email: true } } } } },
  });
  if (!inv) throw new Error("Invoice not found");

  const outstanding = Number(inv.total) - Number(inv.amountPaid);
  const clientName = inv.matter?.client?.name || "Client";
  const clientEmail = inv.matter?.client?.email;

  let subject = "";
  let body = "";
  let method = "email";

  switch (stage) {
    case "REMINDER_30":
      subject = `Friendly Reminder: Invoice ${inv.invoiceNumber} — $${outstanding.toFixed(2)} Outstanding`;
      body = `Dear ${clientName},\n\nThis is a friendly reminder that Invoice ${inv.invoiceNumber} for $${outstanding.toFixed(2)} is now past due. We'd appreciate your prompt attention.\n\nYou can pay online through your client portal or contact our office to discuss payment options.\n\nThank you for your continued trust in our firm.`;
      break;
    case "REMINDER_60":
      subject = `Second Notice: Invoice ${inv.invoiceNumber} — $${outstanding.toFixed(2)} Past Due (60 Days)`;
      body = `Dear ${clientName},\n\nThis is a follow-up regarding Invoice ${inv.invoiceNumber} for $${outstanding.toFixed(2)}, which is now 60 days past due.\n\nIf you are experiencing financial difficulty, we would be happy to arrange a payment plan. Please contact our office or set up a payment plan through your portal.\n\nPrompt resolution will help us avoid additional collection measures.`;
      break;
    case "DEMAND_90":
      subject = `FORMAL DEMAND: Invoice ${inv.invoiceNumber} — $${outstanding.toFixed(2)} (90+ Days Overdue)`;
      body = `Dear ${clientName},\n\nDespite previous reminders, Invoice ${inv.invoiceNumber} in the amount of $${outstanding.toFixed(2)} remains unpaid after 90 days.\n\nThis letter constitutes a formal demand for payment within 10 business days. Failure to remit payment or contact our office to make arrangements may result in this matter being referred for collection.\n\nPlease treat this matter as urgent.`;
      method = "letter";
      break;
    case "COLLECTIONS":
      subject = `Final Notice Before Collections: Invoice ${inv.invoiceNumber}`;
      body = `Dear ${clientName},\n\nThis is your final notice regarding Invoice ${inv.invoiceNumber} ($${outstanding.toFixed(2)}). Without payment or a payment arrangement within 5 business days, this account will be referred to a collection agency.\n\nPlease contact our office immediately.`;
      method = "letter";
      break;
  }

  // Record escalation
  const escalation = await db.receivableEscalation.create({
    data: { invoiceId, firmId, stage, method, subject, body, sentBy },
  });

  // Update invoice
  await db.invoice.update({
    where: { id: invoiceId },
    data: { escalationStage: stage, lastEscalationAt: new Date(), status: "OVERDUE" },
  });

  return escalation;
}

export async function processAllDueEscalations(firmId: string): Promise<{ processed: number; sent: number }> {
  const queue = await getEscalationQueue(firmId);
  let sent = 0;

  for (const item of queue) {
    try {
      await executeEscalation(item.invoiceId, item.nextStage, firmId, "system");
      sent++;
    } catch {
      // Log but continue
    }
  }

  return { processed: queue.length, sent };
}

export async function getEscalationHistory(invoiceId: string): Promise<any[]> {
  return db.receivableEscalation.findMany({
    where: { invoiceId },
    orderBy: { sentAt: "desc" },
  });
}
