import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

let invoiceCounter = 1000;

export async function generateInvoice(params: {
  matterId: string; periodStart: Date; periodEnd: Date; templateId?: string;
  includeExpenses?: boolean; customNotes?: string; userId: string; firmId: string;
}): Promise<any> {
  const matter = await db.matter.findUnique({ where: { id: params.matterId }, include: { client: true } });
  if (!matter) throw new Error("Matter not found");

  // Find best template
  let template = params.templateId
    ? await db.invoicingTemplate.findUnique({ where: { id: params.templateId } })
    : await db.invoicingTemplate.findFirst({ where: { practiceArea: matter.practiceArea || "", isDefault: true, isActive: true } });

  // Get unbilled time entries for period
  const entries = await db.timeEntry.findMany({
    where: { matterId: params.matterId, date: { gte: params.periodStart, lte: params.periodEnd }, billable: true, invoiceLineItemId: null },
    include: { user: { select: { name: true } } },
    orderBy: { date: "asc" },
  });

  const lineItems = entries.map((e) => ({
    type: "time_entry",
    date: e.date,
    attorney: e.user?.name || "Attorney",
    description: e.description,
    hours: e.hours || e.duration / 60,
    rate: e.rate ? Number(e.rate) : 350,
    amount: (e.hours || e.duration / 60) * (e.rate ? Number(e.rate) : 350),
    taskCategory: e.taskCategory,
    entryId: e.id,
  }));

  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const totalHours = lineItems.reduce((sum, li) => sum + li.hours, 0);

  // Get expenses
  let expenseTotal = 0;
  if (params.includeExpenses !== false) {
    const expenses = await db.expense.findMany({
      where: { matterId: params.matterId, isBillable: true },
    });
    expenseTotal = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    for (const exp of expenses) {
      lineItems.push({
        type: "expense",
        date: exp.date,
        attorney: "",
        description: exp.description,
        hours: 0,
        rate: 0,
        amount: Number(exp.amount),
        taskCategory: "expense",
        entryId: exp.id,
      });
    }
  }

  // Generate invoice
  invoiceCounter++;
  const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoiceCounter).padStart(4, "0")}`;
  const dueDate = new Date(params.periodEnd);
  dueDate.setDate(dueDate.getDate() + 30);

  const invoice = await db.generatedInvoice.create({
    data: {
      invoiceNumber,
      matterId: params.matterId,
      matterName: matter.name,
      clientName: matter.client?.name || "Client",
      clientEmail: matter.client?.email,
      templateId: template?.id,
      templateName: template?.name,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      dueDate,
      lineItems: lineItems as any,
      subtotal,
      expenseTotal,
      totalDue: subtotal + expenseTotal,
      totalHours,
      billingModel: template?.billingModel,
      practiceArea: matter.practiceArea,
      customNotes: params.customNotes,
      userId: params.userId,
      firmId: params.firmId,
    },
  });

  return invoice;
}

export async function generateBatch(params: {
  batchName: string; periodStart: Date; periodEnd: Date;
  filterCriteria?: any; sendMethod?: string; userId: string; firmId: string;
}): Promise<any> {
  // Find eligible matters
  const where: any = { status: "OPEN" };
  if (params.filterCriteria?.practiceAreas) {
    where.practiceArea = { in: params.filterCriteria.practiceAreas };
  }

  const matters = await db.matter.findMany({
    where,
    include: { client: true },
    take: 100,
  });

  const batch = await db.invoiceBatch.create({
    data: {
      batchName: params.batchName,
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      filterCriteria: params.filterCriteria,
      sendMethod: params.sendMethod,
      totalItems: matters.length,
      status: "review",
      userId: params.userId,
      firmId: params.firmId,
    },
  });

  // Generate invoice for each matter
  for (const matter of matters) {
    try {
      const invoice = await generateInvoice({
        matterId: matter.id,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        userId: params.userId,
        firmId: params.firmId,
      });

      await db.invoiceBatchItem.create({
        data: {
          batchId: batch.id,
          invoiceId: invoice.id,
          matterId: matter.id,
          matterName: matter.name,
          clientName: matter.client?.name,
          amount: invoice.totalDue,
          hours: invoice.totalHours,
          status: "generated",
          userId: params.userId,
          firmId: params.firmId,
        },
      });
    } catch {
      // Skip matters with no billable entries
    }
  }

  // Update batch totals
  const items = await db.invoiceBatchItem.findMany({ where: { batchId: batch.id } });
  await db.invoiceBatch.update({
    where: { id: batch.id },
    data: { totalItems: items.length, totalAmount: items.reduce((sum, i) => sum + i.amount, 0) },
  });

  return batch;
}

export async function enhanceDescriptions(invoiceId: string): Promise<void> {
  const invoice = await db.generatedInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) return;

  const lineItems = invoice.lineItems as any[];
  const timeItems = lineItems.filter((li) => li.type === "time_entry");
  if (timeItems.length === 0) return;

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: "Rewrite these legal time entry descriptions for client presentation. Remove internal jargon, be specific but professional. Return JSON array of { entryId, enhanced }.",
      messages: [{ role: "user", content: JSON.stringify(timeItems.map((t) => ({ entryId: t.entryId, description: t.description }))) }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "[]";
    const enhanced = JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || "[]");

    for (const e of enhanced) {
      const item = lineItems.find((li) => li.entryId === e.entryId);
      if (item) item.description = e.enhanced;
    }

    await db.generatedInvoice.update({ where: { id: invoiceId }, data: { lineItems: lineItems as any } });
  } catch {}
}

export async function processScheduledInvoicing(firmId: string, userId: string): Promise<number> {
  const now = new Date();
  const dueSchedules = await db.invoiceSchedule.findMany({
    where: { firmId, isActive: true, nextRunAt: { lte: now } },
  });

  let processed = 0;
  for (const schedule of dueSchedules) {
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0); // last day of previous month
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1); // first day of previous month

    await generateBatch({
      batchName: `${schedule.name} — ${periodStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
      periodStart,
      periodEnd,
      filterCriteria: schedule.filterCriteria,
      sendMethod: schedule.sendMethod || undefined,
      userId,
      firmId,
    });

    // Update next run
    const nextRun = new Date(now);
    if (schedule.scheduleType === "monthly") nextRun.setMonth(nextRun.getMonth() + 1);
    else if (schedule.scheduleType === "quarterly") nextRun.setMonth(nextRun.getMonth() + 3);
    nextRun.setDate(schedule.dayOfMonth);

    await db.invoiceSchedule.update({
      where: { id: schedule.id },
      data: { lastRunAt: now, nextRunAt: nextRun },
    });

    processed++;
  }

  return processed;
}
