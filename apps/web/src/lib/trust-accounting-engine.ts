import { db } from "@/lib/db";

// ==========================================
// DEPOSITS
// ==========================================

export async function recordTrustDeposit(params: {
  accountId: string; matterId: string; clientName: string; amount: number;
  description: string; depositMethod: string; checkNumber?: string; referenceNumber?: string;
  sourcePaymentId?: string; userId: string; firmId: string;
}): Promise<any> {
  if (params.amount <= 0) throw new Error("Deposit amount must be positive");

  const account = await db.trustBankAccount.findUnique({ where: { id: params.accountId } });
  if (!account || !account.isActive) throw new Error("Trust account not found or inactive");

  const ref = `TT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const newBalance = account.currentBalance + params.amount;

  // Create journal entry (debit bank, credit client liability)
  await db.trustJournalEntry.create({
    data: {
      accountId: params.accountId,
      transactionRef: ref,
      matterId: params.matterId,
      clientName: params.clientName,
      entryDate: new Date(),
      debitAccount: `Trust Bank — ${account.accountName}`,
      creditAccount: `Client Trust Liability — ${params.clientName}`,
      description: params.description,
      debitAmount: params.amount,
      creditAmount: params.amount,
      runningBalance: newBalance,
      transactionType: "deposit",
      disbursementMethod: params.depositMethod,
      checkNumber: params.checkNumber,
      referenceNumber: params.referenceNumber,
      sourcePaymentId: params.sourcePaymentId,
      userId: params.userId,
      firmId: params.firmId,
    },
  });

  // Update account balance
  await db.trustBankAccount.update({ where: { id: params.accountId }, data: { currentBalance: newBalance } });

  // Update client ledger
  await db.trustClientLedger.upsert({
    where: { accountId_matterId: { accountId: params.accountId, matterId: params.matterId } },
    create: { accountId: params.accountId, matterId: params.matterId, clientName: params.clientName, currentBalance: params.amount, totalDeposited: params.amount, lastActivityAt: new Date(), firmId: params.firmId },
    update: { currentBalance: { increment: params.amount }, totalDeposited: { increment: params.amount }, lastActivityAt: new Date() },
  });

  return { ref, newBalance };
}

// ==========================================
// DISBURSEMENTS (with negative balance guard)
// ==========================================

export async function recordTrustDisbursement(params: {
  accountId: string; matterId: string; clientName: string; amount: number;
  disbursementType: string; payee: string; description: string; method: string;
  checkNumber?: string; approvedBy: string; userId: string; firmId: string;
}): Promise<any> {
  if (params.amount <= 0) throw new Error("Disbursement amount must be positive");

  // CRITICAL: Check client ledger balance (negative balance prevention)
  const ledger = await db.trustClientLedger.findUnique({
    where: { accountId_matterId: { accountId: params.accountId, matterId: params.matterId } },
  });

  if (!ledger || ledger.currentBalance < params.amount) {
    const available = ledger?.currentBalance || 0;
    throw new Error(`BLOCKED: Insufficient client trust funds. Available: $${available.toFixed(2)}. Requested: $${params.amount.toFixed(2)}. This disbursement would violate NY RPC 1.15.`);
  }

  const account = await db.trustBankAccount.findUnique({ where: { id: params.accountId } });
  if (!account) throw new Error("Account not found");

  const ref = `TT-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;
  const newBalance = account.currentBalance - params.amount;

  // Create journal entry (debit client liability, credit bank)
  await db.trustJournalEntry.create({
    data: {
      accountId: params.accountId,
      transactionRef: ref,
      matterId: params.matterId,
      clientName: params.clientName,
      entryDate: new Date(),
      debitAccount: `Client Trust Liability — ${params.clientName}`,
      creditAccount: `Trust Bank — ${account.accountName}`,
      description: params.description,
      debitAmount: params.amount,
      creditAmount: params.amount,
      runningBalance: newBalance,
      transactionType: params.disbursementType,
      disbursementPayee: params.payee,
      disbursementMethod: params.method,
      checkNumber: params.checkNumber,
      approvedBy: params.approvedBy,
      approvedAt: new Date(),
      userId: params.userId,
      firmId: params.firmId,
    },
  });

  await db.trustBankAccount.update({ where: { id: params.accountId }, data: { currentBalance: newBalance } });

  await db.trustClientLedger.update({
    where: { accountId_matterId: { accountId: params.accountId, matterId: params.matterId } },
    data: { currentBalance: { decrement: params.amount }, totalDisbursed: { increment: params.amount }, lastActivityAt: new Date() },
  });

  return { ref, newBalance, clientBalance: ledger.currentBalance - params.amount };
}

// ==========================================
// 3-WAY RECONCILIATION
// ==========================================

