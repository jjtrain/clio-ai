import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { processPayment, generatePaymentLink } from "@/lib/payments";
import { sendPaymentLinkEmail, sendPaymentReceipt } from "@/lib/email";
import crypto from "crypto";

const METHOD_ENUM = ["CREDIT_CARD", "DEBIT_CARD", "ECHECK", "ACH", "TAP_TO_PAY", "APPLE_PAY", "GOOGLE_PAY", "OTHER"] as const;
const TX_STATUS_ENUM = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "REFUNDED", "VOIDED"] as const;
const LINK_STATUS_ENUM = ["ACTIVE", "PAID", "EXPIRED", "CANCELLED"] as const;

export const paymentsRouter = router({
  // ─── Payment Links ─────────────────────────────────────────────

  listLinks: publicProcedure
    .input(z.object({
      status: z.enum(LINK_STATUS_ENUM).optional(),
      clientId: z.string().optional(),
      invoiceId: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.status) where.status = input.status;
      if (input?.clientId) where.clientId = input.clientId;
      if (input?.invoiceId) where.invoiceId = input.invoiceId;
      return ctx.db.paymentLink.findMany({
        where,
        include: { client: true, invoice: true, _count: { select: { transactions: true } } },
        orderBy: { createdAt: "desc" },
        take: input?.limit || 50,
      });
    }),

  getLink: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.paymentLink.findUniqueOrThrow({
        where: { id: input.id },
        include: { client: true, invoice: true, transactions: { orderBy: { createdAt: "desc" } } },
      });
    }),

  getLinkByToken: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ ctx, input }) => {
      const link = await ctx.db.paymentLink.findUnique({
        where: { token: input.token },
      });
      if (!link) throw new Error("Payment link not found");
      if (link.status !== "ACTIVE") return { ...link, expired: link.status !== "ACTIVE" };
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        await ctx.db.paymentLink.update({ where: { id: link.id }, data: { status: "EXPIRED" } });
        return { ...link, status: "EXPIRED" as const, expired: true };
      }

      const settings = await ctx.db.paymentSettings.findUnique({ where: { id: "default" } });
      return {
        id: link.id,
        token: link.token,
        title: link.title,
        description: link.description,
        amount: link.amount,
        status: link.status,
        allowPartialPayment: link.allowPartialPayment,
        minimumPayment: link.minimumPayment,
        paidAmount: link.paidAmount,
        expired: false,
        acceptedMethods: {
          creditCard: settings?.acceptCreditCard ?? true,
          debitCard: settings?.acceptDebitCard ?? true,
          echeck: settings?.acceptEcheck ?? true,
          applePay: settings?.acceptApplePay ?? false,
          googlePay: settings?.acceptGooglePay ?? false,
        },
        surcharge: settings?.surchargeEnabled ? Number(settings.surchargePercentage || 0) : 0,
        convenienceFee: settings?.convenienceFeeEnabled ? Number(settings.convenienceFeeAmount || 0) : 0,
        firmName: settings?.firmName || "Law Firm",
      };
    }),

  createLink: publicProcedure
    .input(z.object({
      invoiceId: z.string().optional(),
      matterId: z.string().optional(),
      clientId: z.string().optional(),
      title: z.string().min(1),
      description: z.string().optional(),
      amount: z.number().min(0.01),
      recipientEmail: z.string().optional(),
      recipientPhone: z.string().optional(),
      expiresAt: z.string().or(z.date()).optional(),
      allowPartialPayment: z.boolean().optional(),
      minimumPayment: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const settings = await ctx.db.paymentSettings.findUnique({ where: { id: "default" } });
      const defaultExpiry = settings?.paymentLinkDefaultExpiry || 30;
      const token = crypto.randomUUID();

      const expiresAt = input.expiresAt
        ? new Date(input.expiresAt)
        : new Date(Date.now() + defaultExpiry * 24 * 60 * 60 * 1000);

      const link = await ctx.db.paymentLink.create({
        data: {
          ...input,
          token,
          expiresAt,
        },
        include: { client: true },
      });

      const baseUrl = process.env.NEXTAUTH_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";
      const paymentUrl = generatePaymentLink(baseUrl, token);

      return { ...link, paymentUrl };
    }),

  sendLink: publicProcedure
    .input(z.object({
      paymentLinkId: z.string(),
      via: z.enum(["email", "text", "both"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.db.paymentLink.findUniqueOrThrow({
        where: { id: input.paymentLinkId },
        include: { client: true },
      });

      const settings = await ctx.db.paymentSettings.findUnique({ where: { id: "default" } });
      const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      const paymentUrl = generatePaymentLink(baseUrl, link.token);
      const firmName = settings?.firmName || "Law Firm";
      const fromEmail = settings?.firmEmail || "noreply@example.com";

      if ((input.via === "email" || input.via === "both") && link.recipientEmail) {
        await sendPaymentLinkEmail({
          to: link.recipientEmail,
          name: link.client?.name || "Client",
          amount: Number(link.amount),
          paymentUrl,
          title: link.title,
          firmName,
          fromEmail,
        });
      }

      await ctx.db.paymentLink.update({
        where: { id: input.paymentLinkId },
        data: { sentVia: input.via, sentAt: new Date() },
      });

      return { sent: true, paymentUrl };
    }),

  cancelLink: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.paymentLink.update({
        where: { id: input.id },
        data: { status: "CANCELLED" },
      });
    }),

  resendLink: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.db.paymentLink.findUniqueOrThrow({
        where: { id: input.id },
        include: { client: true },
      });
      const settings = await ctx.db.paymentSettings.findUnique({ where: { id: "default" } });
      const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      const paymentUrl = generatePaymentLink(baseUrl, link.token);

      if (link.recipientEmail) {
        await sendPaymentLinkEmail({
          to: link.recipientEmail,
          name: link.client?.name || "Client",
          amount: Number(link.amount),
          paymentUrl,
          title: link.title,
          firmName: settings?.firmName || "Law Firm",
          fromEmail: settings?.firmEmail || "noreply@example.com",
        });
      }

      await ctx.db.paymentLink.update({
        where: { id: input.id },
        data: { sentAt: new Date() },
      });

      return { sent: true };
    }),

  // ─── Transactions ──────────────────────────────────────────────

  listTransactions: publicProcedure
    .input(z.object({
      method: z.enum(METHOD_ENUM).optional(),
      status: z.enum(TX_STATUS_ENUM).optional(),
      clientId: z.string().optional(),
      invoiceId: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.method) where.method = input.method;
      if (input?.status) where.status = input.status;
      if (input?.clientId) where.clientId = input.clientId;
      if (input?.invoiceId) where.invoiceId = input.invoiceId;
      if (input?.startDate || input?.endDate) {
        where.createdAt = {};
        if (input?.startDate) where.createdAt.gte = new Date(input.startDate);
        if (input?.endDate) where.createdAt.lte = new Date(input.endDate);
      }
      return ctx.db.paymentTransaction.findMany({
        where,
        include: { client: true, invoice: true, paymentLink: true },
        orderBy: { createdAt: "desc" },
        take: input?.limit || 50,
      });
    }),

  getTransaction: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.paymentTransaction.findUniqueOrThrow({
        where: { id: input.id },
        include: { client: true, invoice: true, paymentLink: true },
      });
    }),

  processPublicPayment: publicProcedure
    .input(z.object({
      token: z.string(),
      amount: z.number().min(0.01),
      method: z.enum(METHOD_ENUM),
      cardLast4: z.string().optional(),
      cardBrand: z.string().optional(),
      bankName: z.string().optional(),
      cardholderName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const link = await ctx.db.paymentLink.findUnique({ where: { token: input.token } });
      if (!link || link.status !== "ACTIVE") throw new Error("Payment link is not active");
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) throw new Error("Payment link expired");

      if (!link.allowPartialPayment && input.amount < Number(link.amount)) {
        throw new Error("Partial payments not allowed");
      }
      if (link.minimumPayment && input.amount < Number(link.minimumPayment)) {
        throw new Error(`Minimum payment is $${Number(link.minimumPayment).toFixed(2)}`);
      }

      // Process via payment processor
      const result = await processPayment({
        amount: input.amount,
        method: input.method,
      });

      const txStatus = result.success ? "COMPLETED" : "FAILED";

      const tx = await ctx.db.paymentTransaction.create({
        data: {
          paymentLinkId: link.id,
          invoiceId: link.invoiceId,
          clientId: link.clientId,
          amount: input.amount,
          method: input.method,
          status: txStatus,
          processorId: result.transactionId,
          processorResponse: JSON.stringify(result.processorResponse),
          cardLast4: input.cardLast4,
          cardBrand: input.cardBrand,
          bankName: input.bankName,
          errorMessage: result.success ? null : "Payment processing failed",
        },
      });

      if (result.success) {
        const totalPaid = Number(link.paidAmount || 0) + input.amount;
        const fullyPaid = totalPaid >= Number(link.amount);

        await ctx.db.paymentLink.update({
          where: { id: link.id },
          data: {
            paidAmount: totalPaid,
            paidAt: fullyPaid ? new Date() : undefined,
            status: fullyPaid ? "PAID" : "ACTIVE",
            paymentMethod: input.method,
          },
        });

        // Auto-apply to invoice
        const settings = await ctx.db.paymentSettings.findUnique({ where: { id: "default" } });
        if (settings?.autoApplyToInvoice && link.invoiceId) {
          const invoice = await ctx.db.invoice.findUnique({ where: { id: link.invoiceId } });
          if (invoice) {
            const newPaid = Number(invoice.amountPaid) + input.amount;
            await ctx.db.invoice.update({
              where: { id: link.invoiceId },
              data: {
                amountPaid: newPaid,
                status: newPaid >= Number(invoice.total) ? "PAID" : invoice.status,
                paidAt: newPaid >= Number(invoice.total) ? new Date() : undefined,
              },
            });
            await ctx.db.payment.create({
              data: {
                invoiceId: link.invoiceId,
                amount: input.amount,
                paymentMethod: input.method === "CREDIT_CARD" || input.method === "DEBIT_CARD" ? "CREDIT_CARD" : input.method === "ECHECK" || input.method === "ACH" ? "BANK_TRANSFER" : "OTHER",
                reference: result.transactionId,
                notes: `Online payment via payment link`,
              },
            });
          }
        }

        // Send receipt
        if (settings?.sendReceiptEmail && link.recipientEmail) {
          const client = link.clientId ? await ctx.db.client.findUnique({ where: { id: link.clientId } }) : null;
          await sendPaymentReceipt({
            to: link.recipientEmail,
            name: client?.name || "Client",
            amount: input.amount,
            method: input.method,
            last4: input.cardLast4,
            transactionId: result.transactionId,
            firmName: settings.firmName || "Law Firm",
            fromEmail: settings.firmEmail || "noreply@example.com",
          });
        }
      }

      return { success: result.success, transactionId: result.transactionId, status: txStatus };
    }),

  refund: publicProcedure
    .input(z.object({ transactionId: z.string(), amount: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const tx = await ctx.db.paymentTransaction.findUniqueOrThrow({ where: { id: input.transactionId } });
      const refundAmount = input.amount || Number(tx.amount);

      await ctx.db.paymentTransaction.update({
        where: { id: input.transactionId },
        data: {
          status: "REFUNDED",
          refundedAmount: refundAmount,
          refundedAt: new Date(),
        },
      });

      // Adjust invoice if linked
      if (tx.invoiceId) {
        const invoice = await ctx.db.invoice.findUnique({ where: { id: tx.invoiceId } });
        if (invoice) {
          await ctx.db.invoice.update({
            where: { id: tx.invoiceId },
            data: { amountPaid: Math.max(0, Number(invoice.amountPaid) - refundAmount) },
          });
        }
      }

      return { success: true, refundedAmount: refundAmount };
    }),

  getStats: publicProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const where: any = {
        createdAt: { gte: input?.startDate ? new Date(input.startDate) : startOfMonth },
      };
      if (input?.endDate) where.createdAt.lte = new Date(input.endDate);

      const transactions = await ctx.db.paymentTransaction.findMany({ where });

      const completed = transactions.filter((t) => t.status === "COMPLETED");
      const totalProcessed = completed.reduce((s, t) => s + Number(t.amount), 0);
      const totalRefunded = transactions.filter((t) => t.status === "REFUNDED").reduce((s, t) => s + Number(t.refundedAmount || t.amount), 0);
      const avgTransaction = completed.length > 0 ? totalProcessed / completed.length : 0;
      const successRate = transactions.length > 0 ? (completed.length / transactions.length) * 100 : 0;

      const byMethod: Record<string, number> = {};
      for (const t of completed) {
        byMethod[t.method] = (byMethod[t.method] || 0) + Number(t.amount);
      }

      const activeLinks = await ctx.db.paymentLink.count({ where: { status: "ACTIVE" } });
      const pendingTx = await ctx.db.paymentTransaction.count({ where: { status: "PENDING" } });

      // Daily volumes for chart (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const recentTx = await ctx.db.paymentTransaction.findMany({
        where: { createdAt: { gte: thirtyDaysAgo }, status: "COMPLETED" },
      });
      const dailyVolume: Record<string, number> = {};
      for (const t of recentTx) {
        const day = new Date(t.createdAt).toISOString().split("T")[0];
        dailyVolume[day] = (dailyVolume[day] || 0) + Number(t.amount);
      }

      return {
        totalProcessed,
        transactionCount: completed.length,
        avgTransaction,
        totalRefunded,
        successRate,
        activeLinks,
        pendingPayments: pendingTx,
        byMethod,
        dailyVolume,
      };
    }),

  // ─── Quick Pay ─────────────────────────────────────────────────

  createAndSendLink: publicProcedure
    .input(z.object({
      clientId: z.string(),
      amount: z.number().min(0.01),
      title: z.string(),
      via: z.enum(["email", "text", "both"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.db.client.findUniqueOrThrow({ where: { id: input.clientId } });
      const token = crypto.randomUUID();
      const settings = await ctx.db.paymentSettings.findUnique({ where: { id: "default" } });
      const expiry = settings?.paymentLinkDefaultExpiry || 30;

      const link = await ctx.db.paymentLink.create({
        data: {
          clientId: input.clientId,
          token,
          title: input.title,
          amount: input.amount,
          recipientEmail: client.email || undefined,
          recipientPhone: client.phone || undefined,
          expiresAt: new Date(Date.now() + expiry * 24 * 60 * 60 * 1000),
        },
      });

      const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      const paymentUrl = generatePaymentLink(baseUrl, token);

      if ((input.via === "email" || input.via === "both") && client.email) {
        await sendPaymentLinkEmail({
          to: client.email,
          name: client.name,
          amount: input.amount,
          paymentUrl,
          title: input.title,
          firmName: settings?.firmName || "Law Firm",
          fromEmail: settings?.firmEmail || "noreply@example.com",
        });
      }

      await ctx.db.paymentLink.update({
        where: { id: link.id },
        data: { sentVia: input.via, sentAt: new Date() },
      });

      return { ...link, paymentUrl };
    }),

  createInvoicePaymentLink: publicProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUniqueOrThrow({
        where: { id: input.invoiceId },
        include: { matter: { include: { client: true } } },
      });

      const outstanding = Number(invoice.total) - Number(invoice.amountPaid);
      if (outstanding <= 0) throw new Error("Invoice is already fully paid");

      const token = crypto.randomUUID();
      const settings = await ctx.db.paymentSettings.findUnique({ where: { id: "default" } });
      const expiry = settings?.paymentLinkDefaultExpiry || 30;

      const link = await ctx.db.paymentLink.create({
        data: {
          invoiceId: input.invoiceId,
          matterId: invoice.matterId,
          clientId: invoice.matter.clientId,
          token,
          title: `Invoice ${invoice.invoiceNumber} Payment`,
          amount: outstanding,
          recipientEmail: invoice.matter.client.email || undefined,
          expiresAt: new Date(Date.now() + expiry * 24 * 60 * 60 * 1000),
        },
      });

      const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      return { ...link, paymentUrl: generatePaymentLink(baseUrl, token) };
    }),

  bulkCreateLinks: publicProcedure
    .input(z.object({ invoiceIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const results = [];
      for (const invoiceId of input.invoiceIds) {
        try {
          const invoice = await ctx.db.invoice.findUniqueOrThrow({
            where: { id: invoiceId },
            include: { matter: { include: { client: true } } },
          });
          const outstanding = Number(invoice.total) - Number(invoice.amountPaid);
          if (outstanding <= 0) continue;

          const token = crypto.randomUUID();
          const settings = await ctx.db.paymentSettings.findUnique({ where: { id: "default" } });
          const expiry = settings?.paymentLinkDefaultExpiry || 30;

          const link = await ctx.db.paymentLink.create({
            data: {
              invoiceId,
              matterId: invoice.matterId,
              clientId: invoice.matter.clientId,
              token,
              title: `Invoice ${invoice.invoiceNumber} Payment`,
              amount: outstanding,
              recipientEmail: invoice.matter.client.email || undefined,
              expiresAt: new Date(Date.now() + expiry * 24 * 60 * 60 * 1000),
            },
          });
          results.push({ invoiceId, linkId: link.id, token });
        } catch (e) {
          results.push({ invoiceId, error: "Failed" });
        }
      }
      return results;
    }),

  // ─── Settings ──────────────────────────────────────────────────

  getSettings: publicProcedure.query(async ({ ctx }) => {
    let settings = await ctx.db.paymentSettings.findUnique({ where: { id: "default" } });
    if (!settings) {
      settings = await ctx.db.paymentSettings.create({ data: { id: "default" } });
    }
    return settings;
  }),

  updateSettings: publicProcedure
    .input(z.object({
      isEnabled: z.boolean().optional(),
      processor: z.string().optional(),
      helcimApiToken: z.string().optional().nullable(),
      helcimAccountId: z.string().optional().nullable(),
      stripePublishableKey: z.string().optional().nullable(),
      stripeSecretKey: z.string().optional().nullable(),
      acceptCreditCard: z.boolean().optional(),
      acceptDebitCard: z.boolean().optional(),
      acceptEcheck: z.boolean().optional(),
      acceptApplePay: z.boolean().optional(),
      acceptGooglePay: z.boolean().optional(),
      surchargeEnabled: z.boolean().optional(),
      surchargePercentage: z.number().optional().nullable(),
      convenienceFeeEnabled: z.boolean().optional(),
      convenienceFeeAmount: z.number().optional().nullable(),
      paymentLinkDefaultExpiry: z.number().optional(),
      autoApplyToInvoice: z.boolean().optional(),
      sendReceiptEmail: z.boolean().optional(),
      trustAccountPayments: z.boolean().optional(),
      firmName: z.string().optional().nullable(),
      firmEmail: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.paymentSettings.upsert({
        where: { id: "default" },
        create: { id: "default", ...input },
        update: input,
      });
    }),

  testConnection: publicProcedure.mutation(async ({ ctx }) => {
    const settings = await ctx.db.paymentSettings.findUnique({ where: { id: "default" } });
    if (!settings) return { connected: false, error: "No settings configured" };

    if (settings.processor === "helcim") {
      if (!settings.helcimApiToken) return { connected: false, error: "Helcim API token not set" };
      return { connected: true, accountInfo: { processor: "Helcim", accountId: settings.helcimAccountId } };
    }

    return { connected: false, error: "Processor not supported yet" };
  }),
});
