import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { pushInvoice, syncAllPending, pullPaymentUpdates } from "@/lib/accounting-sync-engine";

export const accountingSyncRouter = router({
  // Get integration status
  getIntegration: publicProcedure.query(async ({ ctx }) => {
    const integrations = await ctx.db.accountingIntegration.findMany({
      orderBy: { updatedAt: "desc" },
    });
    return integrations.map((i) => ({
      id: i.id,
      provider: i.provider,
      isEnabled: i.isEnabled,
      isConnected: i.isConnected,
      companyName: i.companyName,
      lastSyncAt: i.lastSyncAt,
      syncStatus: i.syncStatus,
      syncError: i.syncError,
      syncDirection: i.syncDirection,
      autoSyncEnabled: i.autoSyncEnabled,
      createdAt: i.createdAt,
    }));
  }),

  // Disconnect integration
  disconnectIntegration: publicProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.accountingIntegration.update({
        where: { provider: input.provider as any },
        data: {
          isConnected: false,
          isEnabled: false,
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
        },
      });
    }),

  // Trigger manual sync
  syncNow: publicProcedure.mutation(async ({ ctx }) => {
    const firmId = ctx.session?.firmId || "demo-firm";
    const pushResult = await syncAllPending(firmId);
    const pullResult = await pullPaymentUpdates(firmId);
    return {
      invoicesPushed: pushResult.invoices,
      paymentsPushed: pushResult.payments,
      paymentsUpdated: pullResult.updated,
      errors: [...pushResult.errors, ...pullResult.errors],
    };
  }),

  // Push single invoice
  pushInvoiceNow: publicProcedure
    .input(z.object({ invoiceId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const firmId = ctx.session?.firmId || "demo-firm";
      return pushInvoice(input.invoiceId, firmId);
    }),

  // Get sync logs
  getSyncLog: publicProcedure
    .input(z.object({
      entityType: z.string().optional(),
      action: z.string().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.entityType) where.entityType = input.entityType;
      if (input?.action) where.action = input.action;
      return ctx.db.syncLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input?.limit || 50,
        include: { integration: { select: { provider: true } } },
      });
    }),

  // Get sync stats
  getSyncStats: publicProcedure.query(async ({ ctx }) => {
    const total = await ctx.db.syncLog.count();
    const created = await ctx.db.syncLog.count({ where: { action: "CREATED" } });
    const updated = await ctx.db.syncLog.count({ where: { action: "UPDATED" } });
    const failed = await ctx.db.syncLog.count({ where: { action: "FAILED" } });

    const lastError = await ctx.db.syncLog.findFirst({
      where: { action: "FAILED" },
      orderBy: { createdAt: "desc" },
      select: { errorMessage: true, createdAt: true, entityType: true },
    });

    const pendingInvoices = await ctx.db.invoice.count({
      where: { status: { in: ["SENT", "PAID", "OVERDUE"] } },
    });

    // Count synced invoices via ExternalIdMapping
    const syncedInvoiceCount = await ctx.db.externalIdMapping.count({
      where: { entityType: "INVOICE" },
    });

    return {
      total,
      created,
      updated,
      failed,
      lastError,
      pendingCount: Math.max(0, pendingInvoices - syncedInvoiceCount),
      syncedInvoices: syncedInvoiceCount,
    };
  }),

  // Check if an invoice has been synced
  getInvoiceSyncStatus: publicProcedure
    .input(z.object({ invoiceId: z.string() }))
    .query(async ({ ctx, input }) => {
      const mapping = await ctx.db.externalIdMapping.findFirst({
        where: { entityType: "INVOICE", internalId: input.invoiceId },
        include: { integration: { select: { provider: true } } },
      });
      return mapping ? {
        synced: true,
        provider: mapping.integration.provider,
        externalId: mapping.externalId,
        lastSyncedAt: mapping.lastSyncedAt,
      } : { synced: false };
    }),

  // Toggle auto-sync
  toggleAutoSync: publicProcedure
    .input(z.object({ provider: z.string(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.accountingIntegration.update({
        where: { provider: input.provider as any },
        data: { autoSyncEnabled: input.enabled },
      });
    }),
});
