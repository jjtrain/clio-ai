import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendInterestNotice, sendEarlyPaymentReminder } from "@/lib/email";

export async function GET() {
  try {
    const settings = await db.interestSettings.findUnique({ where: { id: "default" } });
    if (!settings?.isEnabled) return NextResponse.json({ skipped: true, reason: "Interest not enabled" });

    let interestApplied = 0;
    let discountsApplied = 0;
    let totalInterest = 0;

    // 1. Apply interest to overdue invoices
    if (settings.autoApply && settings.lateInterestEnabled) {
      const graceDays = settings.gracePeriodDays || 0;
      const cutoff = new Date(Date.now() - graceDays * 24 * 60 * 60 * 1000);

      const overdueInvoices = await db.invoice.findMany({
        where: { status: { in: ["SENT", "OVERDUE"] }, dueDate: { lt: cutoff } },
        include: { matter: { include: { client: true } } },
      });

      for (const inv of overdueInvoices) {
        const outstanding = Number(inv.total) - Number(inv.amountPaid);
        if (outstanding <= 0) continue;

        const daysLate = Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)) - graceDays);
        if (daysLate <= 0) continue;

        const existing = await db.interestCharge.findMany({
          where: { invoiceId: inv.id, isWaived: false, type: { not: "EARLY_PAYMENT_DISCOUNT" } },
        });
        const existingAmt = existing.reduce((s, c) => s + Number(c.amount), 0);

        let amt = 0;
        let cType: any = "INTEREST";
        let desc = "";

        if (settings.lateInterestType === "FLAT_FEE") {
          if (existing.some((c) => c.type === "LATE_FEE") && settings.applyFlatFeeOnce) continue;
          amt = Number(settings.flatFeeAmount || 0);
          cType = "LATE_FEE";
          desc = `Late fee — ${daysLate} days overdue`;
        } else if (settings.lateInterestType === "PERCENTAGE") {
          const rate = Number(settings.percentageRate || 0);
          const periods = settings.compoundFrequency === "monthly" ? Math.max(1, Math.floor(daysLate / 30)) : daysLate;
          amt = outstanding * rate * periods - existingAmt;
          desc = `Interest — ${(rate * 100).toFixed(2)}%`;
        } else {
          const rate = Number(settings.dailyRate || 0);
          amt = outstanding * rate * daysLate - existingAmt;
          desc = `Daily interest — ${daysLate} days`;
        }

        if (settings.maxInterestPercentage) {
          amt = Math.min(amt, Math.max(0, Number(inv.total) * Number(settings.maxInterestPercentage) / 100 - existingAmt));
        }
        amt = Math.max(0, Math.round(amt * 100) / 100);
        if (amt <= 0) continue;

        await db.interestCharge.create({
          data: { invoiceId: inv.id, type: cType, amount: amt, daysLate, description: desc },
        });
        interestApplied++;
        totalInterest += amt;

        if (settings.notifyClientOnInterest && inv.matter?.client?.email) {
          await sendInterestNotice({
            to: inv.matter.client.email,
            clientName: inv.matter.client.name,
            invoiceNumber: inv.invoiceNumber,
            interestAmount: amt,
            totalNowDue: outstanding + amt,
            daysLate,
            firmName: "Law Firm",
            fromEmail: "noreply@example.com",
          }).catch(() => {});
        }
      }
    }

    // 2. Send early payment reminders
    if (settings.earlyPaymentEnabled && settings.notifyClientOnDiscount) {
      const unpaidInvoices = await db.invoice.findMany({
        where: { status: "SENT" },
        include: { matter: { include: { client: true } } },
      });

      for (const inv of unpaidInvoices) {
        const deadline = new Date(inv.issueDate);
        deadline.setDate(deadline.getDate() + settings.earlyPaymentDays);
        const daysLeft = Math.floor((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

        if (daysLeft > 0 && daysLeft <= 3 && inv.matter?.client?.email) {
          const discountAmt = Number(inv.subtotal) * Number(settings.earlyPaymentDiscountPercentage || 0) / 100;
          await sendEarlyPaymentReminder({
            to: inv.matter.client.email,
            clientName: inv.matter.client.name,
            invoiceNumber: inv.invoiceNumber,
            discountAmount: discountAmt,
            discountPercentage: Number(settings.earlyPaymentDiscountPercentage || 0),
            deadline: deadline.toLocaleDateString(),
            firmName: "Law Firm",
            fromEmail: "noreply@example.com",
          }).catch(() => {});
          discountsApplied++;
        }
      }
    }

    return NextResponse.json({ interestApplied, totalInterest, discountsApplied });
  } catch (err: any) {
    console.error("[Interest Cron] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
