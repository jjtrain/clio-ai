import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { autoMatchTransactions, categorizeTransaction, detectAnomalies } from "@/lib/ai-reconciliation";

const MATCH_TYPE_ENUM = ["EXACT_AMOUNT", "AMOUNT_RANGE", "DESCRIPTION_CONTAINS", "VENDOR_MATCH", "REGEX"] as const;

export const reconciliationRouter = router({
  // ─── Auto-Matching ─────────────────────────────────────────────

  autoMatch: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.reconciliationSession.findUniqueOrThrow({ where: { id: input.sessionId } });
      const transactions = await ctx.db.bankTransaction.findMany({
        where: { bankAccountId: session.bankAccountId, isReconciled: false },
        orderBy: { date: "desc" },
      });

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const invoices = await ctx.db.invoice.findMany({
        where: { issueDate: { gte: thirtyDaysAgo } },
        include: { matter: { include: { client: true } } },
        take: 50,
      });
      const payments = await ctx.db.payment.findMany({ where: { paymentDate: { gte: thirtyDaysAgo } }, take: 50 });
      const expenses = await ctx.db.expense.findMany({ where: { date: { gte: thirtyDaysAgo } }, take: 50 });

      const matches = await autoMatchTransactions(
        transactions.map((t) => ({ id: t.id, date: t.date.toISOString().split("T")[0], amount: Number(t.amount), description: t.description, payee: t.payee || undefined })),
        {
          invoices: invoices.map((i) => ({ id: i.id, number: i.invoiceNumber, total: Number(i.total), date: i.issueDate.toISOString().split("T")[0], clientName: i.matter?.client?.name })),
          payments: payments.map((p) => ({ id: p.id, amount: Number(p.amount), date: p.paymentDate.toISOString().split("T")[0], method: p.paymentMethod, reference: p.reference || undefined })),
          expenses: expenses.map((e) => ({ id: e.id, amount: Number(e.amount), date: e.date.toISOString().split("T")[0], vendorName: e.vendorName, description: e.description })),
          trustTransactions: [],
        }
      );

      const created = [];
      for (const m of matches) {
        if (m.confidence > 30) {
          const rec = await ctx.db.reconciliationMatch.create({
            data: {
              sessionId: input.sessionId,
              bankTransactionId: m.bankTransactionId,
              matchedEntityType: m.matchedType,
              matchedEntityId: m.matchedId,
              matchType: m.confidence >= 90 ? "AUTO_EXACT" : "AUTO_FUZZY",
              confidence: m.confidence,
            },
          });
          created.push({ ...rec, reasoning: m.reasoning });
        }
      }
      return created;
    }),

  confirmMatch: publicProcedure
    .input(z.object({ matchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const match = await ctx.db.reconciliationMatch.update({
        where: { id: input.matchId },
        data: { isConfirmed: true },
      });
      await ctx.db.bankTransaction.update({
        where: { id: match.bankTransactionId },
        data: { isReconciled: true, reconciledAt: new Date() },
      });
      return match;
    }),

  rejectMatch: publicProcedure
    .input(z.object({ matchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.reconciliationMatch.delete({ where: { id: input.matchId } });
    }),

  manualMatch: publicProcedure
    .input(z.object({ sessionId: z.string(), bankTransactionId: z.string(), entityType: z.string(), entityId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const match = await ctx.db.reconciliationMatch.create({
        data: {
          sessionId: input.sessionId,
          bankTransactionId: input.bankTransactionId,
          matchedEntityType: input.entityType,
          matchedEntityId: input.entityId,
          matchType: "MANUAL",
          confidence: 100,
          isConfirmed: true,
        },
      });
      await ctx.db.bankTransaction.update({
        where: { id: input.bankTransactionId },
        data: { isReconciled: true, reconciledAt: new Date() },
      });
      return match;
    }),

  bulkConfirm: publicProcedure
    .input(z.object({ matchIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      let confirmed = 0;
      for (const id of input.matchIds) {
        const match = await ctx.db.reconciliationMatch.update({ where: { id }, data: { isConfirmed: true } });
        await ctx.db.bankTransaction.update({ where: { id: match.bankTransactionId }, data: { isReconciled: true, reconciledAt: new Date() } });
        confirmed++;
      }
      return { confirmed };
    }),

  getMatches: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.reconciliationMatch.findMany({
        where: { sessionId: input.sessionId },
        include: { bankTransaction: true },
        orderBy: { confidence: "desc" },
      });
    }),

  // ─── CSV Import ────────────────────────────────────────────────

  parseCSV: publicProcedure
    .input(z.object({
      bankAccountId: z.string(),
      csvContent: z.string(),
      mapping: z.object({
        dateColumn: z.number(),
        descriptionColumn: z.number(),
        amountColumn: z.number(),
        depositColumn: z.number().optional(),
        withdrawalColumn: z.number().optional(),
        referenceColumn: z.number().optional(),
      }),
    }))
    .mutation(async ({ ctx, input }) => {
      const lines = input.csvContent.split("\n").filter((l) => l.trim());
      if (lines.length < 2) throw new Error("CSV must have at least a header and one data row");

      const rows = lines.slice(1); // skip header
      let imported = 0;

      for (const row of rows) {
        const cols = row.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const dateStr = cols[input.mapping.dateColumn];
        const description = cols[input.mapping.descriptionColumn];
        let amount: number;

        if (input.mapping.depositColumn !== undefined && input.mapping.withdrawalColumn !== undefined) {
          const dep = parseFloat(cols[input.mapping.depositColumn] || "0") || 0;
          const wth = parseFloat(cols[input.mapping.withdrawalColumn] || "0") || 0;
          amount = dep > 0 ? dep : -wth;
        } else {
          amount = parseFloat(cols[input.mapping.amountColumn] || "0") || 0;
        }

        if (!dateStr || !description || amount === 0) continue;

        const date = new Date(dateStr);
        if (isNaN(date.getTime())) continue;

        const reference = input.mapping.referenceColumn !== undefined ? cols[input.mapping.referenceColumn] : undefined;

        await ctx.db.bankTransaction.create({
          data: {
            bankAccountId: input.bankAccountId,
            date,
            description,
            amount,
            type: amount > 0 ? "DEPOSIT" : "WITHDRAWAL",
            reference: reference || undefined,
          },
        });
        imported++;
      }

      // Update bank account balance
      const txs = await ctx.db.bankTransaction.findMany({ where: { bankAccountId: input.bankAccountId } });
      const balance = txs.reduce((s, t) => s + Number(t.amount), 0);
      await ctx.db.bankAccount.update({ where: { id: input.bankAccountId }, data: { currentBalance: balance } });

      return { imported, total: rows.length };
    }),

  // ─── Rules ─────────────────────────────────────────────────────

  listRules: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.reconciliationRule.findMany({ orderBy: { timesMatched: "desc" } });
  }),

  createRule: publicProcedure
    .input(z.object({
      name: z.string().min(1), matchType: z.enum(MATCH_TYPE_ENUM), matchValue: z.string().min(1),
      tolerance: z.number().optional(), targetAccountId: z.string().optional(), targetCategory: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.reconciliationRule.create({ data: input })),

  updateRule: publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), matchValue: z.string().optional(), tolerance: z.number().optional().nullable(), targetAccountId: z.string().optional().nullable(), targetCategory: z.string().optional().nullable(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => { const { id, ...data } = input; return ctx.db.reconciliationRule.update({ where: { id }, data }); }),

  deleteRule: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.reconciliationRule.delete({ where: { id: input.id } })),

  // ─── Bank Feed ─────────────────────────────────────────────────

  getFeed: publicProcedure
    .input(z.object({ bankAccountId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.bankFeed.findUnique({ where: { bankAccountId: input.bankAccountId } });
    }),

  updateFeed: publicProcedure
    .input(z.object({ bankAccountId: z.string(), provider: z.string().optional(), csvFormat: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { bankAccountId, ...data } = input;
      return ctx.db.bankFeed.upsert({
        where: { bankAccountId },
        create: { bankAccountId, ...data },
        update: data,
      });
    }),

  // ─── Anomaly Detection ─────────────────────────────────────────

  detectAnomalies: publicProcedure
    .input(z.object({ bankAccountId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const transactions = await ctx.db.bankTransaction.findMany({
        where: { bankAccountId: input.bankAccountId },
        orderBy: { date: "desc" },
        take: 100,
      });

      const amounts = transactions.map((t) => Math.abs(Number(t.amount)));
      const avg = amounts.length > 0 ? amounts.reduce((s, a) => s + a, 0) / amounts.length : 0;

      return detectAnomalies(
        transactions.map((t) => ({ date: t.date.toISOString().split("T")[0], amount: Number(t.amount), description: t.description })),
        {
          avgMonthlySpend: avg * 30,
          commonVendors: Array.from(new Set(transactions.map((t) => t.payee).filter(Boolean) as string[])).slice(0, 20),
          typicalAmounts: { min: Math.min(...amounts, 0), max: Math.max(...amounts, 0), avg },
        }
      );
    }),

  // ─── Smart Reconciliation ──────────────────────────────────────

  smartReconcile: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.reconciliationSession.findUniqueOrThrow({ where: { id: input.sessionId } });
      const allTx = await ctx.db.bankTransaction.findMany({ where: { bankAccountId: session.bankAccountId } });
      const unreconciled = allTx.filter((t) => !t.isReconciled);

      // Step 1: Apply rules
      const rules = await ctx.db.reconciliationRule.findMany({ where: { isActive: true } });
      let ruleMatched = 0;
      for (const tx of unreconciled) {
        for (const rule of rules) {
          let matched = false;
          switch (rule.matchType) {
            case "EXACT_AMOUNT":
              matched = Math.abs(Number(tx.amount)) === parseFloat(rule.matchValue);
              break;
            case "AMOUNT_RANGE":
              const target = parseFloat(rule.matchValue);
              const tol = Number(rule.tolerance || 0);
              matched = Math.abs(Number(tx.amount)) >= target - tol && Math.abs(Number(tx.amount)) <= target + tol;
              break;
            case "DESCRIPTION_CONTAINS":
              matched = tx.description.toLowerCase().includes(rule.matchValue.toLowerCase());
              break;
            case "VENDOR_MATCH":
              matched = (tx.payee || "").toLowerCase().includes(rule.matchValue.toLowerCase());
              break;
            case "REGEX":
              try { matched = new RegExp(rule.matchValue, "i").test(tx.description); } catch {}
              break;
          }

          if (matched) {
            await ctx.db.reconciliationMatch.create({
              data: {
                sessionId: input.sessionId,
                bankTransactionId: tx.id,
                matchType: "AUTO_RULE",
                confidence: 85,
                isConfirmed: false,
              },
            });
            if (rule.targetCategory) {
              await ctx.db.bankTransaction.update({ where: { id: tx.id }, data: { category: rule.targetCategory } });
            }
            await ctx.db.reconciliationRule.update({ where: { id: rule.id }, data: { timesMatched: { increment: 1 } } });
            ruleMatched++;
            break;
          }
        }
      }

      // Step 2: AI auto-match remaining
      const stillUnmatched = await ctx.db.bankTransaction.findMany({
        where: {
          bankAccountId: session.bankAccountId,
          isReconciled: false,
          reconciliationMatches: { none: { sessionId: input.sessionId } },
        },
      });

      let autoMatched = 0;
      if (stillUnmatched.length > 0) {
        const thirtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        const invoices = await ctx.db.invoice.findMany({ where: { issueDate: { gte: thirtyDaysAgo } }, include: { matter: { include: { client: true } } }, take: 50 });
        const payments = await ctx.db.payment.findMany({ where: { paymentDate: { gte: thirtyDaysAgo } }, take: 50 });
        const expenses = await ctx.db.expense.findMany({ where: { date: { gte: thirtyDaysAgo } }, take: 50 });

        try {
          const aiMatches = await autoMatchTransactions(
            stillUnmatched.map((t) => ({ id: t.id, date: t.date.toISOString().split("T")[0], amount: Number(t.amount), description: t.description, payee: t.payee || undefined })),
            {
              invoices: invoices.map((i) => ({ id: i.id, number: i.invoiceNumber, total: Number(i.total), date: i.issueDate.toISOString().split("T")[0], clientName: i.matter?.client?.name })),
              payments: payments.map((p) => ({ id: p.id, amount: Number(p.amount), date: p.paymentDate.toISOString().split("T")[0], method: p.paymentMethod, reference: p.reference || undefined })),
              expenses: expenses.map((e) => ({ id: e.id, amount: Number(e.amount), date: e.date.toISOString().split("T")[0], vendorName: e.vendorName, description: e.description })),
              trustTransactions: [],
            }
          );

          for (const m of aiMatches) {
            if (m.confidence > 40 && m.matchedType) {
              await ctx.db.reconciliationMatch.create({
                data: {
                  sessionId: input.sessionId,
                  bankTransactionId: m.bankTransactionId,
                  matchedEntityType: m.matchedType,
                  matchedEntityId: m.matchedId,
                  matchType: m.confidence >= 90 ? "AUTO_EXACT" : "AUTO_FUZZY",
                  confidence: m.confidence,
                },
              });
              autoMatched++;
            }
          }
        } catch (err) {
          console.error("[Smart Reconcile] AI matching error:", err);
        }
      }

      const totalMatches = await ctx.db.reconciliationMatch.count({ where: { sessionId: input.sessionId } });
      const unmatchedCount = allTx.filter((t) => !t.isReconciled).length - totalMatches;

      return {
        totalTransactions: allTx.length,
        autoMatched,
        ruleMatched,
        unmatched: Math.max(0, unmatchedCount),
        anomalies: 0,
      };
    }),

  getReconciliationSummary: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const matches = await ctx.db.reconciliationMatch.findMany({
        where: { sessionId: input.sessionId },
        include: { bankTransaction: true },
      });

      const confirmed = matches.filter((m) => m.isConfirmed);
      const pending = matches.filter((m) => !m.isConfirmed);
      const highConf = matches.filter((m) => Number(m.confidence) >= 90 && !m.isConfirmed);

      return {
        totalMatches: matches.length,
        confirmed: confirmed.length,
        pending: pending.length,
        highConfidence: highConf.length,
        byType: {
          autoExact: matches.filter((m) => m.matchType === "AUTO_EXACT").length,
          autoFuzzy: matches.filter((m) => m.matchType === "AUTO_FUZZY").length,
          autoRule: matches.filter((m) => m.matchType === "AUTO_RULE").length,
          manual: matches.filter((m) => m.matchType === "MANUAL").length,
        },
        confirmedTotal: confirmed.reduce((s, m) => s + Math.abs(Number(m.bankTransaction.amount)), 0),
      };
    }),

  // ─── Hub Stats ─────────────────────────────────────────────────

  getHubStats: publicProcedure.query(async ({ ctx }) => {
    const bankAccounts = await ctx.db.bankAccount.findMany({ where: { isActive: true } });
    const unreconciled = await ctx.db.bankTransaction.count({ where: { isReconciled: false } });
    const lastSession = await ctx.db.reconciliationSession.findFirst({ where: { status: "COMPLETED" }, orderBy: { completedAt: "desc" } });
    const totalSessions = await ctx.db.reconciliationSession.count({ where: { status: "COMPLETED" } });
    const totalMatches = await ctx.db.reconciliationMatch.count({ where: { isConfirmed: true } });

    return {
      accountsToReconcile: bankAccounts.length,
      unreconciledCount: unreconciled,
      lastReconciliation: lastSession?.completedAt,
      lastAccountId: lastSession?.bankAccountId,
      autoMatchRate: totalMatches > 0 ? 85 : 0, // placeholder
    };
  }),
});
