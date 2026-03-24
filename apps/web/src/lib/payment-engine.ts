import { db } from "@/lib/db";
import crypto from "crypto";

// ==========================================
// SIMULATED PAYMENT PROCESSOR
// ==========================================

interface PaymentResult {
  success: boolean;
  transactionId: string;
  processorFee: number;
  failureReason?: string;
}

export async function processPayment(params: {
  amount: number;
  paymentMethodId: string;
  description: string;
  matterId: string;
}): Promise<PaymentResult> {
  // Validate payment method
  const method = await db.clientPaymentMethod.findUnique({ where: { id: params.paymentMethodId } });
  if (!method || !method.isActive) {
    return { success: false, transactionId: "", processorFee: 0, failureReason: "Payment method inactive or not found" };
  }

  if (method.expiryYear && method.expiryMonth) {
    const now = new Date();
    const expiry = new Date(method.expiryYear, method.expiryMonth - 1);
    if (expiry < now) {
      return { success: false, transactionId: "", processorFee: 0, failureReason: "expired_card" };
    }
  }

  // Simulate processing (95% success rate)
  await new Promise((resolve) => setTimeout(resolve, 500));
  const success = Math.random() > 0.05;
  const transactionId = `txn_sim_${crypto.randomBytes(12).toString("hex")}`;
  const processorFee = Math.round(params.amount * 0.029 * 100) / 100; // ~2.9% fee

  if (!success) {
    const reasons = ["card_declined", "insufficient_funds", "processor_error"];
    return { success: false, transactionId, processorFee: 0, failureReason: reasons[Math.floor(Math.random() * reasons.length)] };
  }

  // Update method last used
  await db.clientPaymentMethod.update({
    where: { id: params.paymentMethodId },
    data: { lastUsedAt: new Date(), failureCount: 0 },
  });

  return { success: true, transactionId, processorFee };
}

export function tokenizePaymentMethod(params: {
  type: string;
  lastFour: string;
  cardBrand?: string;
  expiryMonth?: number;
  expiryYear?: number;
}): { processorToken: string } {
  return { processorToken: `tok_sim_${crypto.randomBytes(16).toString("hex")}` };
}

// ==========================================
// PAYMENT SCHEDULE GENERATION
// ==========================================

export function generatePaymentSchedule(plan: {
  installmentAmount: number;
  installmentCount?: number | null;
  totalAmount?: number | null;
  frequency: string;
  startDate: Date;
  dayOfMonth?: number | null;
  customScheduleDates?: any;
}): Array<{ sequenceNumber: number; scheduledDate: Date; amount: number }> {
  const schedule: Array<{ sequenceNumber: number; scheduledDate: Date; amount: number }> = [];
  const count = plan.installmentCount || 12;

  let currentDate = new Date(plan.startDate);

  for (let i = 1; i <= count; i++) {
    if (i > 1) {
      currentDate = calculateNextDate(currentDate, plan.frequency, plan.dayOfMonth);
    }

    let amount = plan.installmentAmount;
    // Last installment gets the remainder to handle rounding
    if (i === count && plan.totalAmount) {
      const paid = plan.installmentAmount * (count - 1);
      amount = Math.round((plan.totalAmount - paid) * 100) / 100;
    }

    schedule.push({
      sequenceNumber: i,
      scheduledDate: new Date(currentDate),
      amount,
    });
  }

  return schedule;
}

function calculateNextDate(from: Date, frequency: string, dayOfMonth?: number | null): Date {
  const d = new Date(from);
  switch (frequency) {
    case "weekly": d.setDate(d.getDate() + 7); break;
    case "biweekly": d.setDate(d.getDate() + 14); break;
    case "monthly_1st": d.setMonth(d.getMonth() + 1); d.setDate(1); break;
    case "monthly_15th": d.setMonth(d.getMonth() + 1); d.setDate(15); break;
    case "monthly_custom": d.setMonth(d.getMonth() + 1); d.setDate(Math.min(dayOfMonth || 1, 28)); break;
    case "quarterly": d.setMonth(d.getMonth() + 3); break;
    default: d.setMonth(d.getMonth() + 1); break;
  }
  return d;
}

export function calculateNextPaymentDate(frequency: string, fromDate: Date, dayOfMonth?: number | null): Date {
  return calculateNextDate(fromDate, frequency, dayOfMonth);
}

// ==========================================
// SCHEDULED PAYMENT PROCESSOR
// ==========================================

