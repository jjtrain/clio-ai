import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { Decimal } from "@prisma/client/runtime/library";

// Helper to create audit log entry
async function createAuditLog(
  db: any,
  data: {
    trustAccountId: string;
    trustLedgerId?: string;
    action: string;
    entityType: string;
    entityId: string;
    previousValue?: any;
    newValue?: any;
    userId?: string;
  }
) {
  await db.trustAuditLog.create({
    data: {
      trustAccountId: data.trustAccountId,
      trustLedgerId: data.trustLedgerId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      previousValue: data.previousValue ? JSON.stringify(data.previousValue) : null,
      newValue: data.newValue ? JSON.stringify(data.newValue) : null,
      userId: data.userId,
    },
  });
}

export const trustRouter = router({
  // Trust Account Management
  listAccounts: publicProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.db.trustAccount.findMany({
      include: {
        _count: {
          select: { ledgers: true, transactions: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // Calculate book balance for each account
    const accountsWithBookBalance = await Promise.all(
      accounts.map(async (account) => {
        const ledgers = await ctx.db.trustLedger.findMany({
          where: { trustAccountId: account.id },
        });
        const bookBalance = ledgers.reduce(
          (sum, l) => sum.add(new Decimal(l.balance.toString())),
          new Decimal(0)
        );
        return {
          ...account,
          bookBalance: bookBalance.toNumber(),
        };
      })
    );

    return accountsWithBookBalance;
  }),

  getAccount: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const account = await ctx.db.trustAccount.findUnique({
        where: { id: input.id },
        include: {
          ledgers: {
            include: {
              client: true,
              matter: true,
            },
            orderBy: { updatedAt: "desc" },
          },
        },
      });

      if (!account) throw new Error("Trust account not found");

      // Calculate book balance
      const bookBalance = account.ledgers.reduce(
        (sum, l) => sum.add(new Decimal(l.balance.toString())),
        new Decimal(0)
      );

      return {
        ...account,
        bookBalance: bookBalance.toNumber(),
      };
    }),

  createAccount: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        accountNumber: z.string().min(1),
        bankName: z.string().min(1),
        routingNumber: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.trustAccount.create({
        data: input,
      });
    }),

  updateAccount: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        bankName: z.string().min(1).optional(),
        routingNumber: z.string().optional(),
        description: z.string().optional(),
        isActive: z.boolean().optional(),
        bankBalance: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, bankBalance, ...data } = input;
      return ctx.db.trustAccount.update({
        where: { id },
        data: {
          ...data,
          ...(bankBalance !== undefined && { bankBalance: new Decimal(bankBalance) }),
          ...(bankBalance !== undefined && { lastReconciledAt: new Date(), lastReconciledBalance: new Decimal(bankBalance) }),
        },
      });
    }),

  // Client Trust Ledgers
  listLedgers: publicProcedure
    .input(
      z.object({
        trustAccountId: z.string().optional(),
        clientId: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.trustAccountId) where.trustAccountId = input.trustAccountId;
      if (input.clientId) where.clientId = input.clientId;

      return ctx.db.trustLedger.findMany({
        where,
        include: {
          client: true,
          matter: true,
          trustAccount: true,
        },
        orderBy: { updatedAt: "desc" },
      });
    }),

  getLedger: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const ledger = await ctx.db.trustLedger.findUnique({
        where: { id: input.id },
        include: {
          client: true,
          matter: true,
          trustAccount: true,
          transactions: {
            orderBy: { transactionDate: "desc" },
          },
        },
      });

      if (!ledger) throw new Error("Trust ledger not found");
      return ledger;
    }),

  getOrCreateLedger: publicProcedure
    .input(
      z.object({
        trustAccountId: z.string(),
        clientId: z.string(),
        matterId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.trustLedger.findFirst({
        where: {
          trustAccountId: input.trustAccountId,
          clientId: input.clientId,
          matterId: input.matterId || null,
        },
      });

      if (existing) return existing;

      return ctx.db.trustLedger.create({
        data: {
          trustAccountId: input.trustAccountId,
          clientId: input.clientId,
          matterId: input.matterId,
        },
      });
    }),

  // Trust Transactions
  listTransactions: publicProcedure
    .input(
      z.object({
        trustAccountId: z.string().optional(),
        trustLedgerId: z.string().optional(),
        clientId: z.string().optional(),
        type: z.enum(["DEPOSIT", "WITHDRAWAL", "TRANSFER_IN", "TRANSFER_OUT", "INTEREST", "BANK_FEE", "VOID_REVERSAL"]).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        includeVoided: z.boolean().optional().default(false),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.trustAccountId) where.trustAccountId = input.trustAccountId;
      if (input.trustLedgerId) where.trustLedgerId = input.trustLedgerId;
      if (input.type) where.type = input.type;
      if (input.clientId) {
        where.trustLedger = { clientId: input.clientId };
      }
      if (input.startDate || input.endDate) {
        where.transactionDate = {};
        if (input.startDate) where.transactionDate.gte = new Date(input.startDate);
        if (input.endDate) where.transactionDate.lte = new Date(input.endDate);
      }
      // By default, exclude voided transactions for cleaner view
      if (!input.includeVoided) {
        where.isVoided = false;
      }

      const transactions = await ctx.db.trustTransaction.findMany({
        where,
        include: {
          trustLedger: {
            include: {
              client: true,
              matter: true,
            },
          },
          trustAccount: true,
          enteredBy: { select: { id: true, name: true, email: true } },
          voidedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: [
          { transactionDate: "desc" },
          { transactionNumber: "desc" },
        ],
        take: input.limit,
        skip: input.offset,
      });

      const count = await ctx.db.trustTransaction.count({ where });

      return { transactions, count };
    }),

  createTransaction: publicProcedure
    .input(
      z.object({
        trustAccountId: z.string(),
        clientId: z.string(),
        matterId: z.string().optional(),
        type: z.enum(["DEPOSIT", "WITHDRAWAL", "TRANSFER_IN", "TRANSFER_OUT", "INTEREST", "BANK_FEE"]),
        amount: z.number().min(0.01),
        description: z.string().min(1),
        reference: z.string().optional(),
        payee: z.string().optional(),
        payor: z.string().optional(),
        checkNumber: z.string().optional(),
        source: z.enum(["WIRE_TRANSFER", "CHECK", "CASH", "ACH", "CREDIT_CARD", "MONEY_ORDER", "CASHIERS_CHECK", "INTERNAL_TRANSFER", "OTHER"]).optional(),
        transactionDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Use transaction for atomicity - critical for financial data
      return await ctx.db.$transaction(async (tx) => {
        // Get or create ledger
        let ledger = await tx.trustLedger.findFirst({
          where: {
            trustAccountId: input.trustAccountId,
            clientId: input.clientId,
            matterId: input.matterId || null,
          },
        });

        if (!ledger) {
          ledger = await tx.trustLedger.create({
            data: {
              trustAccountId: input.trustAccountId,
              clientId: input.clientId,
              matterId: input.matterId,
            },
          });
        }

        const currentBalance = new Decimal(ledger.balance.toString());
        const amount = new Decimal(input.amount);
        let newBalance: Decimal;

        // Calculate new balance based on transaction type
        if (["DEPOSIT", "TRANSFER_IN", "INTEREST"].includes(input.type)) {
          newBalance = currentBalance.add(amount);
        } else {
          // WITHDRAWAL, TRANSFER_OUT, BANK_FEE
          newBalance = currentBalance.sub(amount);

          // Prevent overdraft - CRITICAL for trust accounting compliance
          if (newBalance.lessThan(0)) {
            throw new Error(
              `Insufficient funds. Available balance: $${currentBalance.toFixed(2)}. Attempted: $${amount.toFixed(2)}. ` +
              `Trust accounts cannot have negative balances per bar rules.`
            );
          }
        }

        // Get and increment transaction number atomically
        const account = await tx.trustAccount.update({
          where: { id: input.trustAccountId },
          data: { nextTransactionNumber: { increment: 1 } },
        });
        const transactionNumber = account.nextTransactionNumber - 1;

        // Create transaction with full audit trail
        const transaction = await tx.trustTransaction.create({
          data: {
            transactionNumber,
            trustAccountId: input.trustAccountId,
            trustLedgerId: ledger.id,
            type: input.type,
            amount: amount,
            runningBalance: newBalance,
            description: input.description,
            reference: input.reference,
            payee: input.payee,
            payor: input.payor,
            checkNumber: input.checkNumber,
            source: input.source,
            transactionDate: input.transactionDate ? new Date(input.transactionDate) : new Date(),
            // enteredById would be set from session in production
          },
        });

        // Update ledger balance
        const previousLedgerBalance = ledger.balance;
        await tx.trustLedger.update({
          where: { id: ledger.id },
          data: { balance: newBalance },
        });

        // Create audit log entry
        await tx.trustAuditLog.create({
          data: {
            trustAccountId: input.trustAccountId,
            trustLedgerId: ledger.id,
            action: "TRANSACTION_CREATED",
            entityType: "TrustTransaction",
            entityId: transaction.id,
            previousValue: JSON.stringify({ ledgerBalance: previousLedgerBalance.toString() }),
            newValue: JSON.stringify({
              transactionNumber,
              type: input.type,
              amount: amount.toString(),
              newLedgerBalance: newBalance.toString(),
              clientId: input.clientId,
              matterId: input.matterId,
            }),
          },
        });

        return transaction;
      });
    }),

  // Transfer between client ledgers - atomic operation with full audit trail
  transfer: publicProcedure
    .input(
      z.object({
        trustAccountId: z.string(),
        fromClientId: z.string(),
        fromMatterId: z.string().optional(),
        toClientId: z.string(),
        toMatterId: z.string().optional(),
        amount: z.number().min(0.01),
        description: z.string().min(1),
        reference: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.$transaction(async (tx) => {
        // Get source ledger
        const fromLedger = await tx.trustLedger.findFirst({
          where: {
            trustAccountId: input.trustAccountId,
            clientId: input.fromClientId,
            matterId: input.fromMatterId || null,
          },
        });

        if (!fromLedger) throw new Error("Source ledger not found");

        const fromBalance = new Decimal(fromLedger.balance.toString());
        const amount = new Decimal(input.amount);

        if (fromBalance.lessThan(amount)) {
          throw new Error(
            `Insufficient funds. Available: $${fromBalance.toFixed(2)}. Attempted: $${amount.toFixed(2)}. ` +
            `Trust accounts cannot have negative balances per bar rules.`
          );
        }

        // Get or create destination ledger
        let toLedger = await tx.trustLedger.findFirst({
          where: {
            trustAccountId: input.trustAccountId,
            clientId: input.toClientId,
            matterId: input.toMatterId || null,
          },
        });

        if (!toLedger) {
          toLedger = await tx.trustLedger.create({
            data: {
              trustAccountId: input.trustAccountId,
              clientId: input.toClientId,
              matterId: input.toMatterId,
            },
          });
        }

        const toBalance = new Decimal(toLedger.balance.toString());
        const newFromBalance = fromBalance.sub(amount);
        const newToBalance = toBalance.add(amount);

        // Get transaction numbers atomically
        const account = await tx.trustAccount.update({
          where: { id: input.trustAccountId },
          data: { nextTransactionNumber: { increment: 2 } },
        });
        const txNumOut = account.nextTransactionNumber - 2;
        const txNumIn = account.nextTransactionNumber - 1;

        // Create transfer out transaction
        const transferOut = await tx.trustTransaction.create({
          data: {
            transactionNumber: txNumOut,
            trustAccountId: input.trustAccountId,
            trustLedgerId: fromLedger.id,
            type: "TRANSFER_OUT",
            amount: amount,
            runningBalance: newFromBalance,
            description: input.description,
            reference: input.reference,
            source: "INTERNAL_TRANSFER",
          },
        });

        // Create transfer in transaction
        const transferIn = await tx.trustTransaction.create({
          data: {
            transactionNumber: txNumIn,
            trustAccountId: input.trustAccountId,
            trustLedgerId: toLedger.id,
            type: "TRANSFER_IN",
            amount: amount,
            runningBalance: newToBalance,
            description: input.description,
            reference: input.reference,
            source: "INTERNAL_TRANSFER",
          },
        });

        // Update balances
        await tx.trustLedger.update({
          where: { id: fromLedger.id },
          data: { balance: newFromBalance },
        });

        await tx.trustLedger.update({
          where: { id: toLedger.id },
          data: { balance: newToBalance },
        });

        // Create audit log entries for both sides of transfer
        await tx.trustAuditLog.create({
          data: {
            trustAccountId: input.trustAccountId,
            trustLedgerId: fromLedger.id,
            action: "TRANSFER_OUT",
            entityType: "TrustTransaction",
            entityId: transferOut.id,
            newValue: JSON.stringify({
              transactionNumber: txNumOut,
              amount: amount.toString(),
              toClientId: input.toClientId,
              toMatterId: input.toMatterId,
              relatedTransactionId: transferIn.id,
            }),
          },
        });

        await tx.trustAuditLog.create({
          data: {
            trustAccountId: input.trustAccountId,
            trustLedgerId: toLedger.id,
            action: "TRANSFER_IN",
            entityType: "TrustTransaction",
            entityId: transferIn.id,
            newValue: JSON.stringify({
              transactionNumber: txNumIn,
              amount: amount.toString(),
              fromClientId: input.fromClientId,
              fromMatterId: input.fromMatterId,
              relatedTransactionId: transferOut.id,
            }),
          },
        });

        return { success: true, transferOut, transferIn };
      });
    }),

  // Void a transaction (transactions are NEVER deleted - bar ethics requirement)
  voidTransaction: publicProcedure
    .input(
      z.object({
        transactionId: z.string(),
        reason: z.string().min(1, "Void reason is required for audit trail"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await ctx.db.$transaction(async (tx) => {
        // Get the original transaction
        const original = await tx.trustTransaction.findUnique({
          where: { id: input.transactionId },
          include: { trustLedger: true },
        });

        if (!original) throw new Error("Transaction not found");
        if (original.isVoided) throw new Error("Transaction is already voided");

        const amount = new Decimal(original.amount.toString());
        const currentBalance = new Decimal(original.trustLedger.balance.toString());
        let newBalance: Decimal;

        // Reverse the effect on balance
        if (["DEPOSIT", "TRANSFER_IN", "INTEREST"].includes(original.type)) {
          // Original added funds, so we subtract
          newBalance = currentBalance.sub(amount);
          if (newBalance.lessThan(0)) {
            throw new Error(
              `Cannot void: would result in negative balance. ` +
              `Current balance: $${currentBalance.toFixed(2)}, Amount to reverse: $${amount.toFixed(2)}`
            );
          }
        } else {
          // Original subtracted funds, so we add back
          newBalance = currentBalance.add(amount);
        }

        // Get next transaction number for reversal entry
        const account = await tx.trustAccount.update({
          where: { id: original.trustAccountId },
          data: { nextTransactionNumber: { increment: 1 } },
        });
        const reversalTxNum = account.nextTransactionNumber - 1;

        // Create reversal transaction
        const reversalTx = await tx.trustTransaction.create({
          data: {
            transactionNumber: reversalTxNum,
            trustAccountId: original.trustAccountId,
            trustLedgerId: original.trustLedgerId,
            type: "VOID_REVERSAL",
            amount: amount,
            runningBalance: newBalance,
            description: `VOID: ${original.description} - Reason: ${input.reason}`,
            reference: `Voiding TX #${original.transactionNumber}`,
          },
        });

        // Mark original as voided
        await tx.trustTransaction.update({
          where: { id: original.id },
          data: {
            isVoided: true,
            voidedAt: new Date(),
            voidReason: input.reason,
            voidingTransactionId: reversalTx.id,
          },
        });

        // Update ledger balance
        await tx.trustLedger.update({
          where: { id: original.trustLedgerId },
          data: { balance: newBalance },
        });

        // Create audit log
        await tx.trustAuditLog.create({
          data: {
            trustAccountId: original.trustAccountId,
            trustLedgerId: original.trustLedgerId,
            action: "TRANSACTION_VOIDED",
            entityType: "TrustTransaction",
            entityId: original.id,
            previousValue: JSON.stringify({
              transactionNumber: original.transactionNumber,
              type: original.type,
              amount: amount.toString(),
              ledgerBalance: currentBalance.toString(),
            }),
            newValue: JSON.stringify({
              reversalTransactionId: reversalTx.id,
              reversalTransactionNumber: reversalTxNum,
              voidReason: input.reason,
              newLedgerBalance: newBalance.toString(),
            }),
          },
        });

        return { success: true, reversalTransaction: reversalTx };
      });
    }),

  // Reconciliation
  getReconciliation: publicProcedure
    .input(z.object({ trustAccountId: z.string() }))
    .query(async ({ ctx, input }) => {
      const account = await ctx.db.trustAccount.findUnique({
        where: { id: input.trustAccountId },
        include: {
          ledgers: {
            include: {
              client: true,
              matter: true,
            },
          },
        },
      });

      if (!account) throw new Error("Trust account not found");

      // Calculate book balance (sum of all client ledger balances)
      const bookBalance = account.ledgers.reduce(
        (sum, l) => sum.add(new Decimal(l.balance.toString())),
        new Decimal(0)
      );

      // Get uncleared transactions (excluding voided ones)
      const unclearedTransactions = await ctx.db.trustTransaction.findMany({
        where: {
          trustAccountId: input.trustAccountId,
          isCleared: false,
          isVoided: false, // Don't include voided transactions in reconciliation
        },
        include: {
          trustLedger: {
            include: { client: true },
          },
        },
        orderBy: [{ transactionDate: "asc" }, { transactionNumber: "asc" }],
      });

      // Calculate adjusted bank balance
      let unclearedDeposits = new Decimal(0);
      let unclearedWithdrawals = new Decimal(0);

      for (const tx of unclearedTransactions) {
        if (["DEPOSIT", "TRANSFER_IN", "INTEREST"].includes(tx.type)) {
          unclearedDeposits = unclearedDeposits.add(new Decimal(tx.amount.toString()));
        } else {
          unclearedWithdrawals = unclearedWithdrawals.add(new Decimal(tx.amount.toString()));
        }
      }

      const bankBalance = new Decimal(account.bankBalance.toString());
      const adjustedBankBalance = bankBalance.sub(unclearedDeposits).add(unclearedWithdrawals);
      const difference = bookBalance.sub(adjustedBankBalance);

      return {
        account,
        bankBalance: bankBalance.toNumber(),
        bookBalance: bookBalance.toNumber(),
        clientLedgerTotal: bookBalance.toNumber(),
        unclearedDeposits: unclearedDeposits.toNumber(),
        unclearedWithdrawals: unclearedWithdrawals.toNumber(),
        adjustedBankBalance: adjustedBankBalance.toNumber(),
        difference: difference.toNumber(),
        isReconciled: difference.equals(0),
        ledgers: account.ledgers,
        unclearedTransactions,
      };
    }),

  markTransactionCleared: publicProcedure
    .input(
      z.object({
        id: z.string(),
        isCleared: z.boolean(),
        clearedDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.trustTransaction.update({
        where: { id: input.id },
        data: {
          isCleared: input.isCleared,
          clearedDate: input.isCleared ? (input.clearedDate ? new Date(input.clearedDate) : new Date()) : null,
        },
      });
    }),

  // Summary for dashboard
  summary: publicProcedure.query(async ({ ctx }) => {
    const accounts = await ctx.db.trustAccount.findMany({
      where: { isActive: true },
      include: {
        ledgers: true,
      },
    });

    let totalTrustFunds = new Decimal(0);
    let totalClients = 0;

    for (const account of accounts) {
      for (const ledger of account.ledgers) {
        totalTrustFunds = totalTrustFunds.add(new Decimal(ledger.balance.toString()));
      }
      totalClients += account.ledgers.length;
    }

    return {
      totalTrustFunds: totalTrustFunds.toNumber(),
      accountCount: accounts.length,
      clientLedgerCount: totalClients,
    };
  }),

  // Client ledger statement
  getClientStatement: publicProcedure
    .input(
      z.object({
        trustLedgerId: z.string(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const ledger = await ctx.db.trustLedger.findUnique({
        where: { id: input.trustLedgerId },
        include: {
          client: true,
          matter: true,
          trustAccount: true,
        },
      });

      if (!ledger) throw new Error("Ledger not found");

      const where: any = { trustLedgerId: input.trustLedgerId };
      if (input.startDate || input.endDate) {
        where.transactionDate = {};
        if (input.startDate) where.transactionDate.gte = new Date(input.startDate);
        if (input.endDate) where.transactionDate.lte = new Date(input.endDate);
      }

      const transactions = await ctx.db.trustTransaction.findMany({
        where,
        orderBy: { transactionDate: "asc" },
      });

      // Calculate totals
      let totalDeposits = new Decimal(0);
      let totalWithdrawals = new Decimal(0);

      for (const tx of transactions) {
        if (["DEPOSIT", "TRANSFER_IN", "INTEREST"].includes(tx.type)) {
          totalDeposits = totalDeposits.add(new Decimal(tx.amount.toString()));
        } else {
          totalWithdrawals = totalWithdrawals.add(new Decimal(tx.amount.toString()));
        }
      }

      // Calculate opening balance if date filter
      let openingBalance = new Decimal(0);
      if (input.startDate) {
        const priorTransactions = await ctx.db.trustTransaction.findMany({
          where: {
            trustLedgerId: input.trustLedgerId,
            transactionDate: { lt: new Date(input.startDate) },
          },
        });

        for (const tx of priorTransactions) {
          if (["DEPOSIT", "TRANSFER_IN", "INTEREST"].includes(tx.type)) {
            openingBalance = openingBalance.add(new Decimal(tx.amount.toString()));
          } else {
            openingBalance = openingBalance.sub(new Decimal(tx.amount.toString()));
          }
        }
      }

      return {
        ledger,
        client: ledger.client,
        matter: ledger.matter,
        trustAccount: ledger.trustAccount,
        transactions,
        totalDeposits: totalDeposits.toNumber(),
        totalWithdrawals: totalWithdrawals.toNumber(),
        openingBalance: openingBalance.toNumber(),
        closingBalance: parseFloat(ledger.balance.toString()),
      };
    }),

  // Audit log - immutable record of all trust account activity
  getAuditLog: publicProcedure
    .input(
      z.object({
        trustAccountId: z.string(),
        trustLedgerId: z.string().optional(),
        action: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().min(1).max(500).optional().default(100),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = { trustAccountId: input.trustAccountId };
      if (input.trustLedgerId) where.trustLedgerId = input.trustLedgerId;
      if (input.action) where.action = input.action;
      if (input.startDate || input.endDate) {
        where.timestamp = {};
        if (input.startDate) where.timestamp.gte = new Date(input.startDate);
        if (input.endDate) where.timestamp.lte = new Date(input.endDate);
      }

      const logs = await ctx.db.trustAuditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { timestamp: "desc" },
        take: input.limit,
        skip: input.offset,
      });

      const count = await ctx.db.trustAuditLog.count({ where });

      return { logs, count };
    }),

  // Get a single transaction with full details for audit purposes
  getTransaction: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const transaction = await ctx.db.trustTransaction.findUnique({
        where: { id: input.id },
        include: {
          trustAccount: true,
          trustLedger: {
            include: {
              client: true,
              matter: true,
            },
          },
          enteredBy: { select: { id: true, name: true, email: true } },
          voidedBy: { select: { id: true, name: true, email: true } },
          voidingTransaction: true,
          voidedTransaction: true,
        },
      });

      if (!transaction) throw new Error("Transaction not found");

      return transaction;
    }),
});
