import { db } from "@/lib/db";

async function getNextEntryNumber(): Promise<string> {
  const last = await db.journalEntry.findFirst({ orderBy: { entryNumber: "desc" } });
  const num = last ? parseInt(last.entryNumber.replace("JE-", "")) + 1 : 1;
  return `JE-${num.toString().padStart(4, "0")}`;
}

async function findAccount(number: string) {
  return db.chartOfAccounts.findUnique({ where: { accountNumber: number } });
}

export async function onInvoiceCreated(invoice: { id: string; total: number; matterId: string; clientId?: string }) {
  const ar = await findAccount("1200");
  const revenue = await findAccount("4000");
  if (!ar || !revenue) return;

  const entryNumber = await getNextEntryNumber();
  await db.journalEntry.create({
    data: {
      entryNumber,
      date: new Date(),
      description: `Invoice created`,
      source: "INVOICE",
      sourceId: invoice.id,
      status: "POSTED",
      postedAt: new Date(),
      lines: {
        create: [
          { accountId: ar.id, debit: invoice.total, credit: 0, matterId: invoice.matterId, clientId: invoice.clientId },
          { accountId: revenue.id, debit: 0, credit: invoice.total, matterId: invoice.matterId, clientId: invoice.clientId },
        ],
      },
    },
  });

  await db.chartOfAccounts.update({ where: { id: ar.id }, data: { currentBalance: { increment: invoice.total } } });
  await db.chartOfAccounts.update({ where: { id: revenue.id }, data: { currentBalance: { increment: invoice.total } } });
}

export async function onPaymentReceived(payment: { invoiceId: string; amount: number; matterId?: string; clientId?: string }) {
  const cash = await findAccount("1000");
  const ar = await findAccount("1200");
  if (!cash || !ar) return;

  const entryNumber = await getNextEntryNumber();
  await db.journalEntry.create({
    data: {
      entryNumber,
      date: new Date(),
      description: `Payment received`,
      source: "PAYMENT",
      sourceId: payment.invoiceId,
      status: "POSTED",
      postedAt: new Date(),
      lines: {
        create: [
          { accountId: cash.id, debit: payment.amount, credit: 0, matterId: payment.matterId, clientId: payment.clientId },
          { accountId: ar.id, debit: 0, credit: payment.amount, matterId: payment.matterId, clientId: payment.clientId },
        ],
      },
    },
  });

  await db.chartOfAccounts.update({ where: { id: cash.id }, data: { currentBalance: { increment: payment.amount } } });
  await db.chartOfAccounts.update({ where: { id: ar.id }, data: { currentBalance: { decrement: payment.amount } } });
}

export async function onExpenseRecorded(expense: { id: string; amount: number; accountId?: string; matterId?: string; clientId?: string }) {
  const expenseAcct = expense.accountId ? await db.chartOfAccounts.findUnique({ where: { id: expense.accountId } }) : await findAccount("6900");
  const ap = await findAccount("2000");
  if (!expenseAcct || !ap) return;

  const entryNumber = await getNextEntryNumber();
  await db.journalEntry.create({
    data: {
      entryNumber,
      date: new Date(),
      description: `Expense recorded`,
      source: "EXPENSE",
      sourceId: expense.id,
      status: "POSTED",
      postedAt: new Date(),
      lines: {
        create: [
          { accountId: expenseAcct.id, debit: expense.amount, credit: 0, matterId: expense.matterId, clientId: expense.clientId },
          { accountId: ap.id, debit: 0, credit: expense.amount },
        ],
      },
    },
  });

  await db.chartOfAccounts.update({ where: { id: expenseAcct.id }, data: { currentBalance: { increment: expense.amount } } });
  await db.chartOfAccounts.update({ where: { id: ap.id }, data: { currentBalance: { increment: expense.amount } } });
}
