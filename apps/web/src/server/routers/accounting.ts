import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { onExpenseRecorded } from "@/lib/auto-journal";

const ACCOUNT_TYPE = ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"] as const;
const BALANCE_DIR = ["DEBIT", "CREDIT"] as const;
const J_SOURCE = ["MANUAL", "INVOICE", "PAYMENT", "TRUST", "EXPENSE", "TIME", "ADJUSTMENT", "OPENING_BALANCE"] as const;
const J_STATUS = ["DRAFT", "POSTED", "VOIDED"] as const;
const EXP_CAT = ["FILING_FEE", "COURT_COST", "EXPERT_WITNESS", "DEPOSITION", "TRAVEL", "POSTAGE", "COPYING", "RESEARCH", "SERVICE_OF_PROCESS", "MEDIATION", "OFFICE_SUPPLY", "SOFTWARE", "INSURANCE", "RENT", "UTILITIES", "MARKETING", "OTHER"] as const;
const BANK_TYPE = ["CHECKING", "SAVINGS", "CREDIT_CARD", "MONEY_MARKET", "OTHER"] as const;
const BANK_TX_TYPE = ["DEPOSIT", "WITHDRAWAL", "TRANSFER", "FEE", "INTEREST", "CHECK", "ACH", "CARD"] as const;

