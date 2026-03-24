import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { generateInvoice, generateBatch, enhanceDescriptions, processScheduledInvoicing } from "@/lib/invoicing-engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const invoicingRouter = router({
  // TEMPLATES
  getTemplates: publicProcedure.input(z.object({ practiceArea: z.string().optional(), billingModel: z.string().optional(), isActive: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { OR: [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }] };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      if (input.billingModel) where.billingModel = input.billingModel;
      if (input.isActive !== undefined) where.isActive = input.isActive;
      return ctx.db.invoicingTemplate.findMany({ where, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
    }),

  getTemplate: publicProcedure.input(z.object({ templateId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.invoicingTemplate.findUnique({ where: { id: input.templateId } });
  }),

  createTemplate: publicProcedure.input(z.object({ name: z.string(), practiceArea: z.string(), billingModel: z.string().optional(), layout: z.string().optional(), headerConfig: z.any().optional(), lineItemConfig: z.any().optional(), summaryConfig: z.any().optional(), expenseConfig: z.any().optional(), trustConfig: z.any().optional(), footerConfig: z.any().optional(), styleConfig: z.any().optional(), isDefault: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.invoicingTemplate.create({ data: { ...input, isActive: true, firmId: DEFAULT_FIRM_ID } });
    }),

  updateTemplate: publicProcedure.input(z.object({ templateId: z.string(), name: z.string().optional(), lineItemConfig: z.any().optional(), styleConfig: z.any().optional(), isDefault: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => { const { templateId, ...data } = input; return ctx.db.invoicingTemplate.update({ where: { id: templateId }, data }); }),

  // INVOICE GENERATION
  generateInvoice: publicProcedure
    .input(z.object({ matterId: z.string(), periodStart: z.date(), periodEnd: z.date(), templateId: z.string().optional(), includeExpenses: z.boolean().optional(), customNotes: z.string().optional() }))
    .mutation(async ({ input }) => { return generateInvoice({ ...input, userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID }); }),

  getInvoice: publicProcedure.input(z.object({ invoiceId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.generatedInvoice.findUnique({ where: { id: input.invoiceId } });
  }),

  getInvoices: publicProcedure.input(z.object({ matterId: z.string().optional(), status: z.string().optional(), batchId: z.string().optional(), limit: z.number().optional().default(30) }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.matterId) where.matterId = input.matterId;
      if (input.status) where.status = input.status;
      if (input.batchId) where.batchId = input.batchId;
      return ctx.db.generatedInvoice.findMany({ where, orderBy: { createdAt: "desc" }, take: input.limit });
    }),

  updateInvoice: publicProcedure.input(z.object({ invoiceId: z.string(), customNotes: z.string().optional(), lineItems: z.any().optional() }))
    .mutation(async ({ ctx, input }) => { const { invoiceId, ...data } = input; return ctx.db.generatedInvoice.update({ where: { id: invoiceId }, data }); }),

  enhanceDescriptions: publicProcedure.input(z.object({ invoiceId: z.string() })).mutation(async ({ input }) => {
    await enhanceDescriptions(input.invoiceId); return { success: true };
  }),

  finalizeInvoice: publicProcedure.input(z.object({ invoiceId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.generatedInvoice.update({ where: { id: input.invoiceId }, data: { status: "finalized" } });
  }),

  sendInvoice: publicProcedure.input(z.object({ invoiceId: z.string(), method: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.generatedInvoice.update({ where: { id: input.invoiceId }, data: { status: "sent", sentAt: new Date(), sentVia: input.method } });
  }),

  voidInvoice: publicProcedure.input(z.object({ invoiceId: z.string(), reason: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.generatedInvoice.update({ where: { id: input.invoiceId }, data: { status: "voided", voidedAt: new Date(), voidedReason: input.reason } });
  }),

  // BATCH
  createBatch: publicProcedure
    .input(z.object({ batchName: z.string(), periodStart: z.date(), periodEnd: z.date(), filterCriteria: z.any().optional(), sendMethod: z.string().optional() }))
    .mutation(async ({ input }) => { return generateBatch({ ...input, userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID }); }),

  getBatches: publicProcedure.input(z.object({ status: z.string().optional() })).query(async ({ ctx, input }) => {
    const where: any = { firmId: DEFAULT_FIRM_ID };
    if (input.status) where.status = input.status;
    return ctx.db.invoiceBatch.findMany({ where, include: { _count: { select: { items: true } } }, orderBy: { createdAt: "desc" } });
  }),

  getBatch: publicProcedure.input(z.object({ batchId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.invoiceBatch.findUnique({ where: { id: input.batchId }, include: { items: { orderBy: { amount: "desc" } } } });
  }),

  approveBatchItem: publicProcedure.input(z.object({ batchItemId: z.string() })).mutation(async ({ ctx, input }) => {
    const item = await ctx.db.invoiceBatchItem.update({ where: { id: input.batchItemId }, data: { status: "approved" } });
    if (item.invoiceId) await ctx.db.generatedInvoice.update({ where: { id: item.invoiceId }, data: { status: "approved" } });
    await ctx.db.invoiceBatch.update({ where: { id: item.batchId }, data: { approvedItems: { increment: 1 } } });
    return item;
  }),

  rejectBatchItem: publicProcedure.input(z.object({ batchItemId: z.string(), reason: z.string() })).mutation(async ({ ctx, input }) => {
    const item = await ctx.db.invoiceBatchItem.update({ where: { id: input.batchItemId }, data: { status: "rejected", rejectedReason: input.reason } });
    await ctx.db.invoiceBatch.update({ where: { id: item.batchId }, data: { rejectedItems: { increment: 1 } } });
    return item;
  }),

  holdBatchItem: publicProcedure.input(z.object({ batchItemId: z.string(), reason: z.string() })).mutation(async ({ ctx, input }) => {
    const item = await ctx.db.invoiceBatchItem.update({ where: { id: input.batchItemId }, data: { status: "held", holdReason: input.reason } });
    await ctx.db.invoiceBatch.update({ where: { id: item.batchId }, data: { heldItems: { increment: 1 } } });
    return item;
  }),

  bulkApproveBatchItems: publicProcedure.input(z.object({ batchItemIds: z.array(z.string()) })).mutation(async ({ ctx, input }) => {
    let approved = 0;
    for (const id of input.batchItemIds) {
      await ctx.db.invoiceBatchItem.update({ where: { id }, data: { status: "approved" } });
      approved++;
    }
    return { approved };
  }),

  sendBatch: publicProcedure.input(z.object({ batchId: z.string() })).mutation(async ({ ctx, input }) => {
    const items = await ctx.db.invoiceBatchItem.findMany({ where: { batchId: input.batchId, status: "approved" } });
    let sent = 0;
    for (const item of items) {
      if (item.invoiceId) {
        await ctx.db.generatedInvoice.update({ where: { id: item.invoiceId }, data: { status: "sent", sentAt: new Date() } });
        sent++;
      }
    }
    await ctx.db.invoiceBatch.update({ where: { id: input.batchId }, data: { status: "sent", sentAt: new Date() } });
    return { sent };
  }),

  // SCHEDULES
  getSchedules: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.invoiceSchedule.findMany({ where: { firmId: DEFAULT_FIRM_ID }, orderBy: { name: "asc" } });
  }),

  createSchedule: publicProcedure
    .input(z.object({ name: z.string(), scheduleType: z.string().optional(), dayOfMonth: z.number().optional(), filterCriteria: z.any().optional(), autoGenerate: z.boolean().optional(), autoAudit: z.boolean().optional(), autoApproveGradeA: z.boolean().optional(), autoSend: z.boolean().optional(), sendMethod: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const nextRun = new Date(); nextRun.setMonth(nextRun.getMonth() + 1); nextRun.setDate(input.dayOfMonth || 1);
      return ctx.db.invoiceSchedule.create({ data: { ...input, nextRunAt: nextRun, isActive: true, firmId: DEFAULT_FIRM_ID } });
    }),

  toggleSchedule: publicProcedure.input(z.object({ scheduleId: z.string(), isActive: z.boolean() })).mutation(async ({ ctx, input }) => {
    return ctx.db.invoiceSchedule.update({ where: { id: input.scheduleId }, data: { isActive: input.isActive } });
  }),

  runScheduleNow: publicProcedure.input(z.object({ scheduleId: z.string() })).mutation(async ({ ctx, input }) => {
    const schedule = await ctx.db.invoiceSchedule.findUnique({ where: { id: input.scheduleId } });
    if (!schedule) throw new Error("Schedule not found");
    const now = new Date();
    const periodEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const periodStart = new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1);
    return generateBatch({ batchName: `${schedule.name} — Manual Run`, periodStart, periodEnd, filterCriteria: schedule.filterCriteria, sendMethod: schedule.sendMethod || undefined, userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID });
  }),

  processScheduled: publicProcedure.mutation(async () => {
    return { processed: await processScheduledInvoicing(DEFAULT_FIRM_ID, DEFAULT_USER_ID) };
  }),

  // PDF CONFIG
  getPDFConfig: publicProcedure.query(async ({ ctx }) => {
    let config = await ctx.db.invoicePDFConfig.findUnique({ where: { id: "default" } });
    if (!config) config = await ctx.db.invoicePDFConfig.create({ data: { id: "default" } });
    return config;
  }),

  updatePDFConfig: publicProcedure.input(z.object({ firmName: z.string().optional(), firmAddress: z.string().optional(), firmPhone: z.string().optional(), firmEmail: z.string().optional(), trustAccountDisclosure: z.string().optional(), paymentInstructions: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { return ctx.db.invoicePDFConfig.upsert({ where: { id: "default" }, create: { id: "default", ...input }, update: input }); }),

  // ANALYTICS
  getInvoicingStats: publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.generatedInvoice.findMany({ where: { firmId: DEFAULT_FIRM_ID } });
    const sent = all.filter((i) => ["sent", "paid", "partially_paid", "overdue"].includes(i.status));
    const paid = all.filter((i) => i.status === "paid");
    const outstanding = sent.filter((i) => i.status !== "paid");
    return {
      totalInvoiced: sent.reduce((s, i) => s + i.totalDue, 0),
      totalCollected: paid.reduce((s, i) => s + i.paidAmount, 0),
      totalOutstanding: outstanding.reduce((s, i) => s + (i.totalDue - i.paidAmount), 0),
      invoiceCount: all.length,
      paidCount: paid.length,
      outstandingCount: outstanding.length,
    };
  }),
});