export async function processScheduledPayments(firmId: string, userId: string): Promise<{ processed: number; succeeded: number; failed: number }> {
  const now = new Date();
  let processed = 0, succeeded = 0, failed = 0;

  const duePayments = await db.scheduledPayment.findMany({
    where: {
      firmId,
      OR: [
        { status: "scheduled", scheduledDate: { lte: now } },
        { status: "retrying", nextRetryAt: { lte: now } },
      ],
      plan: { autoPayEnabled: true, status: "active" },
    },
    include: { plan: true },
    take: 50,
  });

  for (const payment of duePayments) {
    processed++;
    const methodId = payment.paymentMethodId || payment.plan.paymentMethodId;
    if (!methodId) {
      await db.scheduledPayment.update({
        where: { id: payment.id },
        data: { status: "failed", failureReason: "no_payment_method" },
      });
      failed++;
      continue;
    }

    const result = await processPayment({
      amount: payment.totalDue,
      paymentMethodId: methodId,
      description: `Installment ${payment.sequenceNumber} — ${payment.plan.planName}`,
      matterId: payment.matterId,
    });

    if (result.success) {
      await db.scheduledPayment.update({
        where: { id: payment.id },
        data: {
          status: "completed",
          completedAt: now,
          transactionId: result.transactionId,
          attemptCount: { increment: 1 },
          lastAttemptAt: now,
        },
      });

      // Update plan
      const newTotalPaid = payment.plan.totalPaid + payment.totalDue;
      const isComplete = payment.plan.totalAmount && newTotalPaid >= payment.plan.totalAmount;
      const nextDate = isComplete ? null : calculateNextPaymentDate(payment.plan.frequency, now, payment.plan.dayOfMonth);

      await db.autoPayPlan.update({
        where: { id: payment.planId },
        data: {
          totalPaid: newTotalPaid,
          completedInstallments: { increment: 1 },
          remainingBalance: payment.plan.totalAmount ? payment.plan.totalAmount - newTotalPaid : null,
          lastPaymentDate: now,
          lastPaymentAmount: payment.totalDue,
          nextPaymentDate: nextDate,
          consecutiveMissed: 0,
          status: isComplete ? "completed" : "active",
        },
      });

      // Generate receipt
      await generateReceipt({
        transactionId: result.transactionId,
        matterId: payment.matterId,
        planId: payment.planId,
        clientName: payment.plan.clientName,
        clientEmail: payment.plan.clientEmail,
        amount: payment.totalDue,
        paymentMethod: "Card on file",
        description: `Installment ${payment.sequenceNumber}${payment.plan.installmentCount ? ` of ${payment.plan.installmentCount}` : ""} — ${payment.plan.planName}`,
        depositAccount: payment.plan.depositAccount,
        firmId,
      });

      succeeded++;
    } else {
      const newAttempt = (payment.attemptCount || 0) + 1;
      const isFinal = newAttempt >= payment.maxAttempts;

      await db.scheduledPayment.update({
        where: { id: payment.id },
        data: {
          status: isFinal ? "failed" : "retrying",
          attemptCount: newAttempt,
          lastAttemptAt: now,
          failureReason: result.failureReason,
          nextRetryAt: isFinal ? null : new Date(now.getTime() + payment.retryIntervalHours * 60 * 60 * 1000),
        },
      });

      if (isFinal) {
        const newMissed = payment.plan.consecutiveMissed + 1;
        await db.autoPayPlan.update({
          where: { id: payment.planId },
          data: {
            missedPayments: { increment: 1 },
            consecutiveMissed: newMissed,
            status: newMissed >= payment.plan.maxMissedBeforeDefault ? "defaulted" : "active",
          },
        });
      }

      failed++;
    }
  }

  return { processed, succeeded, failed };
}

// ==========================================
// RECEIPT GENERATION
// ==========================================

let receiptCounter = 0;

async function generateReceipt(params: {
  transactionId: string;
  matterId: string;
  planId?: string;
  clientName: string;
  clientEmail?: string | null;
  amount: number;
  paymentMethod: string;
  description: string;
  depositAccount: string;
  firmId: string;
}): Promise<void> {
  receiptCounter++;
  const year = new Date().getFullYear();
  const receiptNumber = `REC-${year}-${String(receiptCounter).padStart(4, "0")}`;

  await db.paymentReceipt.create({
    data: {
      transactionId: params.transactionId,
      matterId: params.matterId,
      planId: params.planId,
      receiptNumber,
      clientName: params.clientName,
      clientEmail: params.clientEmail,
      amount: params.amount,
      paymentMethod: params.paymentMethod,
      paymentDate: new Date(),
      description: params.description,
      depositAccount: params.depositAccount,
      trustAccountNote: params.depositAccount !== "operating"
        ? `Deposited to ${params.depositAccount} trust account in compliance with applicable rules of professional conduct.`
        : null,
      sentVia: { portal: true, email: !!params.clientEmail },
      firmId: params.firmId,
    },
  });
}

// ==========================================
// PAYMENT REMINDERS
// ==========================================

export async function sendPaymentReminders(firmId: string): Promise<number> {
  const threeDaysFromNow = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const due = await db.scheduledPayment.findMany({
    where: {
      firmId,
      status: "scheduled",
      scheduledDate: { lte: threeDaysFromNow, gte: now },
      reminderSent: false,
    },
    include: { plan: true },
  });

  for (const payment of due) {
    await db.scheduledPayment.update({
      where: { id: payment.id },
      data: { reminderSent: true, reminderSentAt: now },
    });
  }

  return due.length;
}

// ==========================================
// TRUST COMPLIANCE
// ==========================================

export async function checkTrustCompliance(firmId: string): Promise<{
  compliant: boolean;
  issues: Array<{ type: string; description: string; severity: string }>;
}> {
  const issues: Array<{ type: string; description: string; severity: string }> = [];

  // Check trust accounts reconciled within 30 days
  const accounts = await db.trustAccount.findMany({ where: { isActive: true } });
  for (const acct of accounts) {
    if (!acct.lastReconciledAt || (Date.now() - acct.lastReconciledAt.getTime()) > 30 * 24 * 60 * 60 * 1000) {
      issues.push({
        type: "reconciliation_overdue",
        description: `Trust account "${acct.name}" has not been reconciled in over 30 days`,
        severity: "high",
      });
    }
  }

  // Check for negative client ledger balances
  const ledgers = await db.trustLedger.findMany({
    where: { balance: { lt: 0 } },
    include: { client: { select: { name: true } } },
  });
  for (const ledger of ledgers) {
    issues.push({
      type: "negative_balance",
      description: `Client "${ledger.client.name}" has negative trust balance of $${Number(ledger.balance).toFixed(2)}`,
      severity: "critical",
    });
  }

  return { compliant: issues.length === 0, issues };
}
