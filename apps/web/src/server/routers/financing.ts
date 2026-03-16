import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  createCheckout,
  authorizeCharge,
  captureCharge,
  voidCharge,
  refundCharge,
  getCharge,
  calculateMonthlyEstimate,
} from "@/lib/affirm";

const STATUS_ENUM = ["PENDING", "APPROVED", "DENIED", "COMPLETED", "CANCELLED", "EXPIRED"] as const;

export const financingRouter = router({
  // ─── Applications ──────────────────────────────────────────────

  list: publicProcedure
    .input(z.object({
      status: z.enum(STATUS_ENUM).optional(),
      clientId: z.string().optional(),
      invoiceId: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.status) where.status = input.status;
      if (input?.clientId) where.clientId = input.clientId;
      if (input?.invoiceId) where.invoiceId = input.invoiceId;
      return ctx.db.financingApplication.findMany({
        where,
        include: { client: true, invoice: true },
        orderBy: { createdAt: "desc" },
        take: input?.limit || 50,
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.financingApplication.findUniqueOrThrow({
        where: { id: input.id },
        include: { client: true, invoice: true },
      });
    }),

  create: publicProcedure
    .input(z.object({
      invoiceId: z.string().optional(),
      clientId: z.string(),
      matterId: z.string().optional(),
      amount: z.number().min(1),
      clientName: z.string().min(1),
      clientEmail: z.string().min(1),
      clientPhone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const settings = await ctx.db.financingSettings.findUnique({ where: { id: "default" } });
      if (settings) {
        if (input.amount < Number(settings.minimumAmount)) throw new Error(`Minimum amount is $${Number(settings.minimumAmount)}`);
        if (input.amount > Number(settings.maximumAmount)) throw new Error(`Maximum amount is $${Number(settings.maximumAmount)}`);
      }

      const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

      let invoiceNumber: string | undefined;
      if (input.invoiceId) {
        const inv = await ctx.db.invoice.findUnique({ where: { id: input.invoiceId } });
        invoiceNumber = inv?.invoiceNumber;
      }

      const checkout = await createCheckout({
        amount: input.amount,
        clientName: input.clientName,
        clientEmail: input.clientEmail,
        clientPhone: input.clientPhone,
        description: invoiceNumber ? `Invoice ${invoiceNumber}` : "Legal Services",
        invoiceNumber,
        returnUrl: `${baseUrl}/financing/callback?action=confirm`,
        cancelUrl: `${baseUrl}/financing/callback?action=cancel`,
      });

      return ctx.db.financingApplication.create({
        data: {
          invoiceId: input.invoiceId,
          clientId: input.clientId,
          matterId: input.matterId,
          amount: input.amount,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          clientPhone: input.clientPhone,
          affirmCheckoutToken: checkout.checkoutToken,
          applicationUrl: checkout.checkoutUrl,
          appliedAt: new Date(),
          status: "PENDING",
        },
        include: { client: true },
      });
    }),

  authorize: publicProcedure
    .input(z.object({ applicationId: z.string(), checkoutToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const charge = await authorizeCharge(input.checkoutToken);

      return ctx.db.financingApplication.update({
        where: { id: input.applicationId },
        data: {
          status: "APPROVED",
          affirmChargeId: charge.chargeId,
          affirmLoanId: charge.loanId,
          termMonths: charge.termMonths,
          apr: charge.apr,
          monthlyPayment: charge.monthlyPayment,
          totalFinanced: charge.amount || undefined,
          approvedAt: new Date(),
          metadata: JSON.stringify(charge),
        },
      });
    }),

  capture: publicProcedure
    .input(z.object({ applicationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const app = await ctx.db.financingApplication.findUniqueOrThrow({ where: { id: input.applicationId } });
      if (!app.affirmChargeId) throw new Error("No charge to capture");

      const result = await captureCharge(app.affirmChargeId, Number(app.amount));

      await ctx.db.financingApplication.update({
        where: { id: input.applicationId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });

      // Apply to invoice if linked
      if (app.invoiceId) {
        const invoice = await ctx.db.invoice.findUnique({ where: { id: app.invoiceId } });
        if (invoice) {
          const newPaid = Number(invoice.amountPaid) + Number(app.amount);
          await ctx.db.invoice.update({
            where: { id: app.invoiceId },
            data: {
              amountPaid: newPaid,
              status: newPaid >= Number(invoice.total) ? "PAID" : invoice.status,
              paidAt: newPaid >= Number(invoice.total) ? new Date() : undefined,
            },
          });
          await ctx.db.payment.create({
            data: {
              invoiceId: app.invoiceId,
              amount: Number(app.amount),
              paymentMethod: "OTHER",
              reference: app.affirmChargeId || result.transactionId,
              notes: `Affirm financing - Loan ${app.affirmLoanId}`,
            },
          });
        }
      }

      return { success: true, transactionId: result.transactionId };
    }),

  void: publicProcedure
    .input(z.object({ applicationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const app = await ctx.db.financingApplication.findUniqueOrThrow({ where: { id: input.applicationId } });
      if (app.affirmChargeId) await voidCharge(app.affirmChargeId);
      return ctx.db.financingApplication.update({
        where: { id: input.applicationId },
        data: { status: "CANCELLED" },
      });
    }),

  refund: publicProcedure
    .input(z.object({ applicationId: z.string(), amount: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const app = await ctx.db.financingApplication.findUniqueOrThrow({ where: { id: input.applicationId } });
      if (!app.affirmChargeId) throw new Error("No charge to refund");
      const result = await refundCharge(app.affirmChargeId, input.amount);

      if (app.invoiceId) {
        const invoice = await ctx.db.invoice.findUnique({ where: { id: app.invoiceId } });
        if (invoice) {
          await ctx.db.invoice.update({
            where: { id: app.invoiceId },
            data: { amountPaid: Math.max(0, Number(invoice.amountPaid) - input.amount) },
          });
        }
      }

      return result;
    }),

  checkStatus: publicProcedure
    .input(z.object({ applicationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const app = await ctx.db.financingApplication.findUniqueOrThrow({ where: { id: input.applicationId } });
      if (!app.affirmChargeId) return app;
      const charge = await getCharge(app.affirmChargeId);
      return { ...app, affirmStatus: charge.status, events: charge.events };
    }),

  getEstimate: publicProcedure
    .input(z.object({ amount: z.number().min(1) }))
    .query(({ input }) => {
      return calculateMonthlyEstimate(input.amount);
    }),

  getStats: publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.financingApplication.findMany();
    const completed = all.filter((a) => a.status === "COMPLETED");
    const approved = all.filter((a) => a.status === "APPROVED" || a.status === "COMPLETED");
    const pending = all.filter((a) => a.status === "PENDING");
    const totalFinanced = completed.reduce((s, a) => s + Number(a.amount), 0);
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonth = completed.filter((a) => a.completedAt && new Date(a.completedAt) >= monthStart);
    const monthVolume = thisMonth.reduce((s, a) => s + Number(a.amount), 0);

    return {
      totalFinanced,
      activeLoans: approved.length,
      avgLoanAmount: completed.length > 0 ? totalFinanced / completed.length : 0,
      approvalRate: all.length > 0 ? (approved.length / all.length) * 100 : 0,
      pendingCount: pending.length,
      monthVolume,
    };
  }),

  // ─── Settings ──────────────────────────────────────────────────

  getSettings: publicProcedure.query(async ({ ctx }) => {
    let s = await ctx.db.financingSettings.findUnique({ where: { id: "default" } });
    if (!s) s = await ctx.db.financingSettings.create({ data: { id: "default" } });
    return s;
  }),

  updateSettings: publicProcedure
    .input(z.object({
      isEnabled: z.boolean().optional(),
      affirmPublicKey: z.string().optional().nullable(),
      affirmPrivateKey: z.string().optional().nullable(),
      affirmEnvironment: z.string().optional(),
      minimumAmount: z.number().optional(),
      maximumAmount: z.number().optional(),
      enabledForRetainers: z.boolean().optional(),
      enabledForInvoices: z.boolean().optional(),
      enabledForSettlements: z.boolean().optional(),
      promotionalMessage: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.financingSettings.upsert({
        where: { id: "default" },
        create: { id: "default", ...input },
        update: input,
      });
    }),

  testConnection: publicProcedure.mutation(async ({ ctx }) => {
    const s = await ctx.db.financingSettings.findUnique({ where: { id: "default" } });
    if (!s?.affirmPublicKey || !s?.affirmPrivateKey) return { connected: false, error: "Affirm keys not configured" };
    return { connected: true, environment: s.affirmEnvironment };
  }),
});
