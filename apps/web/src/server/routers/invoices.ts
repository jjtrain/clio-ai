import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { Decimal } from "@prisma/client/runtime/library";
import {
  isHelcimConfigured,
  initializeCheckout,
  verifyTransactionResponse,
} from "@/lib/helcim";

export const invoicesRouter = router({
  list: publicProcedure
    .input(
      z.object({
        status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]).optional(),
        matterId: z.string().optional(),
        limit: z.number().min(1).max(100).optional().default(50),
        offset: z.number().min(0).optional().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.status) where.status = input.status;
      if (input.matterId) where.matterId = input.matterId;

      const invoices = await ctx.db.invoice.findMany({
        where,
        include: {
          matter: {
            include: {
              client: true,
            },
          },
          _count: {
            select: { payments: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
        skip: input.offset,
      });

      return { invoices };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUnique({
        where: { id: input.id },
        include: {
          matter: {
            include: {
              client: true,
            },
          },
          lineItems: {
            include: {
              timeEntries: true,
            },
            orderBy: { date: "asc" },
          },
          payments: {
            orderBy: { paymentDate: "desc" },
          },
        },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      return invoice;
    }),

  getUnbilledTimeEntries: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const timeEntries = await ctx.db.timeEntry.findMany({
        where: {
          matterId: input.matterId,
          billable: true,
          invoiceLineItemId: null,
        },
        include: {
          user: true,
        },
        orderBy: { date: "asc" },
      });

      return timeEntries;
    }),

  create: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        timeEntryIds: z.array(z.string()),
        dueDate: z.string(),
        taxRate: z.number().min(0).max(100).optional().default(0),
        notes: z.string().optional(),
        defaultRate: z.number().min(0).optional().default(450),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get the time entries
      const timeEntries = await ctx.db.timeEntry.findMany({
        where: {
          id: { in: input.timeEntryIds },
          billable: true,
          invoiceLineItemId: null,
        },
        include: {
          user: true,
        },
      });

      if (timeEntries.length === 0) {
        throw new Error("No billable time entries selected");
      }

      // Generate invoice number
      const lastInvoice = await ctx.db.invoice.findFirst({
        orderBy: { invoiceNumber: "desc" },
      });
      const nextNumber = lastInvoice
        ? parseInt(lastInvoice.invoiceNumber.replace("INV-", "")) + 1
        : 1001;
      const invoiceNumber = `INV-${nextNumber}`;

      // Calculate totals
      let subtotal = new Decimal(0);
      const lineItemsData: {
        description: string;
        quantity: Decimal;
        rate: Decimal;
        amount: Decimal;
        date: Date;
        timeEntryIds: string[];
      }[] = [];

      for (const entry of timeEntries) {
        const hours = new Decimal(entry.duration).div(60);
        const rate = entry.rate ? new Decimal(entry.rate.toString()) : new Decimal(input.defaultRate);
        const amount = hours.mul(rate);
        subtotal = subtotal.add(amount);

        lineItemsData.push({
          description: entry.description,
          quantity: hours,
          rate: rate,
          amount: amount,
          date: entry.date,
          timeEntryIds: [entry.id],
        });
      }

      const taxRate = new Decimal(input.taxRate);
      const taxAmount = subtotal.mul(taxRate).div(100);
      const total = subtotal.add(taxAmount);

      // Create invoice with line items
      const invoice = await ctx.db.invoice.create({
        data: {
          invoiceNumber,
          matterId: input.matterId,
          dueDate: new Date(input.dueDate),
          subtotal,
          taxRate,
          taxAmount,
          total,
          notes: input.notes,
          lineItems: {
            create: lineItemsData.map((item) => ({
              description: item.description,
              quantity: item.quantity,
              rate: item.rate,
              amount: item.amount,
              date: item.date,
            })),
          },
        },
        include: {
          lineItems: true,
        },
      });

      // Link time entries to line items
      for (let i = 0; i < lineItemsData.length; i++) {
        await ctx.db.timeEntry.updateMany({
          where: { id: { in: lineItemsData[i].timeEntryIds } },
          data: { invoiceLineItemId: invoice.lineItems[i].id },
        });
      }

      return invoice;
    }),

  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["DRAFT", "SENT", "PAID", "OVERDUE", "CANCELLED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: any = { status: input.status };

      if (input.status === "SENT") {
        updateData.sentAt = new Date();
      } else if (input.status === "PAID") {
        updateData.paidAt = new Date();
      }

      const invoice = await ctx.db.invoice.update({
        where: { id: input.id },
        data: updateData,
      });

      return invoice;
    }),

  addPayment: publicProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        amount: z.number().min(0.01),
        paymentDate: z.string(),
        paymentMethod: z.enum(["CASH", "CHECK", "CREDIT_CARD", "BANK_TRANSFER", "OTHER"]),
        reference: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUnique({
        where: { id: input.invoiceId },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      const payment = await ctx.db.payment.create({
        data: {
          invoiceId: input.invoiceId,
          amount: new Decimal(input.amount),
          paymentDate: new Date(input.paymentDate),
          paymentMethod: input.paymentMethod,
          reference: input.reference,
          notes: input.notes,
        },
      });

      // Update invoice amount paid
      const newAmountPaid = new Decimal(invoice.amountPaid.toString()).add(input.amount);
      const total = new Decimal(invoice.total.toString());

      await ctx.db.invoice.update({
        where: { id: input.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          status: newAmountPaid.gte(total) ? "PAID" : invoice.status,
          paidAt: newAmountPaid.gte(total) ? new Date() : invoice.paidAt,
        },
      });

      return payment;
    }),

  summary: publicProcedure.query(async ({ ctx }) => {
    const invoices = await ctx.db.invoice.findMany({
      where: {
        status: { in: ["SENT", "OVERDUE"] },
      },
    });

    let totalOutstanding = new Decimal(0);
    let totalOverdue = new Decimal(0);

    for (const inv of invoices) {
      const balance = new Decimal(inv.total.toString()).sub(inv.amountPaid.toString());
      totalOutstanding = totalOutstanding.add(balance);
      if (inv.status === "OVERDUE") {
        totalOverdue = totalOverdue.add(balance);
      }
    }

    const draftCount = await ctx.db.invoice.count({ where: { status: "DRAFT" } });
    const sentCount = await ctx.db.invoice.count({ where: { status: "SENT" } });
    const overdueCount = await ctx.db.invoice.count({ where: { status: "OVERDUE" } });

    return {
      totalOutstanding: totalOutstanding.toNumber(),
      totalOverdue: totalOverdue.toNumber(),
      draftCount,
      sentCount,
      overdueCount,
    };
  }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // First, unlink all time entries
      await ctx.db.timeEntry.updateMany({
        where: {
          invoiceLineItem: {
            invoiceId: input.id,
          },
        },
        data: { invoiceLineItemId: null },
      });

      // Then delete the invoice (cascade will delete line items and payments)
      await ctx.db.invoice.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  helcimEnabled: publicProcedure.query(() => {
    return { enabled: isHelcimConfigured() };
  }),

  initializeHelcimCheckout: publicProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUnique({
        where: { id: input.invoiceId },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      if (invoice.status !== "SENT" && invoice.status !== "OVERDUE") {
        throw new Error("Invoice must be in SENT or OVERDUE status to pay online");
      }

      const balance = new Decimal(invoice.total.toString()).sub(
        invoice.amountPaid.toString()
      );

      if (balance.lte(0)) {
        throw new Error("Invoice has no remaining balance");
      }

      const result = await initializeCheckout({
        amount: balance.toNumber(),
        invoiceNumber: invoice.invoiceNumber,
        invoiceId: invoice.id,
      });

      return { checkoutToken: result.checkoutToken, amount: balance.toNumber() };
    }),

  confirmHelcimPayment: publicProcedure
    .input(
      z.object({
        invoiceId: z.string(),
        transactionId: z.string(),
        approvalCode: z.string(),
        cardType: z.string(),
        amount: z.string(),
        hash: z.string(),
        rawResponse: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUnique({
        where: { id: input.invoiceId },
      });

      if (!invoice) {
        throw new Error("Invoice not found");
      }

      // Verify the transaction hash
      const isValid = verifyTransactionResponse(
        input.invoiceId,
        input.hash,
        input.rawResponse
      );

      if (!isValid) {
        throw new Error("Transaction verification failed");
      }

      const paymentAmount = new Decimal(input.amount);

      // Create payment record using existing pattern
      const payment = await ctx.db.payment.create({
        data: {
          invoiceId: input.invoiceId,
          amount: paymentAmount,
          paymentDate: new Date(),
          paymentMethod: "CREDIT_CARD",
          reference: `Helcim #${input.transactionId}`,
          notes: `Approval: ${input.approvalCode} | Card: ${input.cardType}`,
        },
      });

      // Update invoice amount paid
      const newAmountPaid = new Decimal(invoice.amountPaid.toString()).add(
        paymentAmount
      );
      const total = new Decimal(invoice.total.toString());

      await ctx.db.invoice.update({
        where: { id: input.invoiceId },
        data: {
          amountPaid: newAmountPaid,
          status: newAmountPaid.gte(total) ? "PAID" : invoice.status,
          paidAt: newAmountPaid.gte(total) ? new Date() : invoice.paidAt,
        },
      });

      return payment;
    }),
});
