import { db } from "@/lib/db";

export function calculateAgingBucket(days: number): string {
  if (days <= 0) return "CURRENT";
  if (days <= 30) return "DAYS_1_30";
  if (days <= 60) return "DAYS_31_60";
  if (days <= 90) return "DAYS_61_90";
  if (days <= 120) return "DAYS_91_120";
  return "DAYS_OVER_120";
}

export function calculatePriority(days: number, amount: number): string {
  if (days > 90 || amount > 5000) return "CRITICAL";
  if (days > 60) return "HIGH";
  if (days > 30) return "MEDIUM";
  return "LOW";
}

export async function syncFromBilling() {
  const invoices = await db.invoice.findMany({
    where: { status: { in: ["SENT", "OVERDUE"] }, dueDate: { lt: new Date() } },
    include: { matter: true },
  });

  let created = 0, updated = 0;
  for (const inv of invoices) {
    const outstanding = Number(inv.total) - Number(inv.amountPaid);
    if (outstanding <= 0) continue;

    const days = Math.max(0, Math.floor((Date.now() - new Date(inv.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
    const bucket = calculateAgingBucket(days);
    const priority = calculatePriority(days, outstanding);

    const existing = await db.collectionAccount.findUnique({ where: { invoiceId: inv.id } });
    if (existing) {
      await db.collectionAccount.update({
        where: { invoiceId: inv.id },
        data: { outstandingBalance: outstanding, totalOwed: outstanding + Number(existing.lateFees), daysPastDue: days, agingBucket: bucket, priority },
      });
      updated++;
    } else {
      await db.collectionAccount.create({
        data: { invoiceId: inv.id, matterId: inv.matterId, clientId: inv.matter.clientId, originalAmount: Number(inv.total), outstandingBalance: outstanding, totalOwed: outstanding, dueDate: inv.dueDate, daysPastDue: days, agingBucket: bucket, priority },
      });
      created++;
    }
  }
  return { created, updated, total: invoices.length };
}

export async function getAgingReport() {
  const accounts = await db.collectionAccount.findMany({ where: { status: { not: "PAID" } } });
  const buckets: Record<string, { count: number; amount: number }> = {
    CURRENT: { count: 0, amount: 0 }, DAYS_1_30: { count: 0, amount: 0 }, DAYS_31_60: { count: 0, amount: 0 },
    DAYS_61_90: { count: 0, amount: 0 }, DAYS_91_120: { count: 0, amount: 0 }, DAYS_OVER_120: { count: 0, amount: 0 },
  };
  let totalAR = 0;
  for (const a of accounts) {
    const bucket = a.agingBucket;
    if (buckets[bucket]) { buckets[bucket].count++; buckets[bucket].amount += Number(a.totalOwed); }
    totalAR += Number(a.totalOwed);
  }
  return { totalAR, buckets, accountCount: accounts.length };
}

export async function recordPayment(params: { accountId: string; amount: number; paymentMethod?: string; notes?: string }) {
  const account = await db.collectionAccount.findUniqueOrThrow({ where: { id: params.accountId } });
  const newBalance = Math.max(0, Number(account.outstandingBalance) - params.amount);
  const newTotal = Math.max(0, newBalance + Number(account.lateFees));
  const isPaid = newBalance <= 0;

  await db.collectionAccount.update({
    where: { id: params.accountId },
    data: { outstandingBalance: newBalance, totalOwed: newTotal, status: isPaid ? "PAID" : account.status },
  });

  await db.collectionActivity.create({
    data: { accountId: params.accountId, activityType: "PAYMENT_RECEIVED", description: `Payment of $${params.amount.toFixed(2)} received${params.paymentMethod ? ` via ${params.paymentMethod}` : ""}`, amount: params.amount, notes: params.notes },
  });

  return db.collectionAccount.findUniqueOrThrow({ where: { id: params.accountId } });
}
