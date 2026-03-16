import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { sendInterestNotice } from "@/lib/email";

const INTEREST_TYPE_ENUM = ["LATE_FEE", "INTEREST", "EARLY_PAYMENT_DISCOUNT"] as const;

const USURY_CAPS: Record<string, number> = {
  NY: 16, CA: 10, TX: 18, FL: 18, NJ: 30, PA: 6, OH: 8, IL: 9, GA: 5, VA: 12,
  MA: 20, WA: 12, CO: 45, AZ: 36, MI: 25, NC: 8, MD: 33, IN: 36, MO: 9, WI: 12,
};

export const interestRouter = router({
  // ─── Charges ───────────────────────────────────────────────────

  listCharges: publicProcedure
    .input(z.object({
      invoiceId: z.string().optional(),
      clientId: z.string().optional(),
      type: z.enum(INTEREST_TYPE_ENUM).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.invoiceId) where.invoiceId = input.invoiceId;
      if (input?.type) where.type = input.type;
      if (input?.startDate || input?.endDate) {
        where.appliedDate = {};
        if (input?.startDate) where.appliedDate.gte = new Date(input.startDate);
        if (input?.endDate) where.appliedDate.lte = new Date(input.endDate);
      }
      if (input?.clientId) {
        where.invoice = { matter: { clientId: input.clientId } };
      }
      return ctx.db.interestCharge.findMany({
        where,
        include: { invoice: { include: { matter: { include: { client: true } } } } },
        orderBy: { appliedDate: "desc" },
        take: 100,
      });
    }),

  getCharge: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.interestCharge.findUniqueOrThrow({
        where: { id: input.id },
        include: { invoice: { include: { matter: { include: { client: true } } } } },
      });
    }),

  waiveCharge: publicProcedure
    .input(z.object({ id: z.string(), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.interestCharge.update({
        where: { id: input.id },
        data: { isWaived: true, waivedAt: new Date(), waiveReason: input.reason },
      });
    }),

  bulkWaive: publicProcedure
    .input(z.object({ ids: z.array(z.string()), reason: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.interestCharge.updateMany({
        where: { id: { in: input.ids } },
        data: { isWaived: true, waivedAt: new Date(), waiveReason: input.reason },
      });
    }),

  // ─── Calculation ───────────────────────────────────────────────

  calculateInterest: publicProcedure
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
      const settings = await ctx.db.interestSettings.findUnique({ where: { id: "default" } });
      if (!settings?.lateInterestEnabled) return { interestDue: 0, daysLate: 0, rate: 0, breakdown: "Interest not enabled" };

      const now = new Date();
      const due = new Date(invoice.dueDate);
      const daysLate = Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)) - settings.gracePeriodDays);
      if (daysLate <= 0) return { interestDue: 0, daysLate: 0, rate: 0, breakdown: "Not yet overdue (within grace period)" };

      const outstanding = Number(invoice.total) - Number(invoice.amountPaid);
      if (outstanding <= 0) return { interestDue: 0, daysLate, rate: 0, breakdown: "Invoice fully paid" };

      const existingCharges = await ctx.db.interestCharge.findMany({
        where: { invoiceId: input.invoiceId, isWaived: false },
      });
      const existingInterest = existingCharges.reduce((s, c) => s + (c.type !== "EARLY_PAYMENT_DISCOUNT" ? Number(c.amount) : 0), 0);

      let interestDue = 0;
      let rate = 0;
      let breakdown = "";

      switch (settings.lateInterestType) {
        case "FLAT_FEE": {
          const alreadyApplied = existingCharges.some((c) => c.type === "LATE_FEE");
          if (!alreadyApplied || !settings.applyFlatFeeOnce) {
            interestDue = Number(settings.flatFeeAmount || 0);
            breakdown = `Flat late fee: $${interestDue.toFixed(2)}`;
          } else {
            breakdown = "Flat fee already applied";
          }
          break;
        }
        case "PERCENTAGE": {
          rate = Number(settings.percentageRate || 0);
          const periods = settings.compoundFrequency === "monthly" ? Math.floor(daysLate / 30)
            : settings.compoundFrequency === "weekly" ? Math.floor(daysLate / 7)
            : settings.compoundFrequency === "daily" ? daysLate : 1;
          const effectivePeriods = Math.max(1, periods);
          interestDue = outstanding * rate * effectivePeriods - existingInterest;
          breakdown = `${(rate * 100).toFixed(2)}% × ${effectivePeriods} period(s) on $${outstanding.toFixed(2)}`;
          break;
        }
        case "DAILY_RATE": {
          rate = Number(settings.dailyRate || 0);
          interestDue = outstanding * rate * daysLate - existingInterest;
          breakdown = `${(rate * 100).toFixed(4)}%/day × ${daysLate} days on $${outstanding.toFixed(2)}`;
          break;
        }
      }

      // Cap at max percentage
      if (settings.maxInterestPercentage) {
        const maxAmount = Number(invoice.total) * (Number(settings.maxInterestPercentage) / 100);
        if (existingInterest + interestDue > maxAmount) {
          interestDue = Math.max(0, maxAmount - existingInterest);
          breakdown += ` (capped at ${Number(settings.maxInterestPercentage)}%)`;
        }
      }

      // Cap at usury rate
      if (settings.usuryRateCap) {
        const annualCap = Number(settings.usuryRateCap) / 100;
        const maxAnnual = Number(invoice.total) * annualCap * (daysLate / 365);
        if (existingInterest + interestDue > maxAnnual) {
          interestDue = Math.max(0, maxAnnual - existingInterest);
          breakdown += ` (usury cap applied)`;
        }
      }

      interestDue = Math.max(0, Math.round(interestDue * 100) / 100);

      return { interestDue, daysLate, rate, breakdown };
    }),

  applyInterest: publicProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUniqueOrThrow({
        where: { id: input.invoiceId },
        include: { matter: { include: { client: true } } },
      });
      const settings = await ctx.db.interestSettings.findUnique({ where: { id: "default" } });
      if (!settings?.lateInterestEnabled) return null;

      const now = new Date();
      const due = new Date(invoice.dueDate);
      const daysLate = Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)) - (settings.gracePeriodDays || 0));
      if (daysLate <= 0) return null;

      const outstanding = Number(invoice.total) - Number(invoice.amountPaid);
      if (outstanding <= 0) return null;

      // Use the calculation logic inline for the mutation
      const existingCharges = await ctx.db.interestCharge.findMany({
        where: { invoiceId: input.invoiceId, isWaived: false },
      });
      const existingInterest = existingCharges.reduce((s, c) => s + (c.type !== "EARLY_PAYMENT_DISCOUNT" ? Number(c.amount) : 0), 0);

      let interestDue = 0;
      let chargeType: any = "INTEREST";
      let rate = 0;
      let description = "";

      switch (settings.lateInterestType) {
        case "FLAT_FEE": {
          const alreadyApplied = existingCharges.some((c) => c.type === "LATE_FEE");
          if (alreadyApplied && settings.applyFlatFeeOnce) return null;
          interestDue = Number(settings.flatFeeAmount || 0);
          chargeType = "LATE_FEE";
          description = `Late fee — ${daysLate} days overdue`;
          break;
        }
        case "PERCENTAGE": {
          rate = Number(settings.percentageRate || 0);
          const periods = settings.compoundFrequency === "monthly" ? Math.floor(daysLate / 30)
            : settings.compoundFrequency === "weekly" ? Math.floor(daysLate / 7)
            : settings.compoundFrequency === "daily" ? daysLate : 1;
          interestDue = outstanding * rate * Math.max(1, periods) - existingInterest;
          description = `Interest — ${(rate * 100).toFixed(2)}% × ${Math.max(1, periods)} period(s)`;
          break;
        }
        case "DAILY_RATE": {
          rate = Number(settings.dailyRate || 0);
          interestDue = outstanding * rate * daysLate - existingInterest;
          description = `Daily interest — ${(rate * 100).toFixed(4)}%/day × ${daysLate} days`;
          break;
        }
      }

      if (settings.maxInterestPercentage) {
        const maxAmount = Number(invoice.total) * (Number(settings.maxInterestPercentage) / 100);
        interestDue = Math.min(interestDue, Math.max(0, maxAmount - existingInterest));
      }
      if (settings.usuryRateCap) {
        const maxAnnual = Number(invoice.total) * (Number(settings.usuryRateCap) / 100) * (daysLate / 365);
        interestDue = Math.min(interestDue, Math.max(0, maxAnnual - existingInterest));
      }

      interestDue = Math.max(0, Math.round(interestDue * 100) / 100);
      if (interestDue <= 0) return null;

      const charge = await ctx.db.interestCharge.create({
        data: {
          invoiceId: input.invoiceId,
          type: chargeType,
          amount: interestDue,
          rate: rate || undefined,
          daysLate,
          description,
        },
      });

      // Notify client
      if (settings.notifyClientOnInterest && invoice.matter?.client?.email) {
        await sendInterestNotice({
          to: invoice.matter.client.email,
          clientName: invoice.matter.client.name,
          invoiceNumber: invoice.invoiceNumber,
          interestAmount: interestDue,
          totalNowDue: outstanding + interestDue,
          daysLate,
          firmName: "Law Firm",
          fromEmail: "noreply@example.com",
        }).catch(() => {});
      }

      return charge;
    }),

  calculateEarlyDiscount: publicProcedure
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
      const settings = await ctx.db.interestSettings.findUnique({ where: { id: "default" } });
      if (!settings?.earlyPaymentEnabled) return null;

      const deadline = new Date(invoice.issueDate);
      deadline.setDate(deadline.getDate() + settings.earlyPaymentDays);
      const now = new Date();
      const daysEarly = Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      if (now > deadline) return null;

      const discountRate = Number(settings.earlyPaymentDiscountPercentage || 0) / 100;
      const discountAmount = Math.round(Number(invoice.subtotal) * discountRate * 100) / 100;

      return {
        discountAmount,
        discountPercentage: Number(settings.earlyPaymentDiscountPercentage),
        daysEarly,
        deadline: deadline.toISOString(),
        terms: settings.earlyPaymentTerms || `${Number(settings.earlyPaymentDiscountPercentage)}/${settings.earlyPaymentDays} Net 30`,
      };
    }),

  applyEarlyDiscount: publicProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
      const settings = await ctx.db.interestSettings.findUnique({ where: { id: "default" } });
      if (!settings?.earlyPaymentEnabled) throw new Error("Early payment discounts not enabled");

      const deadline = new Date(invoice.issueDate);
      deadline.setDate(deadline.getDate() + settings.earlyPaymentDays);
      if (new Date() > deadline) throw new Error("Early payment window has passed");

      const existing = await ctx.db.interestCharge.findFirst({
        where: { invoiceId: input.invoiceId, type: "EARLY_PAYMENT_DISCOUNT", isWaived: false },
      });
      if (existing) throw new Error("Discount already applied");

      const discountRate = Number(settings.earlyPaymentDiscountPercentage || 0) / 100;
      const discountAmount = Math.round(Number(invoice.subtotal) * discountRate * 100) / 100;
      const daysEarly = Math.floor((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

      return ctx.db.interestCharge.create({
        data: {
          invoiceId: input.invoiceId,
          type: "EARLY_PAYMENT_DISCOUNT",
          amount: -discountAmount,
          rate: discountRate,
          daysEarly,
          description: `Early payment discount — ${Number(settings.earlyPaymentDiscountPercentage)}% (${daysEarly} days early)`,
        },
      });
    }),

  processAllOverdue: publicProcedure.mutation(async ({ ctx }) => {
    const settings = await ctx.db.interestSettings.findUnique({ where: { id: "default" } });
    if (!settings?.autoApply || !settings?.lateInterestEnabled) return { processed: 0, interestApplied: 0, totalInterestAmount: 0, skipped: 0 };

    const graceDays = settings.gracePeriodDays || 0;
    const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);

    const overdueInvoices = await ctx.db.invoice.findMany({
      where: {
        status: { in: ["SENT", "OVERDUE"] },
        dueDate: { lt: cutoff },
        amountPaid: { lt: ctx.db.invoice.fields?.total || 999999999 },
      },
      include: { matter: { include: { client: true } } },
    });

    let interestApplied = 0;
    let totalInterestAmount = 0;
    let skipped = 0;

    for (const inv of overdueInvoices) {
      const outstanding = Number(inv.total) - Number(inv.amountPaid);
      if (outstanding <= 0) { skipped++; continue; }

      try {
        // Reuse applyInterest logic — simplified inline
        const result = await ctx.db.interestCharge.findMany({
          where: { invoiceId: inv.id, isWaived: false, type: { not: "EARLY_PAYMENT_DISCOUNT" } },
        });
        const existingInterest = result.reduce((s, c) => s + Number(c.amount), 0);
        const daysLate = Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)) - graceDays);
        if (daysLate <= 0) { skipped++; continue; }

        let amt = 0;
        let cType: any = "INTEREST";
        let desc = "";

        if (settings.lateInterestType === "FLAT_FEE") {
          const hasFlat = result.some((c) => c.type === "LATE_FEE");
          if (hasFlat && settings.applyFlatFeeOnce) { skipped++; continue; }
          amt = Number(settings.flatFeeAmount || 0);
          cType = "LATE_FEE";
          desc = `Late fee — ${daysLate} days overdue`;
        } else if (settings.lateInterestType === "PERCENTAGE") {
          const rate = Number(settings.percentageRate || 0);
          const periods = settings.compoundFrequency === "monthly" ? Math.max(1, Math.floor(daysLate / 30)) : settings.compoundFrequency === "daily" ? daysLate : 1;
          amt = outstanding * rate * periods - existingInterest;
          desc = `Interest — ${(rate * 100).toFixed(2)}% × ${periods}`;
        } else {
          const rate = Number(settings.dailyRate || 0);
          amt = outstanding * rate * daysLate - existingInterest;
          desc = `Daily interest — ${daysLate} days`;
        }

        if (settings.maxInterestPercentage) {
          amt = Math.min(amt, Math.max(0, Number(inv.total) * Number(settings.maxInterestPercentage) / 100 - existingInterest));
        }
        amt = Math.max(0, Math.round(amt * 100) / 100);
        if (amt <= 0) { skipped++; continue; }

        await ctx.db.interestCharge.create({
          data: { invoiceId: inv.id, type: cType, amount: amt, daysLate, description: desc },
        });
        interestApplied++;
        totalInterestAmount += amt;
      } catch {
        skipped++;
      }
    }

    return { processed: overdueInvoices.length, interestApplied, totalInterestAmount, skipped };
  }),

  recalculateInvoice: publicProcedure
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const charges = await ctx.db.interestCharge.findMany({
        where: { invoiceId: input.invoiceId, isWaived: false },
      });
      const interest = charges.filter((c) => c.type !== "EARLY_PAYMENT_DISCOUNT").reduce((s, c) => s + Number(c.amount), 0);
      const discounts = charges.filter((c) => c.type === "EARLY_PAYMENT_DISCOUNT").reduce((s, c) => s + Math.abs(Number(c.amount)), 0);
      const invoice = await ctx.db.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
      return {
        originalTotal: Number(invoice.total),
        totalInterest: interest,
        totalDiscounts: discounts,
        adjustedTotal: Number(invoice.total) + interest - discounts,
        amountPaid: Number(invoice.amountPaid),
        amountDue: Number(invoice.total) + interest - discounts - Number(invoice.amountPaid),
      };
    }),

  getProjection: publicProcedure
    .input(z.object({ invoiceId: z.string(), days: z.number().min(1).max(365) }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
      const settings = await ctx.db.interestSettings.findUnique({ where: { id: "default" } });
      if (!settings?.lateInterestEnabled) return [];

      const outstanding = Number(invoice.total) - Number(invoice.amountPaid);
      if (outstanding <= 0) return [];

      const rate = settings.lateInterestType === "DAILY_RATE"
        ? Number(settings.dailyRate || 0)
        : settings.lateInterestType === "PERCENTAGE"
        ? Number(settings.percentageRate || 0) / 30
        : 0;

      const projection = [];
      for (let d = 1; d <= input.days; d++) {
        projection.push({
          day: d,
          accruedInterest: Math.round(outstanding * rate * d * 100) / 100,
          totalDue: Math.round((outstanding + outstanding * rate * d) * 100) / 100,
        });
      }
      return projection;
    }),

  // ─── Settings ──────────────────────────────────────────────────

  getSettings: publicProcedure.query(async ({ ctx }) => {
    let s = await ctx.db.interestSettings.findUnique({ where: { id: "default" } });
    if (!s) s = await ctx.db.interestSettings.create({ data: { id: "default" } });
    return s;
  }),

  updateSettings: publicProcedure
    .input(z.object({
      isEnabled: z.boolean().optional(),
      lateInterestEnabled: z.boolean().optional(),
      lateInterestType: z.enum(["FLAT_FEE", "PERCENTAGE", "DAILY_RATE"]).optional(),
      flatFeeAmount: z.number().optional().nullable(),
      percentageRate: z.number().optional().nullable(),
      dailyRate: z.number().optional().nullable(),
      gracePeriodDays: z.number().optional(),
      compoundFrequency: z.string().optional(),
      maxInterestPercentage: z.number().optional().nullable(),
      applyFlatFeeOnce: z.boolean().optional(),
      earlyPaymentEnabled: z.boolean().optional(),
      earlyPaymentDiscountPercentage: z.number().optional().nullable(),
      earlyPaymentDays: z.number().optional(),
      earlyPaymentTerms: z.string().optional().nullable(),
      includeInterestOnStatements: z.boolean().optional(),
      autoApply: z.boolean().optional(),
      notifyClientOnInterest: z.boolean().optional(),
      notifyClientOnDiscount: z.boolean().optional(),
      legalDisclosure: z.string().optional().nullable(),
      usuryRateCap: z.number().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.interestSettings.upsert({
        where: { id: "default" },
        create: { id: "default", ...input },
        update: input,
      });
    }),

  getUsuryCap: publicProcedure
    .input(z.object({ state: z.string() }))
    .query(({ input }) => {
      const cap = USURY_CAPS[input.state.toUpperCase()];
      return cap != null ? { state: input.state.toUpperCase(), cap } : null;
    }),

  // ─── Stats ─────────────────────────────────────────────────────

  getStats: publicProcedure
    .input(z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.startDate || input?.endDate) {
        where.appliedDate = {};
        if (input?.startDate) where.appliedDate.gte = new Date(input.startDate);
        if (input?.endDate) where.appliedDate.lte = new Date(input.endDate);
      }

      const charges = await ctx.db.interestCharge.findMany({
        where,
        include: { invoice: { include: { matter: { include: { client: true } } } } },
      });

      const interestCharges = charges.filter((c) => c.type !== "EARLY_PAYMENT_DISCOUNT" && !c.isWaived);
      const waived = charges.filter((c) => c.isWaived);
      const discounts = charges.filter((c) => c.type === "EARLY_PAYMENT_DISCOUNT" && !c.isWaived);
      const totalInterest = interestCharges.reduce((s, c) => s + Number(c.amount), 0);
      const totalWaived = waived.reduce((s, c) => s + Number(c.amount), 0);
      const totalDiscounts = discounts.reduce((s, c) => s + Math.abs(Number(c.amount)), 0);
      const avgDaysLate = interestCharges.length > 0
        ? interestCharges.reduce((s, c) => s + (c.daysLate || 0), 0) / interestCharges.length : 0;

      const overdueCount = await ctx.db.invoice.count({
        where: { status: { in: ["SENT", "OVERDUE"] }, dueDate: { lt: new Date() } },
      });

      const clientsWithInterest = new Set(interestCharges.map((c) => c.invoice?.matter?.clientId).filter(Boolean));

      // Monthly data
      const byMonth: Record<string, { interest: number; discounts: number }> = {};
      for (const c of charges) {
        const month = new Date(c.appliedDate).toISOString().slice(0, 7);
        if (!byMonth[month]) byMonth[month] = { interest: 0, discounts: 0 };
        if (c.type === "EARLY_PAYMENT_DISCOUNT" && !c.isWaived) {
          byMonth[month].discounts += Math.abs(Number(c.amount));
        } else if (!c.isWaived) {
          byMonth[month].interest += Number(c.amount);
        }
      }

      return {
        totalInterest,
        totalWaived,
        totalDiscounts,
        avgDaysLate: Math.round(avgDaysLate),
        overdueCount,
        clientsWithInterest: clientsWithInterest.size,
        byMonth,
      };
    }),
});
