import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { recordTrustDeposit, recordTrustDisbursement, performReconciliation, runComplianceChecks } from "@/lib/trust-accounting-engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const trustAccountingRouter = router({
  // ACCOUNTS
  getAccounts: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.trustBankAccount.findMany({
      where: { firmId: DEFAULT_FIRM_ID, isActive: true },
      include: { _count: { select: { clientLedgers: true } } },
      orderBy: { accountName: "asc" },
    });
  }),

  getAccount: publicProcedure.input(z.object({ accountId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.trustBankAccount.findUnique({
      where: { id: input.accountId },
      include: { clientLedgers: { where: { status: "active" }, orderBy: { clientName: "asc" } } },
    });
  }),

  createAccount: publicProcedure
    .input(z.object({ accountName: z.string(), accountType: z.string(), bankName: z.string(), bankBranch: z.string().optional(), accountNumberLast4: z.string().optional(), interestBearing: z.boolean().optional(), iolaBarNumber: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.trustBankAccount.create({ data: { ...input, firmId: DEFAULT_FIRM_ID } });
    }),

  // CLIENT LEDGERS
  getClientLedger: publicProcedure
    .input(z.object({ accountId: z.string(), matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.trustClientLedger.findUnique({ where: { accountId_matterId: { accountId: input.accountId, matterId: input.matterId } } });
    }),

  getClientLedgers: publicProcedure
    .input(z.object({ accountId: z.string(), status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { accountId: input.accountId };
      if (input.status) where.status = input.status;
      return ctx.db.trustClientLedger.findMany({ where, orderBy: { clientName: "asc" } });
    }),

  // DEPOSITS
  recordDeposit: publicProcedure
    .input(z.object({ accountId: z.string(), matterId: z.string(), clientName: z.string(), amount: z.number(), description: z.string(), depositMethod: z.string(), checkNumber: z.string().optional(), referenceNumber: z.string().optional() }))
    .mutation(async ({ input }) => {
      return recordTrustDeposit({ ...input, userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID });
    }),

  // DISBURSEMENTS
  recordDisbursement: publicProcedure
    .input(z.object({ accountId: z.string(), matterId: z.string(), clientName: z.string(), amount: z.number(), disbursementType: z.string(), payee: z.string(), description: z.string(), method: z.string(), checkNumber: z.string().optional(), approvedBy: z.string() }))
    .mutation(async ({ input }) => {
      return recordTrustDisbursement({ ...input, userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID });
    }),

  checkAvailableBalance: publicProcedure
    .input(z.object({ accountId: z.string(), matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const ledger = await ctx.db.trustClientLedger.findUnique({ where: { accountId_matterId: input } });
      return { available: ledger?.currentBalance || 0 };
    }),

  // JOURNAL
  getJournalEntries: publicProcedure
    .input(z.object({ accountId: z.string(), matterId: z.string().optional(), limit: z.number().optional().default(50) }))
    .query(async ({ ctx, input }) => {
      const where: any = { accountId: input.accountId };
      if (input.matterId) where.matterId = input.matterId;
      return ctx.db.trustJournalEntry.findMany({ where, orderBy: { entryDate: "desc" }, take: input.limit });
    }),

  // RECONCILIATION
  getReconciliations: publicProcedure
    .input(z.object({ accountId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.trustReconciliation.findMany({ where: { accountId: input.accountId }, orderBy: { reconciliationDate: "desc" } });
    }),

  performReconciliation: publicProcedure
    .input(z.object({ accountId: z.string(), statementBalance: z.number(), outstandingDeposits: z.any().optional(), outstandingChecks: z.any().optional() }))
    .mutation(async ({ input }) => {
      return performReconciliation({ ...input, reconciledBy: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID });
    }),

  // SETTLEMENT DISBURSEMENTS
  getSettlementDisbursements: publicProcedure
    .input(z.object({ matterId: z.string().optional(), status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.matterId) where.matterId = input.matterId;
      if (input.status) where.status = input.status;
      return ctx.db.settlementDisbursement.findMany({ where, orderBy: { createdAt: "desc" } });
    }),

  createSettlementDisbursement: publicProcedure
    .input(z.object({ matterId: z.string(), matterName: z.string().optional(), clientName: z.string(), trustAccountId: z.string(), grossRecovery: z.number(), settlementType: z.string(), fundingSource: z.string().optional(), fundingEntity: z.string().optional(), settlementDate: z.date(), disbursementLines: z.any() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.settlementDisbursement.create({ data: { ...input, userId: DEFAULT_USER_ID, firmId: DEFAULT_FIRM_ID } });
    }),

  approveSettlement: publicProcedure
    .input(z.object({ disbursementId: z.string(), approver: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.settlementDisbursement.update({ where: { id: input.disbursementId }, data: { status: "attorney_approved", attorneyApprovedAt: new Date() } });
    }),

  // COMPLIANCE
  checkCompliance: publicProcedure.query(async () => {
    return runComplianceChecks(DEFAULT_FIRM_ID);
  }),

  getComplianceAlerts: publicProcedure
    .input(z.object({ status: z.string().optional(), severity: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.status) where.status = input.status;
      if (input.severity) where.severity = input.severity;
      return ctx.db.trustComplianceAlert.findMany({ where, orderBy: [{ severity: "asc" }, { createdAt: "desc" }] });
    }),

  resolveAlert: publicProcedure
    .input(z.object({ alertId: z.string(), resolution: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.trustComplianceAlert.update({ where: { id: input.alertId }, data: { status: "resolved", resolvedAt: new Date(), resolvedBy: DEFAULT_USER_ID, resolution: input.resolution } });
    }),

  // RULES
  getComplianceRules: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.trustComplianceRule.findMany({ where: { isActive: true, OR: [{ firmId: DEFAULT_FIRM_ID }, { firmId: null }] } });
  }),

  // DASHBOARD STATS
  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.db.trustBankAccount.findMany({ where: { firmId: DEFAULT_FIRM_ID, isActive: true } });
    const totalBalance = accounts.reduce((sum, a) => sum + a.currentBalance, 0);
    const trustAccounts = accounts.filter((a) => a.accountType !== "operating");
    const trustBalance = trustAccounts.reduce((sum, a) => sum + a.currentBalance, 0);

    const activeLedgers = await ctx.db.trustClientLedger.count({ where: { firmId: DEFAULT_FIRM_ID, status: "active" } });
    const compliance = await runComplianceChecks(DEFAULT_FIRM_ID);

    const reconOverdue = trustAccounts.filter((a) => a.nextReconciliationDue && a.nextReconciliationDue < new Date()).length;

    return {
      totalBalance,
      trustBalance,
      activeLedgers,
      accountCount: accounts.length,
      compliant: compliance.compliant,
      issueCount: compliance.issues.length,
      criticalIssues: compliance.issues.filter((i) => i.severity === "critical").length,
      reconOverdue,
    };
  }),
});
