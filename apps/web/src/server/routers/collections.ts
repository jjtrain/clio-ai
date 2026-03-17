import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { syncFromBilling, getAgingReport, recordPayment } from "@/lib/collections-engine";
import { collboxTestConnection, collboxSubmitClaim, collboxGetStatus, collboxWithdraw } from "@/lib/integrations/collbox";
import { sherpaTestConnection, sherpaSyncInvoice, sherpaSendReminder, sherpaGetStatus } from "@/lib/integrations/invoicesherpa";

function maskKey(k: string | null) { return k ? "****" + k.slice(-4) : null; }

export const collectionsRouter = router({
  // ─── Dashboard ─────────────────────────────────────────────────
  dashboard: publicProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.db.collectionAccount.findMany({ where: { status: { not: "PAID" } } });
    const totalOutstanding = accounts.reduce((s, a) => s + Number(a.totalOwed), 0);
    const overdueCount = accounts.filter((a) => a.daysPastDue > 0).length;
    const overdueAmount = accounts.filter((a) => a.daysPastDue > 0).reduce((s, a) => s + Number(a.totalOwed), 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const activities = await ctx.db.collectionActivity.findMany({ where: { activityType: "PAYMENT_RECEIVED", createdAt: { gte: monthStart } } });
    const collectedThisMonth = activities.reduce((s, a) => s + Number(a.amount || 0), 0);

    const aging = await getAgingReport();
    const recent = await ctx.db.collectionActivity.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { account: true } });
    const top = await ctx.db.collectionAccount.findMany({ where: { status: { not: "PAID" } }, orderBy: { totalOwed: "desc" }, take: 10, include: { activities: { take: 1, orderBy: { createdAt: "desc" } } } });

    return { totalOutstanding, overdueCount, overdueAmount, collectedThisMonth, aging, recentActivity: recent, topAccounts: top };
  }),

  // ─── Accounts ──────────────────────────────────────────────────
  "accounts.list": publicProcedure
    .input(z.object({ status: z.string().optional(), agingBucket: z.string().optional(), priority: z.string().optional(), clientId: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.status) where.status = input.status;
      if (input?.agingBucket) where.agingBucket = input.agingBucket;
      if (input?.priority) where.priority = input.priority;
      if (input?.clientId) where.clientId = input.clientId;
      return ctx.db.collectionAccount.findMany({ where, orderBy: { daysPastDue: "desc" }, take: input?.limit || 50 });
    }),

  "accounts.getById": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.collectionAccount.findUniqueOrThrow({ where: { id: input.id }, include: { activities: { orderBy: { createdAt: "desc" } }, collboxAccount: true, sherpaAccount: true } });
    }),

  "accounts.addNote": publicProcedure
    .input(z.object({ accountId: z.string(), note: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.collectionActivity.create({ data: { accountId: input.accountId, activityType: "NOTE_ADDED", description: input.note } });
    }),

  "accounts.updateStatus": publicProcedure
    .input(z.object({ accountId: z.string(), status: z.string(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.collectionActivity.create({ data: { accountId: input.accountId, activityType: "STATUS_CHANGE", description: `Status changed to ${input.status}`, notes: input.notes } });
      return ctx.db.collectionAccount.update({ where: { id: input.accountId }, data: { status: input.status } });
    }),

  // ─── Payments ──────────────────────────────────────────────────
  "payments.record": publicProcedure
    .input(z.object({ accountId: z.string(), amount: z.number(), paymentMethod: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ input }) => recordPayment(input)),

  writeOff: publicProcedure
    .input(z.object({ accountId: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.collectionActivity.create({ data: { accountId: input.accountId, activityType: "WRITE_OFF", description: `Written off: ${input.reason}` } });
      return ctx.db.collectionAccount.update({ where: { id: input.accountId }, data: { status: "WRITTEN_OFF" } });
    }),

  // ─── Reminders ─────────────────────────────────────────────────
  "reminders.send": publicProcedure
    .input(z.object({ accountId: z.string(), method: z.string().default("email") }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.collectionActivity.create({ data: { accountId: input.accountId, activityType: "REMINDER_EMAIL", description: `Reminder sent via ${input.method}`, contactMethod: input.method, emailSent: input.method === "email" } });
      return ctx.db.collectionAccount.update({ where: { id: input.accountId }, data: { lastReminderSent: new Date(), reminderCount: { increment: 1 }, lastContactDate: new Date(), lastContactMethod: input.method } });
    }),

  // ─── Sync & Engine ─────────────────────────────────────────────
  sync: publicProcedure.mutation(async () => syncFromBilling()),
  "reports.aging": publicProcedure.query(async () => getAgingReport()),

  // ─── Settings ──────────────────────────────────────────────────
  "settings.get": publicProcedure.query(async ({ ctx }) => {
    let s = await ctx.db.collectionSettings.findUnique({ where: { id: "default" } });
    if (!s) s = await ctx.db.collectionSettings.create({ data: { id: "default" } });
    return s;
  }),
  "settings.update": publicProcedure
    .input(z.object({ autoReminderEnabled: z.boolean().optional(), reminderSchedule: z.string().optional(), escalationThreshold: z.number().optional(), lateFeePolicyEnabled: z.boolean().optional(), lateFeeType: z.string().optional().nullable(), lateFeeAmount: z.number().optional().nullable(), lateFeeGracePeriod: z.number().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.collectionSettings.upsert({ where: { id: "default" }, create: { id: "default", ...input }, update: input })),

  // ─── CollBox ───────────────────────────────────────────────────
  "collbox.settings.get": publicProcedure.query(async ({ ctx }) => {
    let s = await ctx.db.collBoxSettings.findUnique({ where: { id: "default" } });
    if (!s) s = await ctx.db.collBoxSettings.create({ data: { id: "default" } });
    return { ...s, apiKey: maskKey(s.apiKey), apiSecret: maskKey(s.apiSecret) };
  }),
  "collbox.settings.update": publicProcedure
    .input(z.object({ isEnabled: z.boolean().optional(), apiKey: z.string().optional().nullable(), apiSecret: z.string().optional().nullable(), baseUrl: z.string().optional().nullable(), firmId: z.string().optional().nullable(), autoSendThreshold: z.number().optional().nullable(), minimumAmount: z.number().optional().nullable(), preserveRelationship: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const data: any = { ...input };
      if (data.apiKey?.startsWith("****")) delete data.apiKey;
      if (data.apiSecret?.startsWith("****")) delete data.apiSecret;
      return ctx.db.collBoxSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
    }),
  "collbox.test": publicProcedure.mutation(async () => collboxTestConnection()),
  "collbox.submit": publicProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const account = await ctx.db.collectionAccount.findUniqueOrThrow({ where: { id: input.accountId } });
      const client = await ctx.db.client.findUnique({ where: { id: account.clientId } });
      const result = await collboxSubmitClaim({ debtorName: client?.name || "Unknown", debtorEmail: client?.email || undefined, originalBalance: Number(account.totalOwed), description: `Invoice collection — ${Number(account.totalOwed).toFixed(2)} outstanding` });
      if (result.success) {
        await ctx.db.collBoxAccount.create({ data: { collectionAccountId: input.accountId, collboxClaimId: (result as any).data.claimId, collboxStatus: "submitted", debtorName: client?.name || "Unknown", debtorEmail: client?.email, originalBalance: Number(account.totalOwed), submittedAt: new Date() } });
        await ctx.db.collectionAccount.update({ where: { id: input.accountId }, data: { status: "IN_COLLECTION", externalProvider: "COLLBOX", sentToCollectionAt: new Date(), externalCollectionId: (result as any).data.claimId } });
        await ctx.db.collectionActivity.create({ data: { accountId: input.accountId, activityType: "SENT_TO_COLLECTION", description: "Sent to CollBox for professional collection" } });
      }
      return result;
    }),
  "collbox.withdraw": publicProcedure
    .input(z.object({ accountId: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cb = await ctx.db.collBoxAccount.findUnique({ where: { collectionAccountId: input.accountId } });
      if (cb?.collboxClaimId) await collboxWithdraw(cb.collboxClaimId, input.reason);
      if (cb) await ctx.db.collBoxAccount.update({ where: { id: cb.id }, data: { collboxStatus: "withdrawn", closedAt: new Date(), closeReason: input.reason } });
      await ctx.db.collectionAccount.update({ where: { id: input.accountId }, data: { status: "OPEN" } });
      await ctx.db.collectionActivity.create({ data: { accountId: input.accountId, activityType: "STATUS_CHANGE", description: `Withdrawn from CollBox: ${input.reason}` } });
      return { success: true };
    }),

  // ─── InvoiceSherpa ─────────────────────────────────────────────
  "sherpa.settings.get": publicProcedure.query(async ({ ctx }) => {
    let s = await ctx.db.invoiceSherpaSettings.findUnique({ where: { id: "default" } });
    if (!s) s = await ctx.db.invoiceSherpaSettings.create({ data: { id: "default" } });
    return { ...s, apiKey: maskKey(s.apiKey) };
  }),
  "sherpa.settings.update": publicProcedure
    .input(z.object({ isEnabled: z.boolean().optional(), apiKey: z.string().optional().nullable(), baseUrl: z.string().optional().nullable(), firmId: z.string().optional().nullable(), autoSyncInvoices: z.boolean().optional(), reminderEnabled: z.boolean().optional(), thankYouEnabled: z.boolean().optional(), brandColor: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const data: any = { ...input };
      if (data.apiKey?.startsWith("****")) delete data.apiKey;
      return ctx.db.invoiceSherpaSettings.upsert({ where: { id: "default" }, create: { id: "default", ...data }, update: data });
    }),
  "sherpa.test": publicProcedure.mutation(async () => sherpaTestConnection()),
  "sherpa.syncInvoice": publicProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const inv = await ctx.db.invoice.findUniqueOrThrow({ where: { id: input.invoiceId }, include: { matter: { include: { client: true } } } });
      const result = await sherpaSyncInvoice({ invoiceNumber: inv.invoiceNumber, clientName: inv.matter.client.name, clientEmail: inv.matter.client.email || "", amount: Number(inv.total) - Number(inv.amountPaid), dueDate: inv.dueDate.toISOString().split("T")[0] });
      if (result.success) {
        await ctx.db.invoiceSherpaAccount.create({ data: { invoiceId: input.invoiceId, sherpaInvoiceId: (result as any).data.sherpaInvoiceId, paymentLinkUrl: (result as any).data.paymentLinkUrl, syncStatus: "SYNCED", lastSynced: new Date() } });
      }
      return result;
    }),
  "sherpa.sendReminder": publicProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sa = await ctx.db.invoiceSherpaAccount.findFirst({ where: { invoiceId: input.invoiceId } });
      if (!sa?.sherpaInvoiceId) return { success: false, error: "Invoice not synced to InvoiceSherpa" };
      return sherpaSendReminder(sa.sherpaInvoiceId);
    }),
});
