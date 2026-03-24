import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  processPayment,
  tokenizePaymentMethod,
  generatePaymentSchedule,
  processScheduledPayments,
  sendPaymentReminders,
  checkTrustCompliance,
  calculateNextPaymentDate,
} from "@/lib/payment-engine";

const DEFAULT_USER_ID = "demo-user";
const DEFAULT_FIRM_ID = "demo-firm";

export const paymentPlansRouter = router({
  // ==========================================
  // PAYMENT PLANS
  // ==========================================

  createPlan: publicProcedure
    .input(z.object({
      matterId: z.string(),
      clientName: z.string(),
      clientEmail: z.string().optional(),
      portalAccountId: z.string().optional(),
      planName: z.string(),
      planType: z.string(),
      billingType: z.string().default("flat_fee"),
      totalAmount: z.number().optional(),
      installmentAmount: z.number(),
      installmentCount: z.number().optional(),
      frequency: z.string(),
      dayOfMonth: z.number().optional(),
      customScheduleDates: z.any().optional(),
      startDate: z.date(),
      autoPayEnabled: z.boolean().optional(),
      paymentMethodId: z.string().optional(),
      retainerMinBalance: z.number().optional(),
      retainerTargetBalance: z.number().optional(),
      depositAccount: z.string().default("operating"),
      trustAccountId: z.string().optional(),
      lateFeeEnabled: z.boolean().optional(),
      lateFeeAmount: z.number().optional(),
      lateFeeDaysGrace: z.number().optional(),
      maxMissedBeforeDefault: z.number().optional(),
      termsText: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Create plan
      const plan = await ctx.db.autoPayPlan.create({
        data: {
          ...input,
          remainingBalance: input.totalAmount,
          nextPaymentDate: input.startDate,
          matterName: null,
          userId: DEFAULT_USER_ID,
          firmId: DEFAULT_FIRM_ID,
        },
      });

      // Generate schedule
      const schedule = generatePaymentSchedule({
        installmentAmount: input.installmentAmount,
        installmentCount: input.installmentCount,
        totalAmount: input.totalAmount,
        frequency: input.frequency,
        startDate: input.startDate,
        dayOfMonth: input.dayOfMonth,
        customScheduleDates: input.customScheduleDates,
      });

      for (const item of schedule) {
        await ctx.db.scheduledPayment.create({
          data: {
            planId: plan.id,
            matterId: input.matterId,
            sequenceNumber: item.sequenceNumber,
            scheduledDate: item.scheduledDate,
            amount: item.amount,
            totalDue: item.amount,
            paymentMethodId: input.paymentMethodId,
            userId: DEFAULT_USER_ID,
            firmId: DEFAULT_FIRM_ID,
          },
        });
      }

      return plan;
    }),

  getPlans: publicProcedure
    .input(z.object({
      matterId: z.string().optional(),
      status: z.string().optional(),
      planType: z.string().optional(),
      limit: z.number().optional().default(30),
    }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.matterId) where.matterId = input.matterId;
      if (input.status) where.status = input.status;
      if (input.planType) where.planType = input.planType;

      return ctx.db.autoPayPlan.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit,
        include: { _count: { select: { scheduledPayments: true } } },
      });
    }),

  getPlan: publicProcedure
    .input(z.object({ planId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.autoPayPlan.findUnique({
        where: { id: input.planId },
        include: {
          scheduledPayments: { orderBy: { sequenceNumber: "asc" } },
        },
      });
    }),

  updatePlan: publicProcedure
    .input(z.object({ planId: z.string(), installmentAmount: z.number().optional(), autoPayEnabled: z.boolean().optional(), paymentMethodId: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { planId, ...data } = input;
      return ctx.db.autoPayPlan.update({ where: { id: planId }, data });
    }),

  pausePlan: publicProcedure
    .input(z.object({ planId: z.string(), reason: z.string(), resumeDate: z.date().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.autoPayPlan.update({
        where: { id: input.planId },
        data: { status: "paused", pauseReason: input.reason, pausedAt: new Date(), resumeDate: input.resumeDate },
      });
    }),

  resumePlan: publicProcedure
    .input(z.object({ planId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.autoPayPlan.findUnique({ where: { id: input.planId } });
      if (!plan) throw new Error("Plan not found");

      const nextDate = calculateNextPaymentDate(plan.frequency, new Date(), plan.dayOfMonth);
      return ctx.db.autoPayPlan.update({
        where: { id: input.planId },
        data: { status: "active", pauseReason: null, pausedAt: null, resumeDate: null, nextPaymentDate: nextDate },
      });
    }),

  cancelPlan: publicProcedure
    .input(z.object({ planId: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.scheduledPayment.updateMany({
        where: { planId: input.planId, status: "scheduled" },
        data: { status: "skipped", notes: `Plan cancelled: ${input.reason}` },
      });
      return ctx.db.autoPayPlan.update({
        where: { id: input.planId },
        data: { status: "cancelled", notes: input.reason },
      });
    }),

  waivePayment: publicProcedure
    .input(z.object({ scheduledPaymentId: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.scheduledPayment.update({
        where: { id: input.scheduledPaymentId },
        data: { status: "waived", waivedBy: DEFAULT_USER_ID, waivedReason: input.reason },
      });
    }),

  getPaymentSchedule: publicProcedure
    .input(z.object({ planId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.scheduledPayment.findMany({
        where: { planId: input.planId },
        orderBy: { sequenceNumber: "asc" },
      });
    }),

  // ==========================================
  // PAYMENT METHODS
  // ==========================================

  addPaymentMethod: publicProcedure
    .input(z.object({
      portalAccountId: z.string().optional(),
      clientName: z.string(),
      clientEmail: z.string(),
      methodType: z.string(),
      lastFour: z.string(),
      cardBrand: z.string().optional(),
      expiryMonth: z.number().optional(),
      expiryYear: z.number().optional(),
      bankName: z.string().optional(),
      accountLastFour: z.string().optional(),
      isDefault: z.boolean().optional(),
      billingAddress: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const token = tokenizePaymentMethod({
        type: input.methodType,
        lastFour: input.lastFour,
        cardBrand: input.cardBrand,
        expiryMonth: input.expiryMonth,
        expiryYear: input.expiryYear,
      });

      if (input.isDefault) {
        await ctx.db.clientPaymentMethod.updateMany({
          where: { clientEmail: input.clientEmail, firmId: DEFAULT_FIRM_ID },
          data: { isDefault: false },
        });
      }

      return ctx.db.clientPaymentMethod.create({
        data: {
          ...input,
          processorToken: token.processorToken,
          verifiedAt: new Date(),
          firmId: DEFAULT_FIRM_ID,
        },
      });
    }),

  getPaymentMethods: publicProcedure
    .input(z.object({ portalAccountId: z.string().optional(), clientEmail: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID, isActive: true };
      if (input.portalAccountId) where.portalAccountId = input.portalAccountId;
      if (input.clientEmail) where.clientEmail = input.clientEmail;
      return ctx.db.clientPaymentMethod.findMany({ where, orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }] });
    }),

  removePaymentMethod: publicProcedure
    .input(z.object({ methodId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.clientPaymentMethod.update({ where: { id: input.methodId }, data: { isActive: false } });
    }),

  // ==========================================
  // TRANSACTIONS & RECEIPTS
  // ==========================================

  processManualPayment: publicProcedure
    .input(z.object({
      matterId: z.string(),
      planId: z.string().optional(),
      amount: z.number(),
      paymentMethodId: z.string().optional(),
      description: z.string(),
      depositAccount: z.string().default("operating"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.paymentMethodId) {
        const result = await processPayment({
          amount: input.amount,
          paymentMethodId: input.paymentMethodId,
          description: input.description,
          matterId: input.matterId,
        });

        if (!result.success) {
          throw new Error(`Payment failed: ${result.failureReason}`);
        }

        // Update plan if linked
        if (input.planId) {
          await ctx.db.autoPayPlan.update({
            where: { id: input.planId },
            data: {
              totalPaid: { increment: input.amount },
              lastPaymentDate: new Date(),
              lastPaymentAmount: input.amount,
            },
          });
        }

        return { success: true, transactionId: result.transactionId };
      }

      return { success: true, transactionId: `manual_${Date.now()}` };
    }),

  recordOfflinePayment: publicProcedure
    .input(z.object({
      matterId: z.string(),
      planId: z.string().optional(),
      amount: z.number(),
      paymentMethod: z.string(),
      description: z.string(),
      depositAccount: z.string(),
      checkNumber: z.string().optional(),
      referenceNumber: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.planId) {
        await ctx.db.autoPayPlan.update({
          where: { id: input.planId },
          data: {
            totalPaid: { increment: input.amount },
            lastPaymentDate: new Date(),
            lastPaymentAmount: input.amount,
          },
        });
      }

      return { success: true, referenceNumber: input.referenceNumber || `offline_${Date.now()}` };
    }),

  getReceipts: publicProcedure
    .input(z.object({ matterId: z.string().optional(), planId: z.string().optional(), limit: z.number().optional().default(20) }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.matterId) where.matterId = input.matterId;
      if (input.planId) where.planId = input.planId;
      return ctx.db.paymentReceipt.findMany({ where, orderBy: { createdAt: "desc" }, take: input.limit });
    }),

  // ==========================================
  // TRUST ACCOUNTING
  // ==========================================

  getTrustAccounts: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.trustAccount.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  }),

  checkCompliance: publicProcedure.query(async () => {
    return checkTrustCompliance(DEFAULT_FIRM_ID);
  }),

  // ==========================================
  // PROCESSING
  // ==========================================

  processScheduled: publicProcedure.mutation(async () => {
    return processScheduledPayments(DEFAULT_FIRM_ID, DEFAULT_USER_ID);
  }),

  sendReminders: publicProcedure.mutation(async () => {
    const sent = await sendPaymentReminders(DEFAULT_FIRM_ID);
    return { sent };
  }),

  // ==========================================
  // AGREEMENTS
  // ==========================================

  generateAgreement: publicProcedure
    .input(z.object({ planId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const plan = await ctx.db.autoPayPlan.findUnique({ where: { id: input.planId } });
      if (!plan) throw new Error("Plan not found");

      const text = `PAYMENT PLAN AGREEMENT\n\nClient: ${plan.clientName}\nMatter: ${plan.planName}\n\nPayment Schedule:\n- Amount per installment: $${plan.installmentAmount}\n- Frequency: ${plan.frequency}\n- Total Amount: $${plan.totalAmount || "Open-ended"}\n- Start Date: ${plan.startDate.toLocaleDateString()}\n${plan.autoPayEnabled ? `- Auto-pay: Enabled\n` : ""}\n${plan.lateFeeEnabled ? `- Late Fee: $${plan.lateFeeAmount || "N/A"} after ${plan.lateFeeDaysGrace} day grace period\n` : ""}\n\nBy signing below, you agree to the terms of this payment plan.`;

      return ctx.db.paymentPlanAgreement.create({
        data: {
          planId: input.planId,
          matterId: plan.matterId,
          clientName: plan.clientName,
          agreementText: text,
          firmId: DEFAULT_FIRM_ID,
        },
      });
    }),

  getAgreement: publicProcedure
    .input(z.object({ planId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.paymentPlanAgreement.findFirst({ where: { planId: input.planId } });
    }),

  recordSignature: publicProcedure
    .input(z.object({ planId: z.string(), signatureData: z.string().optional(), acceptedVia: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.paymentPlanAgreement.updateMany({
        where: { planId: input.planId },
        data: { termsAccepted: true, acceptedAt: new Date(), acceptedVia: input.acceptedVia, signatureData: input.signatureData },
      });

      await ctx.db.autoPayPlan.update({
        where: { id: input.planId },
        data: { clientSignedAt: new Date() },
      });

      return { success: true };
    }),

  // ==========================================
  // ANALYTICS
  // ==========================================

  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const plans = await ctx.db.autoPayPlan.findMany({ where: { firmId: DEFAULT_FIRM_ID } });
    const active = plans.filter((p) => p.status === "active");
    const autoPayCount = active.filter((p) => p.autoPayEnabled).length;
    const totalOutstanding = active.reduce((sum, p) => sum + (p.remainingBalance || 0), 0);
    const totalCollected = plans.reduce((sum, p) => sum + p.totalPaid, 0);

    const failedThisWeek = await ctx.db.scheduledPayment.count({
      where: { firmId: DEFAULT_FIRM_ID, status: "failed", updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });

    const receipts = await ctx.db.paymentReceipt.findMany({
      where: { firmId: DEFAULT_FIRM_ID, createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } },
    });
    const monthlyRevenue = receipts.reduce((sum, r) => sum + r.amount, 0);

    return {
      activePlans: active.length,
      completedPlans: plans.filter((p) => p.status === "completed").length,
      defaultedPlans: plans.filter((p) => p.status === "defaulted").length,
      autoPayRate: active.length > 0 ? Math.round((autoPayCount / active.length) * 100) : 0,
      totalOutstanding,
      totalCollected,
      monthlyRevenue,
      failedThisWeek,
    };
  }),

  getAgingReport: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const plans = await ctx.db.autoPayPlan.findMany({
      where: { firmId: DEFAULT_FIRM_ID, status: { in: ["active", "paused"] }, remainingBalance: { gt: 0 } },
    });

    const aging = { current: 0, days30: 0, days60: 0, days90: 0, days90plus: 0 };
    for (const plan of plans) {
      const balance = plan.remainingBalance || 0;
      const lastPaid = plan.lastPaymentDate || plan.startDate;
      const daysSince = Math.ceil((now.getTime() - lastPaid.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSince <= 30) aging.current += balance;
      else if (daysSince <= 60) aging.days30 += balance;
      else if (daysSince <= 90) aging.days60 += balance;
      else aging.days90plus += balance;
    }

    return aging;
  }),
});
