import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendSms, getTwilioConfig } from "@/lib/twilio";

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

function replacePlaceholders(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), value);
  }
  return result;
}

export async function GET() {
  const summary = { remindersSent: 0, remindersScheduled: 0, installmentsUpdated: 0, tasksCreated: 0, errors: 0 };

  try {
    const settings = await db.billingReminderSettings.findUnique({ where: { id: "default" } });
    if (!settings?.isEnabled) {
      return NextResponse.json({ ok: true, message: "Billing reminders disabled", summary });
    }

    const firmSettings = await db.settings.findUnique({ where: { id: "default" } }).catch(() => null);
    const firmName = (firmSettings as any)?.firmName || "Our Firm";

    // Step 1: Send all scheduled reminders that are due
    const dueReminders = await db.billingReminder.findMany({
      where: { status: "SCHEDULED", scheduledFor: { lte: new Date() } },
      include: {
        invoice: { include: { matter: { include: { client: true } } } },
      },
    });

    for (const reminder of dueReminders) {
      try {
        const invoice = reminder.invoice;
        const client = invoice.matter.client;
        const balance = parseFloat(invoice.total.toString()) - parseFloat(invoice.amountPaid.toString());
        const daysOverdue = getDaysOverdue(invoice.dueDate);

        const vars: Record<string, string> = {
          CLIENT_NAME: client.name,
          INVOICE_NUMBER: invoice.invoiceNumber,
          AMOUNT_DUE: formatCurrency(balance),
          DUE_DATE: new Date(invoice.dueDate).toLocaleDateString(),
          DAYS_OVERDUE: daysOverdue.toString(),
          FIRM_NAME: firmName,
          PAYMENT_LINK: settings.includePaymentLink
            ? `<p><a href="${process.env.NEXTAUTH_URL || ""}/billing/${invoice.id}">Pay Now</a></p>`
            : "",
        };

        let sent = false;
        const method = reminder.method;

        // Email
        if ((method === "EMAIL" || method === "BOTH") && client.email) {
          const subject = replacePlaceholders(
            reminder.emailSubject || `Invoice #${invoice.invoiceNumber} Reminder`,
            vars
          );
          console.log(`[Billing Cron] Email to ${client.email}: ${subject}`);
          sent = true;
        }

        // Text
        if ((method === "TEXT" || method === "BOTH") && client.phone) {
          const textBody = replacePlaceholders(
            reminder.textContent || `${firmName}: Invoice #${invoice.invoiceNumber} for ${formatCurrency(balance)} needs attention.`,
            vars
          );
          try {
            const config = await getTwilioConfig();
            if (config) {
              await sendSms(config, client.phone, textBody);
              sent = true;
            }
          } catch (err) {
            console.error("[Billing Cron] SMS error:", err);
          }
        }

        await db.billingReminder.update({
          where: { id: reminder.id },
          data: {
            status: sent ? "SENT" : ("FAILED" as any),
            sentAt: sent ? new Date() : null,
            errorMessage: sent ? null : "No contact method available",
          },
        });

        if (sent) summary.remindersSent++;
      } catch (err) {
        console.error("[Billing Cron] Reminder error:", err);
        summary.errors++;
        await db.billingReminder.update({
          where: { id: reminder.id },
          data: { status: "FAILED" as any, errorMessage: "Processing error" },
        });
      }
    }

    // Step 2: Auto-schedule for invoices with no upcoming reminders
    const invoicesNeedingReminders = await db.invoice.findMany({
      where: {
        status: { in: ["SENT", "OVERDUE"] },
        reminders: { none: { status: "SCHEDULED" } },
      },
    });

    const schedule = (settings.pastDueSchedule || "3,7,14,30,60,90").split(",").map((s) => parseInt(s.trim()));
    for (const invoice of invoicesNeedingReminders) {
      const daysOverdue = getDaysOverdue(invoice.dueDate);
      const nextDay = schedule.find((d) => d > daysOverdue);
      if (nextDay) {
        const scheduledFor = new Date(invoice.dueDate);
        scheduledFor.setDate(scheduledFor.getDate() + nextDay);
        const typeMap: Record<number, string> = { 3: "PAST_DUE_3", 7: "PAST_DUE_7", 14: "PAST_DUE_14", 30: "PAST_DUE_30", 60: "PAST_DUE_60", 90: "PAST_DUE_90" };
        await db.billingReminder.create({
          data: {
            invoiceId: invoice.id,
            type: (typeMap[nextDay] || "CUSTOM") as any,
            method: settings.defaultMethod as any,
            status: "SCHEDULED" as any,
            scheduledFor,
          },
        });
        summary.remindersScheduled++;
      }
    }

    // Step 3: Update UPCOMING installments due today to DUE
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dueTodayInstallments = await db.paymentPlanPayment.findMany({
      where: {
        dueDate: { gte: today, lt: tomorrow },
        status: "UPCOMING",
        paymentPlan: { status: "ACTIVE" },
      },
      include: {
        paymentPlan: { include: { client: true, invoice: true } },
      },
    });

    for (const inst of dueTodayInstallments) {
      await db.paymentPlanPayment.update({
        where: { id: inst.id },
        data: { status: "DUE" as any },
      });
      summary.installmentsUpdated++;
    }

    // Step 4: Update DUE installments past due to LATE
    const lateInstallments = await db.paymentPlanPayment.findMany({
      where: {
        dueDate: { lt: today },
        status: "DUE",
        paymentPlan: { status: "ACTIVE" },
      },
    });

    for (const inst of lateInstallments) {
      await db.paymentPlanPayment.update({
        where: { id: inst.id },
        data: { status: "LATE" as any },
      });
      summary.installmentsUpdated++;
    }

    // Step 5: Escalation — create phone call tasks for 30+ day overdue
    if (settings.escalateToPhone) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const severelyOverdue = await db.invoice.findMany({
        where: {
          status: "OVERDUE",
          dueDate: { lt: thirtyDaysAgo },
        },
        include: { matter: { include: { client: true } } },
      });

      for (const inv of severelyOverdue) {
        const existingTask = await db.task.findFirst({
          where: {
            title: { contains: `overdue invoice #${inv.invoiceNumber}` },
            matterId: inv.matterId,
          },
        });
        if (!existingTask) {
          await db.task.create({
            data: {
              title: `Call ${inv.matter.client.name} regarding overdue invoice #${inv.invoiceNumber}`,
              description: `Invoice #${inv.invoiceNumber} is ${getDaysOverdue(inv.dueDate)} days overdue. Balance: ${formatCurrency(parseFloat(inv.total.toString()) - parseFloat(inv.amountPaid.toString()))}`,
              status: "TODO" as any,
              priority: "URGENT" as any,
              matterId: inv.matterId,
            },
          });
          summary.tasksCreated++;
        }
      }
    }

    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("[Billing Cron] Error:", error);
    return NextResponse.json({ ok: false, error: "Cron job failed", summary }, { status: 500 });
  }
}
