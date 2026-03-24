import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const FIRM_ID = "demo-firm";
const USER_ID = "demo-user";

async function main() {
  console.log("Seeding trust bank accounts...");

  const iolaAccount = await prisma.trustBankAccount.upsert({
    where: { id: "trust-iola" },
    create: {
      id: "trust-iola", accountName: "IOLA Trust Account", accountType: "iola", bankName: "Signature Bank", bankBranch: "Woodmere Branch",
      accountNumberLast4: "7890", routingNumberLast4: "1234", accountHolderName: "Rubinstein Law Firm IOLA Trust Account",
      openingDate: new Date("2025-01-01"), currentBalance: 47250, lastBankBalance: 46500, lastBankBalanceDate: new Date("2026-03-01"),
      pendingDeposits: 1500, pendingDisbursements: 750, interestBearing: true, iolaBarNumber: "NY-IOLA-12345",
      iolaFundRecipient: "Interest on Lawyer Account Fund of the State of New York",
      lastReconciledAt: new Date("2026-03-01"), nextReconciliationDue: new Date("2026-04-01"),
      signatories: [{ name: "Jacob Rubinstein, Esq.", title: "Principal", canApprove: true }],
      complianceStatus: "compliant", firmId: FIRM_ID,
    },
    update: {},
  });

  await prisma.trustBankAccount.upsert({
    where: { id: "trust-operating" },
    create: {
      id: "trust-operating", accountName: "Operating Account", accountType: "operating", bankName: "Chase", bankBranch: "Woodmere",
      accountNumberLast4: "1234", accountHolderName: "Rubinstein Law Firm Operating Account",
      openingDate: new Date("2025-01-01"), currentBalance: 128000,
      lastReconciledAt: new Date("2026-03-01"), firmId: FIRM_ID,
    },
    update: {},
  });

  console.log("Seeding client ledgers...");
  const firstMatter = await prisma.matter.findFirst({ where: { status: "OPEN" } });
  const matterId = firstMatter?.id || "demo-matter";

  const ledgers = [
    { matterId, matterName: "Smith v. Jones", clientName: "John Smith", currentBalance: 15000, totalDeposited: 15000, totalDisbursed: 0, notes: "Retainer deposit received at engagement" },
    { matterId: matterId + "-2", matterName: "Rodriguez Estate", clientName: "Maria Rodriguez", currentBalance: 22500, totalDeposited: 25000, totalDisbursed: 2500 },
    { matterId: matterId + "-3", matterName: "Chen Immigration", clientName: "Robert Chen", currentBalance: 4500, totalDeposited: 4500, totalDisbursed: 0 },
    { matterId: matterId + "-4", matterName: "Johnson PI", clientName: "James Johnson", currentBalance: 5250, totalDeposited: 150000, totalDisbursed: 144750, notes: "Settlement partial — awaiting final lien" },
  ];

  for (const l of ledgers) {
    await prisma.trustClientLedger.upsert({
      where: { accountId_matterId: { accountId: "trust-iola", matterId: l.matterId } },
      create: { accountId: "trust-iola", ...l, lastActivityAt: new Date(), firmId: FIRM_ID },
      update: {},
    });
  }
  console.log(`Seeded ${ledgers.length} client ledgers.`);

  console.log("Seeding journal entries...");
  const entries = [
    { ref: "TT-2026-000001", matterId, clientName: "John Smith", entryDate: new Date("2026-01-15"), debitAccount: "Trust Bank — IOLA", creditAccount: "Client Liability — Smith", description: "Retainer deposit — Smith v. Jones", debitAmount: 15000, creditAmount: 15000, runningBalance: 15000, transactionType: "deposit", disbursementMethod: "check" },
    { ref: "TT-2026-000002", matterId: matterId + "-2", clientName: "Maria Rodriguez", entryDate: new Date("2026-01-20"), debitAccount: "Trust Bank — IOLA", creditAccount: "Client Liability — Rodriguez", description: "Estate administration retainer", debitAmount: 25000, creditAmount: 25000, runningBalance: 40000, transactionType: "deposit", disbursementMethod: "wire" },
    { ref: "TT-2026-000003", matterId: matterId + "-2", clientName: "Maria Rodriguez", entryDate: new Date("2026-02-15"), debitAccount: "Client Liability — Rodriguez", creditAccount: "Trust Bank — IOLA", description: "Earned fees — February", debitAmount: 2500, creditAmount: 2500, runningBalance: 37500, transactionType: "earned_fee", disbursementPayee: "Rubinstein Law Firm", disbursementMethod: "transfer", approvedBy: USER_ID },
    { ref: "TT-2026-000004", matterId: matterId + "-3", clientName: "Robert Chen", entryDate: new Date("2026-02-01"), debitAccount: "Trust Bank — IOLA", creditAccount: "Client Liability — Chen", description: "Immigration filing retainer", debitAmount: 4500, creditAmount: 4500, runningBalance: 42000, transactionType: "deposit", disbursementMethod: "check" },
    { ref: "TT-2026-000005", matterId: matterId + "-4", clientName: "James Johnson", entryDate: new Date("2026-02-20"), debitAccount: "Trust Bank — IOLA", creditAccount: "Client Liability — Johnson", description: "Settlement check deposit — State Farm", debitAmount: 150000, creditAmount: 150000, runningBalance: 192000, transactionType: "deposit", disbursementMethod: "check" },
    { ref: "TT-2026-000006", matterId: matterId + "-4", clientName: "James Johnson", entryDate: new Date("2026-02-25"), debitAccount: "Client Liability — Johnson", creditAccount: "Trust Bank — IOLA", description: "Attorney fee — 33.33%", debitAmount: 49995, creditAmount: 49995, runningBalance: 142005, transactionType: "earned_fee", disbursementPayee: "Rubinstein Law Firm", disbursementMethod: "transfer", approvedBy: USER_ID },
    { ref: "TT-2026-000007", matterId: matterId + "-4", clientName: "James Johnson", entryDate: new Date("2026-03-01"), debitAccount: "Client Liability — Johnson", creditAccount: "Trust Bank — IOLA", description: "Client distribution — partial", debitAmount: 89505, creditAmount: 89505, runningBalance: 52500, transactionType: "client_refund", disbursementPayee: "James Johnson", disbursementMethod: "check", checkNumber: "1048", approvedBy: USER_ID },
  ];

  for (const e of entries) {
    await prisma.trustJournalEntry.create({ data: { accountId: "trust-iola", ...e, isCleared: true, clearedAt: e.entryDate, userId: USER_ID, firmId: FIRM_ID } });
  }
  console.log(`Seeded ${entries.length} journal entries.`);

  // Reconciliation
  console.log("Seeding reconciliation...");
  await prisma.trustReconciliation.create({
    data: {
      accountId: "trust-iola", reconciliationDate: new Date("2026-03-01"), statementBalance: 46500, firmLedgerBalance: 47250, clientLedgersTotal: 47250,
      outstandingDeposits: [{ amount: 1500, description: "Chen retainer check — deposited Feb 28" }],
      outstandingChecks: [{ amount: 750, checkNumber: "1047", payee: "NY County Clerk", description: "Filing fee" }],
      adjustedBankBalance: 47250, threeWayMatch: true, status: "completed",
      reconciledBy: USER_ID, completedAt: new Date("2026-03-01"), firmId: FIRM_ID,
    },
  });

  // Compliance rules
  console.log("Seeding compliance rules...");
  const rules = [
    { id: "rule-neg-bal", name: "No Negative Client Balance", ruleType: "balance_minimum", condition: { type: "client_balance_minimum", minimum: 0 }, action: { type: "block_transaction", alert: "critical" }, regulatoryReference: "NY RPC 1.15(a)" },
    { id: "rule-recon", name: "Monthly Reconciliation Required", ruleType: "reconciliation_frequency", condition: { type: "reconciliation_overdue", daysThreshold: 35 }, action: { type: "alert", severity: "high" }, regulatoryReference: "NY RPC 1.15(d)(1)(vii)" },
    { id: "rule-large-disb", name: "Large Disbursement Review", ruleType: "disbursement_limit", condition: { type: "disbursement_exceeds", threshold: 10000 }, action: { type: "require_dual_approval" }, regulatoryReference: "Best practice" },
    { id: "rule-dormant", name: "Dormant Funds Alert", ruleType: "dormancy_threshold", condition: { type: "no_activity_days", threshold: 365 }, action: { type: "alert", severity: "medium" }, regulatoryReference: "NY Abandoned Property Law" },
    { id: "rule-commingling", name: "No Commingling", ruleType: "commingling_check", condition: { type: "client_total_mismatch", tolerance: 0.01 }, action: { type: "alert", severity: "critical" }, regulatoryReference: "NY RPC 1.15(a)" },
    { id: "rule-stale-check", name: "Stale Check Alert", ruleType: "disbursement_limit", condition: { type: "outstanding_check_days", threshold: 90 }, action: { type: "alert", severity: "medium" } },
  ];
  for (const r of rules) {
    await prisma.trustComplianceRule.upsert({ where: { id: r.id }, create: { ...r, isActive: true, firmId: null }, update: {} });
  }
  console.log(`Seeded ${rules.length} compliance rules.`);

  // Compliance alerts (resolved)
  await prisma.trustComplianceAlert.create({ data: { accountId: "trust-iola", alertType: "reconciliation_overdue", severity: "info", title: "Monthly reconciliation completed", description: "March 2026 reconciliation completed successfully", status: "resolved", resolvedAt: new Date("2026-03-01"), resolvedBy: USER_ID, resolution: "Reconciliation completed — 3-way match confirmed", firmId: FIRM_ID } });

  console.log("Trust accounting seed complete!");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
