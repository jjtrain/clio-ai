import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { sendSms, getTwilioConfig } from "@/lib/twilio";

// ==================== DEFAULT TEMPLATES ====================

const DEFAULT_EMAIL_UPCOMING = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #1E40AF;">Payment Reminder</h2>
<p>Dear {CLIENT_NAME},</p>
<p>This is a friendly reminder that Invoice <strong>#{INVOICE_NUMBER}</strong> for <strong>{AMOUNT_DUE}</strong> is due on <strong>{DUE_DATE}</strong>.</p>
<p>Please ensure payment is submitted by the due date to avoid any late fees.</p>
{PAYMENT_LINK}
<p>If you have any questions, please don't hesitate to contact our office.</p>
<p>Thank you,<br/>{FIRM_NAME}</p>
</div>`;

const DEFAULT_EMAIL_DUE_TODAY = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #1E40AF;">Invoice Due Today</h2>
<p>Dear {CLIENT_NAME},</p>
<p>This is a reminder that Invoice <strong>#{INVOICE_NUMBER}</strong> for <strong>{AMOUNT_DUE}</strong> is due today.</p>
<p>Please submit your payment at your earliest convenience.</p>
{PAYMENT_LINK}
<p>If payment has already been sent, please disregard this notice.</p>
<p>Thank you,<br/>{FIRM_NAME}</p>
</div>`;