export async function performReconciliation(params: {
  accountId: string; statementBalance: number; reconciledBy: string; firmId: string;
  outstandingDeposits?: any[]; outstandingChecks?: any[];
}): Promise<any> {
  const account = await db.trustBankAccount.findUnique({
    where: { id: params.accountId },
    include: { clientLedgers: { where: { status: "active" } } },
  });
  if (!account) throw new Error("Account not found");

  const firmLedgerBalance = account.currentBalance;
  const clientLedgersTotal = account.clientLedgers.reduce((sum, l) => sum + l.currentBalance, 0);

  const depositsTotal = (params.outstandingDeposits || []).reduce((sum: number, d: any) => sum + d.amount, 0);
  const checksTotal = (params.outstandingChecks || []).reduce((sum: number, c: any) => sum + c.amount, 0);
  const adjustedBankBalance = params.statementBalance + depositsTotal - checksTotal;

  const bankVsLedgerDiff = Math.abs(adjustedBankBalance - firmLedgerBalance);
  const ledgerVsClientsDiff = Math.abs(firmLedgerBalance - clientLedgersTotal);
  const threeWayMatch = bankVsLedgerDiff < 0.01 && ledgerVsClientsDiff < 0.01;

  const recon = await db.trustReconciliation.create({
    data: {
      accountId: params.accountId,
      reconciliationDate: new Date(),
      statementBalance: params.statementBalance,
      firmLedgerBalance,
      clientLedgersTotal,
      outstandingDeposits: params.outstandingDeposits,
      outstandingChecks: params.outstandingChecks,
      adjustedBankBalance,
      threeWayMatch,
      bankVsLedgerDiff,
      ledgerVsClientsDiff,
      status: threeWayMatch ? "completed" : "completed_with_exceptions",
      reconciledBy: params.reconciledBy,
      completedAt: new Date(),
      firmId: params.firmId,
    },
  });

  // Update account
  const nextDue = new Date();
  nextDue.setMonth(nextDue.getMonth() + 1);
  nextDue.setDate(1);

  await db.trustBankAccount.update({
    where: { id: params.accountId },
    data: { lastReconciledAt: new Date(), lastBankBalance: params.statementBalance, lastBankBalanceDate: new Date(), nextReconciliationDue: nextDue },
  });

  // Create compliance alert if not matching
  if (!threeWayMatch) {
    if (ledgerVsClientsDiff > 0.01) {
      await db.trustComplianceAlert.create({
        data: { accountId: params.accountId, alertType: "commingling", severity: "critical", title: "3-Way Reconciliation Mismatch", description: `Firm ledger ($${firmLedgerBalance.toFixed(2)}) does not match client ledgers total ($${clientLedgersTotal.toFixed(2)}). Difference: $${ledgerVsClientsDiff.toFixed(2)}. This may indicate commingling.`, firmId: params.firmId },
      });
    }
  }

  return recon;
}

// ==========================================
// COMPLIANCE CHECKS
// ==========================================

export async function runComplianceChecks(firmId: string): Promise<{
  compliant: boolean;
  issues: Array<{ type: string; severity: string; description: string }>;
}> {
  const issues: Array<{ type: string; severity: string; description: string }> = [];

  // Check negative balances
  const negativeLedgers = await db.trustClientLedger.findMany({
    where: { firmId, currentBalance: { lt: 0 }, status: "active" },
  });
  for (const l of negativeLedgers) {
    issues.push({ type: "negative_balance", severity: "critical", description: `${l.clientName} has negative trust balance: $${l.currentBalance.toFixed(2)}` });
  }

  // Check reconciliation currency
  const accounts = await db.trustBankAccount.findMany({ where: { firmId, isActive: true, accountType: { not: "operating" } } });
  for (const a of accounts) {
    if (!a.lastReconciledAt || (Date.now() - a.lastReconciledAt.getTime()) > 35 * 24 * 60 * 60 * 1000) {
      issues.push({ type: "reconciliation_overdue", severity: "high", description: `${a.accountName} reconciliation overdue (last: ${a.lastReconciledAt?.toLocaleDateString() || "never"})` });
    }
  }

  // Check commingling (ledger totals vs account balance)
  for (const a of accounts) {
    const ledgerTotal = await db.trustClientLedger.aggregate({
      where: { accountId: a.id, status: "active" },
      _sum: { currentBalance: true },
    });
    const diff = Math.abs((ledgerTotal._sum.currentBalance || 0) - a.currentBalance);
    if (diff > 0.01) {
      issues.push({ type: "commingling", severity: "critical", description: `${a.accountName}: account balance ($${a.currentBalance.toFixed(2)}) doesn't match client ledger total ($${(ledgerTotal._sum.currentBalance || 0).toFixed(2)})` });
    }
  }

  // Check dormant funds
  const dormant = await db.trustClientLedger.findMany({
    where: { firmId, status: "active", currentBalance: { gt: 0 }, lastActivityAt: { lt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) } },
  });
  for (const d of dormant) {
    issues.push({ type: "dormant_funds", severity: "medium", description: `Dormant funds: ${d.clientName} — $${d.currentBalance.toFixed(2)} (no activity in 12+ months)` });
  }

  return { compliant: issues.filter((i) => i.severity === "critical").length === 0, issues };
}