export const accountingRouter = router({
  // ─── Chart of Accounts ─────────────────────────────────────────

  listAccounts: publicProcedure
    .input(z.object({ type: z.enum(ACCOUNT_TYPE).optional(), search: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { isActive: true };
      if (input?.type) where.type = input.type;
      if (input?.search) where.OR = [{ name: { contains: input.search, mode: "insensitive" } }, { accountNumber: { contains: input.search } }];
      return ctx.db.chartOfAccounts.findMany({ where, include: { children: true }, orderBy: { accountNumber: "asc" } });
    }),

  getAccount: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.chartOfAccounts.findUniqueOrThrow({
        where: { id: input.id },
        include: { children: true, journalLines: { include: { entry: true }, orderBy: { createdAt: "desc" }, take: 20 } },
      });
    }),

  createAccount: publicProcedure
    .input(z.object({
      accountNumber: z.string().min(1), name: z.string().min(1), type: z.enum(ACCOUNT_TYPE),
      subType: z.string().optional(), description: z.string().optional(), parentId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const normalBalance = (input.type === "ASSET" || input.type === "EXPENSE") ? "DEBIT" : "CREDIT";
      return ctx.db.chartOfAccounts.create({ data: { ...input, normalBalance } });
    }),

  updateAccount: publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), description: z.string().optional(), subType: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => { const { id, ...data } = input; return ctx.db.chartOfAccounts.update({ where: { id }, data }); }),

  deleteAccount: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const acct = await ctx.db.chartOfAccounts.findUniqueOrThrow({ where: { id: input.id } });
      if (acct.isSystem) throw new Error("Cannot delete system account");
      const lines = await ctx.db.journalLine.count({ where: { accountId: input.id } });
      if (lines > 0) throw new Error("Cannot delete account with journal entries");
      return ctx.db.chartOfAccounts.delete({ where: { id: input.id } });
    }),

  initializeDefaultAccounts: publicProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.db.chartOfAccounts.count();
    if (existing > 0) return { initialized: false, message: "Accounts already exist" };

    const accounts = [
      { accountNumber: "1000", name: "Cash - Operating", type: "ASSET", subType: "Current Asset", normalBalance: "DEBIT" },
      { accountNumber: "1010", name: "Cash - Payroll", type: "ASSET", subType: "Current Asset", normalBalance: "DEBIT" },
      { accountNumber: "1100", name: "Client Trust Account", type: "ASSET", subType: "Current Asset", normalBalance: "DEBIT", isSystem: true },
      { accountNumber: "1200", name: "Accounts Receivable", type: "ASSET", subType: "Current Asset", normalBalance: "DEBIT", isSystem: true },
      { accountNumber: "1300", name: "Work in Progress", type: "ASSET", subType: "Current Asset", normalBalance: "DEBIT" },
      { accountNumber: "1400", name: "Prepaid Expenses", type: "ASSET", subType: "Current Asset", normalBalance: "DEBIT" },
      { accountNumber: "1500", name: "Office Equipment", type: "ASSET", subType: "Fixed Asset", normalBalance: "DEBIT" },
      { accountNumber: "1510", name: "Computer Equipment", type: "ASSET", subType: "Fixed Asset", normalBalance: "DEBIT" },
      { accountNumber: "1600", name: "Accumulated Depreciation", type: "ASSET", subType: "Fixed Asset", normalBalance: "CREDIT" },
      { accountNumber: "2000", name: "Accounts Payable", type: "LIABILITY", subType: "Current Liability", normalBalance: "CREDIT" },
      { accountNumber: "2100", name: "Client Trust Liability", type: "LIABILITY", subType: "Current Liability", normalBalance: "CREDIT", isSystem: true },
      { accountNumber: "2200", name: "Credit Card Payable", type: "LIABILITY", subType: "Current Liability", normalBalance: "CREDIT" },
      { accountNumber: "2300", name: "Payroll Liabilities", type: "LIABILITY", subType: "Current Liability", normalBalance: "CREDIT" },
      { accountNumber: "2400", name: "Taxes Payable", type: "LIABILITY", subType: "Current Liability", normalBalance: "CREDIT" },
      { accountNumber: "2500", name: "Unearned Revenue", type: "LIABILITY", subType: "Current Liability", normalBalance: "CREDIT" },
      { accountNumber: "3000", name: "Owner's Equity", type: "EQUITY", normalBalance: "CREDIT" },
      { accountNumber: "3100", name: "Owner's Draws", type: "EQUITY", normalBalance: "DEBIT" },
      { accountNumber: "3200", name: "Retained Earnings", type: "EQUITY", normalBalance: "CREDIT", isSystem: true },
      { accountNumber: "4000", name: "Legal Fees Revenue", type: "REVENUE", normalBalance: "CREDIT", isSystem: true },
      { accountNumber: "4010", name: "Consultation Fees", type: "REVENUE", normalBalance: "CREDIT" },
      { accountNumber: "4020", name: "Flat Fee Revenue", type: "REVENUE", normalBalance: "CREDIT" },
      { accountNumber: "4030", name: "Contingency Fees", type: "REVENUE", normalBalance: "CREDIT" },
      { accountNumber: "4100", name: "Filing Fee Reimbursements", type: "REVENUE", normalBalance: "CREDIT" },
      { accountNumber: "4200", name: "Interest Income", type: "REVENUE", normalBalance: "CREDIT" },
      { accountNumber: "4300", name: "Other Revenue", type: "REVENUE", normalBalance: "CREDIT" },
      { accountNumber: "5000", name: "Salary & Wages", type: "EXPENSE", subType: "Operating Expense", normalBalance: "DEBIT" },
      { accountNumber: "5100", name: "Payroll Taxes", type: "EXPENSE", subType: "Operating Expense", normalBalance: "DEBIT" },
      { accountNumber: "5200", name: "Health Insurance", type: "EXPENSE", subType: "Operating Expense", normalBalance: "DEBIT" },
      { accountNumber: "5400", name: "Rent", type: "EXPENSE", subType: "Operating Expense", normalBalance: "DEBIT" },
      { accountNumber: "5500", name: "Utilities", type: "EXPENSE", subType: "Operating Expense", normalBalance: "DEBIT" },
      { accountNumber: "5600", name: "Office Supplies", type: "EXPENSE", subType: "Operating Expense", normalBalance: "DEBIT" },
      { accountNumber: "5700", name: "Technology & Software", type: "EXPENSE", subType: "Operating Expense", normalBalance: "DEBIT" },
      { accountNumber: "5800", name: "Insurance - Professional Liability", type: "EXPENSE", subType: "Operating Expense", normalBalance: "DEBIT" },
      { accountNumber: "5900", name: "Marketing & Advertising", type: "EXPENSE", subType: "Operating Expense", normalBalance: "DEBIT" },
      { accountNumber: "6000", name: "Filing Fees", type: "EXPENSE", subType: "Cost of Services", normalBalance: "DEBIT" },
      { accountNumber: "6010", name: "Court Costs", type: "EXPENSE", subType: "Cost of Services", normalBalance: "DEBIT" },
      { accountNumber: "6020", name: "Expert Witness Fees", type: "EXPENSE", subType: "Cost of Services", normalBalance: "DEBIT" },
      { accountNumber: "6030", name: "Deposition Costs", type: "EXPENSE", subType: "Cost of Services", normalBalance: "DEBIT" },
      { accountNumber: "6040", name: "Research & Subscriptions", type: "EXPENSE", subType: "Cost of Services", normalBalance: "DEBIT" },
      { accountNumber: "6060", name: "Travel", type: "EXPENSE", subType: "Cost of Services", normalBalance: "DEBIT" },
      { accountNumber: "6070", name: "Postage & Shipping", type: "EXPENSE", subType: "Cost of Services", normalBalance: "DEBIT" },
      { accountNumber: "6500", name: "Bank Fees", type: "EXPENSE", subType: "Operating Expense", normalBalance: "DEBIT" },
      { accountNumber: "6900", name: "Miscellaneous Expense", type: "EXPENSE", subType: "Operating Expense", normalBalance: "DEBIT" },
    ];

    await ctx.db.chartOfAccounts.createMany({ data: accounts as any[] });
    return { initialized: true, count: accounts.length };
  }),

  // ─── Journal Entries ───────────────────────────────────────────

  listEntries: publicProcedure
    .input(z.object({ source: z.enum(J_SOURCE).optional(), status: z.enum(J_STATUS).optional(), startDate: z.string().optional(), endDate: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.source) where.source = input.source;
      if (input?.status) where.status = input.status;
      if (input?.startDate || input?.endDate) { where.date = {}; if (input?.startDate) where.date.gte = new Date(input.startDate); if (input?.endDate) where.date.lte = new Date(input.endDate); }
      return ctx.db.journalEntry.findMany({ where, include: { lines: { include: { account: true } } }, orderBy: { date: "desc" }, take: input?.limit || 50 });
    }),

  getEntry: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.journalEntry.findUniqueOrThrow({ where: { id: input.id }, include: { lines: { include: { account: true, matter: true, client: true } } } });
    }),

  createEntry: publicProcedure
    .input(z.object({
      date: z.string().or(z.date()), description: z.string().min(1), memo: z.string().optional(),
      source: z.enum(J_SOURCE).default("MANUAL"), sourceId: z.string().optional(), status: z.enum(J_STATUS).default("DRAFT"),
      lines: z.array(z.object({ accountId: z.string(), debit: z.number().default(0), credit: z.number().default(0), description: z.string().optional(), matterId: z.string().optional(), clientId: z.string().optional() })),
    }))
    .mutation(async ({ ctx, input }) => {
      const totalDebit = input.lines.reduce((s, l) => s + l.debit, 0);
      const totalCredit = input.lines.reduce((s, l) => s + l.credit, 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) throw new Error(`Entry must balance. Debits: $${totalDebit.toFixed(2)}, Credits: $${totalCredit.toFixed(2)}`);

      const last = await ctx.db.journalEntry.findFirst({ orderBy: { entryNumber: "desc" } });
      const num = last ? parseInt(last.entryNumber.replace("JE-", "")) + 1 : 1;
      const entryNumber = `JE-${num.toString().padStart(4, "0")}`;

      const entry = await ctx.db.journalEntry.create({
        data: {
          entryNumber, date: new Date(input.date), description: input.description, memo: input.memo,
          source: input.source, sourceId: input.sourceId, status: input.status,
          postedAt: input.status === "POSTED" ? new Date() : undefined,
          lines: { create: input.lines },
        },
        include: { lines: true },
      });

      if (input.status === "POSTED") {
        for (const line of input.lines) {
          const net = line.debit - line.credit;
          if (net !== 0) await ctx.db.chartOfAccounts.update({ where: { id: line.accountId }, data: { currentBalance: { increment: net } } });
        }
      }

      return entry;
    }),

  postEntry: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.journalEntry.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true } });
      if (entry.status !== "DRAFT") throw new Error("Only draft entries can be posted");

      for (const line of entry.lines) {
        const net = Number(line.debit) - Number(line.credit);
        if (net !== 0) await ctx.db.chartOfAccounts.update({ where: { id: line.accountId }, data: { currentBalance: { increment: net } } });
      }

      return ctx.db.journalEntry.update({ where: { id: input.id }, data: { status: "POSTED", postedAt: new Date() } });
    }),

  voidEntry: publicProcedure
    .input(z.object({ id: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.journalEntry.findUniqueOrThrow({ where: { id: input.id }, include: { lines: true } });
      if (entry.status !== "POSTED") throw new Error("Only posted entries can be voided");

      // Reverse balances
      for (const line of entry.lines) {
        const net = Number(line.debit) - Number(line.credit);
        if (net !== 0) await ctx.db.chartOfAccounts.update({ where: { id: line.accountId }, data: { currentBalance: { decrement: net } } });
      }

      return ctx.db.journalEntry.update({ where: { id: input.id }, data: { status: "VOIDED", voidedAt: new Date(), voidReason: input.reason } });
    }),

  // ─── Expenses ──────────────────────────────────────────────────

  listExpenses: publicProcedure
    .input(z.object({ matterId: z.string().optional(), category: z.enum(EXP_CAT).optional(), isBillable: z.boolean().optional(), isPaid: z.boolean().optional(), startDate: z.string().optional(), endDate: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.category) where.category = input.category;
      if (input?.isBillable !== undefined) where.isBillable = input.isBillable;
      if (input?.isPaid !== undefined) where.isPaid = input.isPaid;
      if (input?.startDate || input?.endDate) { where.date = {}; if (input?.startDate) where.date.gte = new Date(input.startDate); if (input?.endDate) where.date.lte = new Date(input.endDate); }
      return ctx.db.expense.findMany({ where, include: { matter: true, account: true }, orderBy: { date: "desc" }, take: 100 });
    }),

  createExpense: publicProcedure
    .input(z.object({
      matterId: z.string().optional(), clientId: z.string().optional(), vendorName: z.string().min(1),
      category: z.enum(EXP_CAT), description: z.string().min(1), amount: z.number(),
      date: z.string().or(z.date()), isBillable: z.boolean().optional(), isReimbursable: z.boolean().optional(),
      accountId: z.string().optional(), receiptUrl: z.string().optional(), notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const expense = await ctx.db.expense.create({ data: { ...input, date: new Date(input.date) } });
      try { await onExpenseRecorded({ id: expense.id, amount: input.amount, accountId: input.accountId, matterId: input.matterId, clientId: input.clientId }); } catch {}
      return expense;
    }),

  updateExpense: publicProcedure
    .input(z.object({ id: z.string(), vendorName: z.string().optional(), category: z.enum(EXP_CAT).optional(), description: z.string().optional(), amount: z.number().optional(), isBillable: z.boolean().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => { const { id, ...data } = input; return ctx.db.expense.update({ where: { id }, data }); }),

  deleteExpense: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.expense.delete({ where: { id: input.id } })),

  markExpensePaid: publicProcedure
    .input(z.object({ id: z.string(), paidMethod: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.expense.update({ where: { id: input.id }, data: { isPaid: true, paidDate: new Date(), paidMethod: input.paidMethod } })),

  getExpenseSummary: publicProcedure
    .input(z.object({ matterId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      const expenses = await ctx.db.expense.findMany({ where });
      const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
      const billable = expenses.filter((e) => e.isBillable).reduce((s, e) => s + Number(e.amount), 0);
      const unpaid = expenses.filter((e) => !e.isPaid).reduce((s, e) => s + Number(e.amount), 0);
      const byCategory: Record<string, number> = {};
      for (const e of expenses) { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount); }
      return { total, billable, nonBillable: total - billable, unpaid, byCategory };
    }),

  // ─── Bank Accounts ─────────────────────────────────────────────

  listBankAccounts: publicProcedure.query(async ({ ctx }) => ctx.db.bankAccount.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })),

  createBankAccount: publicProcedure
    .input(z.object({ name: z.string(), accountType: z.enum(BANK_TYPE), bankName: z.string().optional(), lastFour: z.string().optional(), chartAccountId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.bankAccount.create({ data: input })),

  getBankAccount: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.bankAccount.findUniqueOrThrow({ where: { id: input.id }, include: { transactions: { orderBy: { date: "desc" }, take: 50 } } })),

  listBankTransactions: publicProcedure
    .input(z.object({ bankAccountId: z.string(), isReconciled: z.boolean().optional(), limit: z.number().default(100) }))
    .query(async ({ ctx, input }) => {
      const where: any = { bankAccountId: input.bankAccountId };
      if (input.isReconciled !== undefined) where.isReconciled = input.isReconciled;
      return ctx.db.bankTransaction.findMany({ where, orderBy: { date: "desc" }, take: input.limit });
    }),

  createBankTransaction: publicProcedure
    .input(z.object({ bankAccountId: z.string(), date: z.string().or(z.date()), description: z.string(), amount: z.number(), type: z.enum(BANK_TX_TYPE), reference: z.string().optional(), payee: z.string().optional(), category: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const tx = await ctx.db.bankTransaction.create({ data: { ...input, date: new Date(input.date) } });
      await ctx.db.bankAccount.update({ where: { id: input.bankAccountId }, data: { currentBalance: { increment: input.amount } } });
      return tx;
    }),

  // ─── Reconciliation ────────────────────────────────────────────

  startReconciliation: publicProcedure
    .input(z.object({ bankAccountId: z.string(), statementDate: z.string(), statementBalance: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.reconciliationSession.create({ data: { bankAccountId: input.bankAccountId, statementDate: new Date(input.statementDate), statementBalance: input.statementBalance } });
    }),

  toggleReconciled: publicProcedure
    .input(z.object({ transactionId: z.string(), isReconciled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.bankTransaction.update({ where: { id: input.transactionId }, data: { isReconciled: input.isReconciled, reconciledAt: input.isReconciled ? new Date() : null } });
    }),

  completeReconciliation: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.reconciliationSession.findUniqueOrThrow({ where: { id: input.sessionId } });
      const reconciled = await ctx.db.bankTransaction.findMany({ where: { bankAccountId: session.bankAccountId, isReconciled: true } });
      const reconciledBalance = reconciled.reduce((s, t) => s + Number(t.amount), 0);
      const difference = Math.round((reconciledBalance - Number(session.statementBalance)) * 100) / 100;

      return ctx.db.reconciliationSession.update({
        where: { id: input.sessionId },
        data: { status: "COMPLETED", completedAt: new Date(), reconciledBalance, difference, transactionCount: reconciled.length },
      });
    }),

  // ─── Vendors ───────────────────────────────────────────────────

  listVendors: publicProcedure.query(async ({ ctx }) => ctx.db.vendorContact.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })),

  createVendor: publicProcedure
    .input(z.object({ name: z.string(), company: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), address: z.string().optional(), category: z.string().optional(), taxId: z.string().optional(), is1099Eligible: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.vendorContact.create({ data: input })),

  updateVendor: publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), company: z.string().optional(), email: z.string().optional(), phone: z.string().optional(), category: z.string().optional(), taxId: z.string().optional(), is1099Eligible: z.boolean().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => { const { id, ...data } = input; return ctx.db.vendorContact.update({ where: { id }, data }); }),

  // ─── Budgets ───────────────────────────────────────────────────

  listBudgets: publicProcedure
    .input(z.object({ period: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.budgetItem.findMany({ where: { period: input.period }, include: { account: true } })),

  setBudget: publicProcedure
    .input(z.object({ accountId: z.string(), period: z.string(), amount: z.number(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.budgetItem.upsert({
        where: { accountId_period: { accountId: input.accountId, period: input.period } },
        create: { accountId: input.accountId, period: input.period, budgetedAmount: input.amount, notes: input.notes },
        update: { budgetedAmount: input.amount, notes: input.notes },
      });
    }),

  // ─── Financial Reports ─────────────────────────────────────────

  profitAndLoss: publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ ctx, input }) => {
      const lines = await ctx.db.journalLine.findMany({
        where: { entry: { status: "POSTED", date: { gte: new Date(input.startDate), lte: new Date(input.endDate) } } },
        include: { account: true },
      });

      const revenue: Record<string, { account: string; amount: number }> = {};
      const expenses: Record<string, { account: string; amount: number }> = {};

      for (const l of lines) {
        const net = Number(l.credit) - Number(l.debit);
        if (l.account.type === "REVENUE") {
          revenue[l.accountId] = revenue[l.accountId] || { account: l.account.name, amount: 0 };
          revenue[l.accountId].amount += net;
        } else if (l.account.type === "EXPENSE") {
          expenses[l.accountId] = expenses[l.accountId] || { account: l.account.name, amount: 0 };
          expenses[l.accountId].amount += Number(l.debit) - Number(l.credit);
        }
      }

      const totalRevenue = Object.values(revenue).reduce((s, r) => s + r.amount, 0);
      const totalExpenses = Object.values(expenses).reduce((s, e) => s + e.amount, 0);

      return { revenue: Object.values(revenue), expenses: Object.values(expenses), totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses };
    }),

  balanceSheet: publicProcedure
    .input(z.object({ asOfDate: z.string() }))
    .query(async ({ ctx, input }) => {
      const accounts = await ctx.db.chartOfAccounts.findMany({ where: { isActive: true }, orderBy: { accountNumber: "asc" } });
      const assets = accounts.filter((a) => a.type === "ASSET").map((a) => ({ account: a.name, number: a.accountNumber, balance: Number(a.currentBalance) }));
      const liabilities = accounts.filter((a) => a.type === "LIABILITY").map((a) => ({ account: a.name, number: a.accountNumber, balance: Number(a.currentBalance) }));
      const equity = accounts.filter((a) => a.type === "EQUITY").map((a) => ({ account: a.name, number: a.accountNumber, balance: Number(a.currentBalance) }));
      return {
        assets, liabilities, equity,
        totalAssets: assets.reduce((s, a) => s + a.balance, 0),
        totalLiabilities: liabilities.reduce((s, l) => s + l.balance, 0),
        totalEquity: equity.reduce((s, e) => s + e.balance, 0),
      };
    }),

  trialBalance: publicProcedure
    .input(z.object({ asOfDate: z.string() }))
    .query(async ({ ctx }) => {
      const accounts = await ctx.db.chartOfAccounts.findMany({ where: { isActive: true }, orderBy: { accountNumber: "asc" } });
      return accounts.filter((a) => Number(a.currentBalance) !== 0).map((a) => ({
        number: a.accountNumber, name: a.name, type: a.type,
        debit: a.normalBalance === "DEBIT" ? Math.abs(Number(a.currentBalance)) : 0,
        credit: a.normalBalance === "CREDIT" ? Math.abs(Number(a.currentBalance)) : 0,
      }));
    }),

  generalLedger: publicProcedure
    .input(z.object({ accountId: z.string(), startDate: z.string(), endDate: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.journalLine.findMany({
        where: { accountId: input.accountId, entry: { status: "POSTED", date: { gte: new Date(input.startDate), lte: new Date(input.endDate) } } },
        include: { entry: true },
        orderBy: { entry: { date: "asc" } },
      });
    }),

  incomeByClient: publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string() }))
    .query(async ({ ctx, input }) => {
      const lines = await ctx.db.journalLine.findMany({
        where: { clientId: { not: null }, account: { type: "REVENUE" }, entry: { status: "POSTED", date: { gte: new Date(input.startDate), lte: new Date(input.endDate) } } },
        include: { client: true },
      });
      const byClient: Record<string, { name: string; amount: number }> = {};
      for (const l of lines) {
        const cid = l.clientId!;
        byClient[cid] = byClient[cid] || { name: l.client?.name || "Unknown", amount: 0 };
        byClient[cid].amount += Number(l.credit) - Number(l.debit);
      }
      return Object.values(byClient).sort((a, b) => b.amount - a.amount);
    }),

  expenseReport: publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string(), matterId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { date: { gte: new Date(input.startDate), lte: new Date(input.endDate) } };
      if (input.matterId) where.matterId = input.matterId;
      const expenses = await ctx.db.expense.findMany({ where, include: { matter: true }, orderBy: { date: "desc" } });
      const byCategory: Record<string, number> = {};
      for (const e of expenses) { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount); }
      return { expenses, byCategory, total: expenses.reduce((s, e) => s + Number(e.amount), 0) };
    }),

  // ─── Dashboard Stats ───────────────────────────────────────────

  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const bankAccounts = await ctx.db.bankAccount.findMany({ where: { isActive: true } });
    const cashBalance = bankAccounts.reduce((s, a) => s + Number(a.currentBalance), 0);

    const ar = await ctx.db.chartOfAccounts.findUnique({ where: { accountNumber: "1200" } });
    const arBalance = ar ? Number(ar.currentBalance) : 0;

    const revenueAccounts = await ctx.db.chartOfAccounts.findMany({ where: { type: "REVENUE" } });
    const expenseAccounts = await ctx.db.chartOfAccounts.findMany({ where: { type: "EXPENSE" } });

    // Revenue & expenses this month from journal lines
    const monthLines = await ctx.db.journalLine.findMany({
      where: { entry: { status: "POSTED", date: { gte: monthStart } } },
      include: { account: true },
    });
    let monthRevenue = 0, monthExpenses = 0;
    for (const l of monthLines) {
      if (l.account.type === "REVENUE") monthRevenue += Number(l.credit) - Number(l.debit);
      if (l.account.type === "EXPENSE") monthExpenses += Number(l.debit) - Number(l.credit);
    }

    const trust = await ctx.db.chartOfAccounts.findUnique({ where: { accountNumber: "1100" } });

    return { cashBalance, arBalance, monthRevenue, monthExpenses, netIncome: monthRevenue - monthExpenses, trustBalance: trust ? Number(trust.currentBalance) : 0 };
  }),
});