const DEFAULT_EMAIL_PAST_DUE = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
<h2 style="color: #DC2626;">Past Due Notice</h2>
<p>Dear {CLIENT_NAME},</p>
<p>Our records indicate that Invoice <strong>#{INVOICE_NUMBER}</strong> for <strong>{AMOUNT_DUE}</strong> is now <strong>{DAYS_OVERDUE} days past due</strong>.</p>
<p>We kindly request that you remit payment as soon as possible. If you are experiencing financial difficulties, please contact our office to discuss payment plan options.</p>
{PAYMENT_LINK}
<p>If payment has already been sent, please disregard this notice.</p>
<p>Regards,<br/>{FIRM_NAME}</p>
</div>`;

const DEFAULT_TEXT_UPCOMING = "{FIRM_NAME}: Reminder - Invoice #{INVOICE_NUMBER} for {AMOUNT_DUE} is due on {DUE_DATE}. Questions? Call us.";
const DEFAULT_TEXT_DUE_TODAY = "{FIRM_NAME}: Invoice #{INVOICE_NUMBER} for {AMOUNT_DUE} is due today. Pay now or contact our office.";
const DEFAULT_TEXT_PAST_DUE = "{FIRM_NAME}: Invoice #{INVOICE_NUMBER} for {AMOUNT_DUE} is {DAYS_OVERDUE} days past due. Please remit payment promptly.";

function getEmailSubjectForType(type: string, daysOverdue: number): string {
  switch (type) {
    case "UPCOMING_DUE": return "Reminder: Invoice #{INVOICE_NUMBER} Due on {DUE_DATE}";
    case "DUE_TODAY": return "Invoice #{INVOICE_NUMBER} Due Today - {AMOUNT_DUE}";
    case "PAST_DUE_3": return "Friendly Reminder: Invoice #{INVOICE_NUMBER} Past Due";
    case "PAST_DUE_7": return "Second Notice: Invoice #{INVOICE_NUMBER} - {DAYS_OVERDUE} Days Past Due";
    case "PAST_DUE_14": return "Important: Invoice #{INVOICE_NUMBER} Requires Immediate Attention";
    default: return "Final Notice: Invoice #{INVOICE_NUMBER} - {DAYS_OVERDUE} Days Overdue";
  }
}

function getEmailBodyForType(type: string): string {
  if (type === "UPCOMING_DUE") return DEFAULT_EMAIL_UPCOMING;
  if (type === "DUE_TODAY") return DEFAULT_EMAIL_DUE_TODAY;
  return DEFAULT_EMAIL_PAST_DUE;
}

function getTextBodyForType(type: string): string {
  if (type === "UPCOMING_DUE") return DEFAULT_TEXT_UPCOMING;
  if (type === "DUE_TODAY") return DEFAULT_TEXT_DUE_TODAY;
  return DEFAULT_TEXT_PAST_DUE;
}

function replacePlaceholders(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function getDaysOverdue(dueDate: Date): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)));
}

function getReminderTypeForDays(days: number): string {
  if (days <= 0) return "UPCOMING_DUE";
  if (days === 0) return "DUE_TODAY";
  if (days <= 3) return "PAST_DUE_3";
  if (days <= 7) return "PAST_DUE_7";
  if (days <= 14) return "PAST_DUE_14";
  if (days <= 30) return "PAST_DUE_30";
  if (days <= 60) return "PAST_DUE_60";
  return "PAST_DUE_90";
}

function addDaysToDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function calculateNextDueDate(startDate: Date, frequency: string, installmentNumber: number): Date {
  const date = new Date(startDate);
  switch (frequency) {
    case "WEEKLY":
      date.setDate(date.getDate() + 7 * installmentNumber);
      break;
    case "BIWEEKLY":
      date.setDate(date.getDate() + 14 * installmentNumber);
      break;
    case "MONTHLY":
      date.setMonth(date.getMonth() + installmentNumber);
      break;
  }
  return date;
}

export const billingRemindersRouter = router({
  // ==================== REMINDERS ====================

  listReminders: publicProcedure
    .input(z.object({
      invoiceId: z.string().optional(),
      status: z.string().optional(),
      type: z.string().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.invoiceId) where.invoiceId = input.invoiceId;
      if (input?.status) where.status = input.status;
      if (input?.type) where.type = input.type;
      if (input?.startDate || input?.endDate) {
        where.scheduledFor = {};
        if (input?.startDate) where.scheduledFor.gte = new Date(input.startDate);
        if (input?.endDate) where.scheduledFor.lte = new Date(input.endDate);
      }
      return ctx.db.billingReminder.findMany({
        where,
        orderBy: { scheduledFor: "desc" },
        include: {
          invoice: {
            include: {
              matter: { include: { client: { select: { id: true, name: true, email: true, phone: true } } } },
            },
          },
        },
      });
    }),

  getReminder: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.billingReminder.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          invoice: {
            include: {
              matter: { include: { client: true } },
            },
          },
        },
      });
    }),

  scheduleReminder: publicProcedure
    .input(z.object({
      invoiceId: z.string(),
      type: z.string(),
      method: z.string().default("EMAIL"),
      scheduledFor: z.string(),
      emailSubject: z.string().optional(),
      emailContent: z.string().optional(),
      textContent: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.billingReminder.create({
        data: {
          invoiceId: input.invoiceId,
          type: input.type as any,
          method: input.method as any,
          status: "SCHEDULED" as any,
          scheduledFor: new Date(input.scheduledFor),
          emailSubject: input.emailSubject,
          emailContent: input.emailContent,
          textContent: input.textContent,
        },
      });
    }),

  cancelReminder: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.billingReminder.update({
        where: { id: input.id },
        data: { status: "CANCELLED" as any },
      });
    }),

  sendReminder: publicProcedure
    .input(z.object({ reminderId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const reminder = await ctx.db.billingReminder.findUniqueOrThrow({
        where: { id: input.reminderId },
        include: {
          invoice: {
            include: { matter: { include: { client: true } } },
          },
        },
      });

      const invoice = reminder.invoice;
      const client = invoice.matter.client;
      const balance = parseFloat(invoice.total.toString()) - parseFloat(invoice.amountPaid.toString());
      const daysOverdue = getDaysOverdue(invoice.dueDate);
      const firmSettings = await ctx.db.settings.findUnique({ where: { id: "default" } }).catch(() => null);
      const billingSettings = await ctx.db.billingReminderSettings.findUnique({ where: { id: "default" } }).catch(() => null);

      const vars: Record<string, string> = {
        CLIENT_NAME: client.name,
        INVOICE_NUMBER: invoice.invoiceNumber,
        AMOUNT_DUE: formatCurrency(balance),
        DUE_DATE: new Date(invoice.dueDate).toLocaleDateString(),
        DAYS_OVERDUE: daysOverdue.toString(),
        FIRM_NAME: (firmSettings as any)?.firmName || "Our Firm",
        PAYMENT_LINK: billingSettings?.includePaymentLink
          ? `<p><a href="${process.env.NEXTAUTH_URL || ""}/billing/${invoice.id}" style="background:#1E40AF;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Pay Now</a></p>`
          : "",
      };

      let emailSent = false;
      let textSent = false;
      let errorMsg = "";

      const method = reminder.method;

      // Send email
      if ((method === "EMAIL" || method === "BOTH") && client.email) {
        const subject = replacePlaceholders(
          reminder.emailSubject || getEmailSubjectForType(reminder.type, daysOverdue),
          vars
        );
        const body = replacePlaceholders(
          reminder.emailContent || getEmailBodyForType(reminder.type),
          vars
        );
        // In production would use email service; log for now
        console.log(`[Billing Reminder] Email to ${client.email}: ${subject}`);
        emailSent = true;
      }

      // Send text
      if ((method === "TEXT" || method === "BOTH") && client.phone) {
        const textBody = replacePlaceholders(
          reminder.textContent || getTextBodyForType(reminder.type),
          vars
        );
        try {
          const config = await getTwilioConfig();
          if (config) {
            await sendSms(config, client.phone, textBody);
            textSent = true;
          } else {
            errorMsg = "Twilio not configured";
          }
        } catch (err: any) {
          errorMsg = err.message || "Failed to send text";
        }
      }

      const success = emailSent || textSent;
      return ctx.db.billingReminder.update({
        where: { id: input.reminderId },
        data: {
          status: success ? ("SENT" as any) : ("FAILED" as any),
          sentAt: success ? new Date() : null,
          errorMessage: errorMsg || null,
        },
      });
    }),

  autoScheduleForInvoice: publicProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUniqueOrThrow({ where: { id: input.invoiceId } });
      let settings = await ctx.db.billingReminderSettings.findUnique({ where: { id: "default" } });
      if (!settings) {
        settings = await ctx.db.billingReminderSettings.create({ data: { id: "default" } });
      }

      const dueDate = new Date(invoice.dueDate);
      const method = (settings.defaultMethod || "EMAIL") as any;
      const reminders: any[] = [];

      // Upcoming (3 days before)
      if (settings.sendUpcomingReminder) {
        const scheduledFor = addDaysToDate(dueDate, -3);
        if (scheduledFor > new Date()) {
          reminders.push({
            invoiceId: input.invoiceId,
            type: "UPCOMING_DUE",
            method,
            status: "SCHEDULED",
            scheduledFor,
          });
        }
      }

      // Due today
      if (settings.sendDueDayReminder) {
        const scheduledFor = new Date(dueDate);
        scheduledFor.setHours(9, 0, 0, 0);
        if (scheduledFor > new Date()) {
          reminders.push({
            invoiceId: input.invoiceId,
            type: "DUE_TODAY",
            method,
            status: "SCHEDULED",
            scheduledFor,
          });
        }
      }

      // Past due series
      if (settings.sendPastDueReminders) {
        const schedule = (settings.pastDueSchedule || "3,7,14,30,60,90").split(",").map((s) => parseInt(s.trim()));
        for (const days of schedule) {
          const scheduledFor = addDaysToDate(dueDate, days);
          const type = getReminderTypeForDays(days);
          if (scheduledFor > new Date()) {
            reminders.push({
              invoiceId: input.invoiceId,
              type,
              method,
              status: "SCHEDULED",
              scheduledFor,
            });
          }
        }
      }

      if (reminders.length > 0) {
        await ctx.db.billingReminder.createMany({ data: reminders });
      }

      return ctx.db.billingReminder.findMany({
        where: { invoiceId: input.invoiceId, status: "SCHEDULED" },
        orderBy: { scheduledFor: "asc" },
      });
    }),

  bulkAutoSchedule: publicProcedure.mutation(async ({ ctx }) => {
    const invoices = await ctx.db.invoice.findMany({
      where: {
        status: { in: ["SENT", "OVERDUE"] },
        reminders: { none: { status: "SCHEDULED" } },
      },
    });

    let count = 0;
    for (const invoice of invoices) {
      let settings = await ctx.db.billingReminderSettings.findUnique({ where: { id: "default" } });
      if (!settings) {
        settings = await ctx.db.billingReminderSettings.create({ data: { id: "default" } });
      }

      const dueDate = new Date(invoice.dueDate);
      const daysOverdue = getDaysOverdue(dueDate);
      const method = (settings.defaultMethod || "EMAIL") as any;
      const schedule = (settings.pastDueSchedule || "3,7,14,30,60,90").split(",").map((s) => parseInt(s.trim()));

      // Find the next appropriate reminder to schedule
      const nextDay = schedule.find((d) => d > daysOverdue) || schedule[schedule.length - 1];
      if (nextDay > daysOverdue) {
        const scheduledFor = addDaysToDate(dueDate, nextDay);
        await ctx.db.billingReminder.create({
          data: {
            invoiceId: invoice.id,
            type: getReminderTypeForDays(nextDay) as any,
            method,
            status: "SCHEDULED" as any,
            scheduledFor,
          },
        });
        count++;
      }
    }

    return { count };
  }),

  // ==================== PAYMENT PLANS ====================

  listPaymentPlans: publicProcedure
    .input(z.object({
      status: z.string().optional(),
      clientId: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.status) where.status = input.status;
      if (input?.clientId) where.clientId = input.clientId;
      return ctx.db.paymentPlan.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          invoice: { select: { id: true, invoiceNumber: true, total: true, amountPaid: true, status: true } },
          client: { select: { id: true, name: true, email: true } },
          payments: { orderBy: { dueDate: "asc" } },
        },
      });
    }),

  getPaymentPlan: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.paymentPlan.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          invoice: {
            include: { matter: { include: { client: true } } },
          },
          client: { select: { id: true, name: true, email: true, phone: true } },
          payments: { orderBy: { dueDate: "asc" } },
        },
      });
    }),

  createPaymentPlan: publicProcedure
    .input(z.object({
      invoiceId: z.string(),
      clientId: z.string(),
      totalAmount: z.number(),
      installmentAmount: z.number(),
      frequency: z.string(),
      startDate: z.string(),
      installmentCount: z.number().min(2),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const startDate = new Date(input.startDate);

      const plan = await ctx.db.paymentPlan.create({
        data: {
          invoiceId: input.invoiceId,
          clientId: input.clientId,
          totalAmount: input.totalAmount,
          installmentAmount: input.installmentAmount,
          frequency: input.frequency as any,
          startDate,
          nextDueDate: startDate,
          installmentCount: input.installmentCount,
          status: "ACTIVE" as any,
          notes: input.notes,
        },
      });

      // Generate installment records
      const installments = [];
      for (let i = 0; i < input.installmentCount; i++) {
        const dueDate = calculateNextDueDate(startDate, input.frequency, i);
        const isLast = i === input.installmentCount - 1;
        const amount = isLast
          ? input.totalAmount - input.installmentAmount * (input.installmentCount - 1)
          : input.installmentAmount;
        installments.push({
          paymentPlanId: plan.id,
          amount: Math.max(0, amount),
          dueDate,
          status: "UPCOMING" as any,
        });
      }

      await ctx.db.paymentPlanPayment.createMany({ data: installments });

      return ctx.db.paymentPlan.findUniqueOrThrow({
        where: { id: plan.id },
        include: { payments: { orderBy: { dueDate: "asc" } } },
      });
    }),

  updatePaymentPlan: publicProcedure
    .input(z.object({
      id: z.string(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.paymentPlan.update({ where: { id }, data });
    }),

  cancelPaymentPlan: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.paymentPlanPayment.updateMany({
        where: { paymentPlanId: input.id, status: { in: ["UPCOMING", "DUE", "LATE"] } },
        data: { status: "MISSED" as any },
      });
      return ctx.db.paymentPlan.update({
        where: { id: input.id },
        data: { status: "CANCELLED" as any },
      });
    }),

  recordInstallmentPayment: publicProcedure
    .input(z.object({
      installmentId: z.string(),
      amount: z.number(),
      paymentDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const installment = await ctx.db.paymentPlanPayment.findUniqueOrThrow({
        where: { id: input.installmentId },
        include: { paymentPlan: { include: { invoice: true } } },
      });

      const plan = installment.paymentPlan;
      const paidDate = input.paymentDate ? new Date(input.paymentDate) : new Date();

      // Update installment
      await ctx.db.paymentPlanPayment.update({
        where: { id: input.installmentId },
        data: { status: "PAID" as any, paidDate },
      });

      // Record payment on invoice
      await ctx.db.payment.create({
        data: {
          invoiceId: plan.invoiceId,
          amount: input.amount,
          paymentDate: paidDate,
          paymentMethod: "BANK_TRANSFER" as any,
          notes: `Payment plan installment`,
        },
      });

      // Update invoice amountPaid
      await ctx.db.invoice.update({
        where: { id: plan.invoiceId },
        data: { amountPaid: { increment: input.amount } },
      });

      // Update plan
      const newPaidCount = plan.installmentsPaid + 1;
      const isComplete = newPaidCount >= plan.installmentCount;

      // Find next unpaid installment
      const nextInstallment = await ctx.db.paymentPlanPayment.findFirst({
        where: { paymentPlanId: plan.id, status: { in: ["UPCOMING", "DUE"] } },
        orderBy: { dueDate: "asc" },
      });

      await ctx.db.paymentPlan.update({
        where: { id: plan.id },
        data: {
          installmentsPaid: newPaidCount,
          status: isComplete ? ("COMPLETED" as any) : undefined,
          nextDueDate: nextInstallment?.dueDate || null,
        },
      });

      // If invoice fully paid, update status
      const invoice = await ctx.db.invoice.findUnique({ where: { id: plan.invoiceId } });
      if (invoice) {
        const newBalance = parseFloat(invoice.total.toString()) - parseFloat(invoice.amountPaid.toString());
        if (newBalance <= 0.01) {
          await ctx.db.invoice.update({
            where: { id: plan.invoiceId },
            data: { status: "PAID" as any, paidAt: new Date() },
          });
        }
      }

      return { success: true, isComplete };
    }),

  markInstallmentMissed: publicProcedure
    .input(z.object({ installmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const installment = await ctx.db.paymentPlanPayment.findUniqueOrThrow({
        where: { id: input.installmentId },
        include: { paymentPlan: { include: { payments: true, invoice: { include: { matter: { include: { client: true } } } } } } },
      });

      await ctx.db.paymentPlanPayment.update({
        where: { id: input.installmentId },
        data: { status: "MISSED" as any },
      });

      // Check if 3+ missed → default
      const missedCount = installment.paymentPlan.payments.filter((p: any) => p.status === "MISSED").length + 1;
      if (missedCount >= 3) {
        await ctx.db.paymentPlan.update({
          where: { id: installment.paymentPlanId },
          data: { status: "DEFAULTED" as any },
        });

        // Create follow-up task
        const client = installment.paymentPlan.invoice.matter.client;
        await ctx.db.task.create({
          data: {
            title: `Follow up on defaulted payment plan - ${client.name}`,
            description: `Payment plan for invoice #${installment.paymentPlan.invoice.invoiceNumber} has ${missedCount} missed payments and is now defaulted.`,
            status: "TODO" as any,
            priority: "HIGH" as any,
            matterId: installment.paymentPlan.invoice.matterId,
          },
        });
      }

      return { missedCount, defaulted: missedCount >= 3 };
    }),

  getUpcomingInstallments: publicProcedure.query(async ({ ctx }) => {
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    return ctx.db.paymentPlanPayment.findMany({
      where: {
        dueDate: { lte: sevenDaysFromNow },
        status: { in: ["UPCOMING", "DUE"] },
        paymentPlan: { status: "ACTIVE" },
      },
      orderBy: { dueDate: "asc" },
      include: {
        paymentPlan: {
          include: {
            client: { select: { id: true, name: true } },
            invoice: { select: { id: true, invoiceNumber: true } },
          },
        },
      },
    });
  }),

  // ==================== SETTINGS ====================

  getSettings: publicProcedure.query(async ({ ctx }) => {
    let settings = await ctx.db.billingReminderSettings.findUnique({ where: { id: "default" } });
    if (!settings) {
      settings = await ctx.db.billingReminderSettings.create({ data: { id: "default" } });
    }
    return settings;
  }),

  updateSettings: publicProcedure
    .input(z.object({
      isEnabled: z.boolean().optional(),
      sendUpcomingReminder: z.boolean().optional(),
      sendDueDayReminder: z.boolean().optional(),
      sendPastDueReminders: z.boolean().optional(),
      pastDueSchedule: z.string().optional(),
      defaultMethod: z.string().optional(),
      escalateToPhone: z.boolean().optional(),
      includePaymentLink: z.boolean().optional(),
      includeLateFeesNotice: z.boolean().optional(),
      lateFeePercentage: z.number().optional(),
      fromName: z.string().optional(),
      fromEmail: z.string().optional(),
      emailTemplateUpcoming: z.string().optional(),
      emailTemplateDueToday: z.string().optional(),
      emailTemplatePastDue: z.string().optional(),
      textTemplateUpcoming: z.string().optional(),
      textTemplateDueToday: z.string().optional(),
      textTemplatePastDue: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.billingReminderSettings.upsert({
        where: { id: "default" },
        update: input,
        create: { id: "default", ...input },
      });
    }),

  getDefaultTemplates: publicProcedure.query(() => {
    return {
      emailUpcoming: { subject: "Reminder: Invoice #{INVOICE_NUMBER} Due on {DUE_DATE}", body: DEFAULT_EMAIL_UPCOMING },
      emailDueToday: { subject: "Invoice #{INVOICE_NUMBER} Due Today - {AMOUNT_DUE}", body: DEFAULT_EMAIL_DUE_TODAY },
      emailPastDue: { subject: "Past Due: Invoice #{INVOICE_NUMBER} - {DAYS_OVERDUE} Days Overdue", body: DEFAULT_EMAIL_PAST_DUE },
      textUpcoming: DEFAULT_TEXT_UPCOMING,
      textDueToday: DEFAULT_TEXT_DUE_TODAY,
      textPastDue: DEFAULT_TEXT_PAST_DUE,
    };
  }),

  // ==================== STATS ====================

  getStats: publicProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const dateFilter: any = {};
      if (input?.startDate) dateFilter.gte = new Date(input.startDate);
      if (input?.endDate) dateFilter.lte = new Date(input.endDate);
      const createdWhere = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

      const [remindersSent, activePlans, paidInvoices, overdueInvoices, totalOutstanding] = await Promise.all([
        ctx.db.billingReminder.count({ where: { ...createdWhere, status: "SENT" } }),
        ctx.db.paymentPlan.count({ where: { status: "ACTIVE" } }),
        ctx.db.invoice.count({ where: { status: "PAID", ...createdWhere } }),
        ctx.db.invoice.count({ where: { status: "OVERDUE" } }),
        ctx.db.invoice.findMany({
          where: { status: { in: ["SENT", "OVERDUE"] } },
          select: { total: true, amountPaid: true },
        }),
      ]);

      const outstanding = totalOutstanding.reduce(
        (sum, inv) => sum + parseFloat(inv.total.toString()) - parseFloat(inv.amountPaid.toString()),
        0
      );

      // Collection rate: invoices that got paid after having a reminder / total invoices with reminders
      const invoicesWithReminders = await ctx.db.billingReminder.findMany({
        where: { status: "SENT" },
        select: { invoiceId: true },
        distinct: ["invoiceId"],
      });
      const remindedIds = invoicesWithReminders.map((r) => r.invoiceId);
      const paidAfterReminder = remindedIds.length > 0
        ? await ctx.db.invoice.count({ where: { id: { in: remindedIds }, status: "PAID" } })
        : 0;
      const collectionRate = remindedIds.length > 0
        ? Math.round((paidAfterReminder / remindedIds.length) * 100)
        : 0;

      // Payment plan total value
      const planValues = await ctx.db.paymentPlan.aggregate({
        where: { status: "ACTIVE" },
        _sum: { totalAmount: true },
      });

      return {
        remindersSent,
        collectionRate,
        totalOutstanding: outstanding,
        overdueInvoices,
        activePlans,
        paymentPlanValue: parseFloat(planValues._sum.totalAmount?.toString() || "0"),
      };
    }),
});
