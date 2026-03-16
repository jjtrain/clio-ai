import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getQBAuthUrl, exchangeQBCode, qbGetAccounts, qbGetCustomers, qbCreateCustomer, qbCreateInvoice, qbCreatePayment } from "@/lib/quickbooks";
import { getXeroAuthUrl, exchangeXeroCode, xeroGetAccounts, xeroGetContacts, xeroCreateContact, xeroCreateInvoice, xeroCreatePayment } from "@/lib/xero";
import { refreshIfExpired } from "@/lib/token-refresh";

const PROVIDER_ENUM = ["QUICKBOOKS", "XERO"] as const;
const DIRECTION_ENUM = ["TO_EXTERNAL", "FROM_EXTERNAL", "BIDIRECTIONAL"] as const;

export const integrationsRouter = router({
  // ─── Connection ────────────────────────────────────────────────

  listIntegrations: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.accountingIntegration.findMany({ orderBy: { provider: "asc" } });
  }),

  getIntegration: publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM) }))
    .query(async ({ ctx, input }) => {
      const int = await ctx.db.accountingIntegration.findUnique({ where: { provider: input.provider } });
      if (!int) return null;
      return { ...int, accessToken: int.accessToken ? "***" : null, refreshToken: int.refreshToken ? "***" : null };
    }),

  getAuthUrl: publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM) }))
    .mutation(async ({ ctx, input }) => {
      const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      const redirectUri = `${baseUrl}/api/${input.provider.toLowerCase()}/callback`;

      if (input.provider === "QUICKBOOKS") return { url: getQBAuthUrl(redirectUri) };
      if (input.provider === "XERO") return { url: getXeroAuthUrl(redirectUri) };
      throw new Error("Unknown provider");
    }),

  handleCallback: publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM), code: z.string(), realmId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
      const redirectUri = `${baseUrl}/api/${input.provider.toLowerCase()}/callback`;

      let accessToken: string, refreshToken: string, expiresIn: number;
      let realmId: string | undefined, tenantId: string | undefined, companyName = "Connected";

      if (input.provider === "QUICKBOOKS") {
        const result = await exchangeQBCode(input.code, input.realmId || "", redirectUri);
        accessToken = result.accessToken;
        refreshToken = result.refreshToken;
        expiresIn = result.expiresIn;
        realmId = input.realmId;
      } else {
        const result = await exchangeXeroCode(input.code, redirectUri);
        accessToken = result.accessToken;
        refreshToken = result.refreshToken;
        expiresIn = result.expiresIn;
        tenantId = result.tenantId;
      }

      return ctx.db.accountingIntegration.upsert({
        where: { provider: input.provider },
        create: {
          provider: input.provider,
          isEnabled: true,
          isConnected: true,
          accessToken,
          refreshToken,
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
          realmId,
          tenantId,
          companyName,
        },
        update: {
          isConnected: true,
          accessToken,
          refreshToken,
          tokenExpiresAt: new Date(Date.now() + expiresIn * 1000),
          realmId: realmId || undefined,
          tenantId: tenantId || undefined,
          companyName,
        },
      });
    }),

  disconnect: publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM) }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.accountingIntegration.update({
        where: { provider: input.provider },
        data: { isConnected: false, accessToken: null, refreshToken: null, tokenExpiresAt: null },
      });
    }),

  testConnection: publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM) }))
    .mutation(async ({ ctx, input }) => {
      const int = await ctx.db.accountingIntegration.findUnique({ where: { provider: input.provider } });
      if (!int?.isConnected || !int.accessToken) return { connected: false, error: "Not connected" };

      try {
        const token = await refreshIfExpired(int);
        let accounts: any[] = [];
        if (input.provider === "QUICKBOOKS" && int.realmId) {
          accounts = await qbGetAccounts(token, int.realmId);
        } else if (input.provider === "XERO" && int.tenantId) {
          accounts = await xeroGetAccounts(token, int.tenantId);
        }
        return { connected: true, companyName: int.companyName, accountCount: accounts.length };
      } catch (e: any) {
        return { connected: false, error: e.message };
      }
    }),

  // ─── Sync ──────────────────────────────────────────────────────

  syncClients: publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM) }))
    .mutation(async ({ ctx, input }) => {
      const int = await ctx.db.accountingIntegration.findUniqueOrThrow({ where: { provider: input.provider } });
      if (!int.isConnected) throw new Error("Not connected");
      const token = await refreshIfExpired(int);

      const clients = await ctx.db.client.findMany({ where: { status: "ACTIVE" } });
      let created = 0, updated = 0, skipped = 0, failed = 0;

      for (const client of clients) {
        const existing = await ctx.db.externalIdMapping.findUnique({
          where: { integrationId_entityType_internalId: { integrationId: int.id, entityType: "client", internalId: client.id } },
        });

        if (existing) { skipped++; continue; }

        try {
          let externalId: string;
          if (input.provider === "QUICKBOOKS" && int.realmId) {
            const result = await qbCreateCustomer(token, int.realmId, { name: client.name, email: client.email || undefined, phone: client.phone || undefined });
            externalId = result.id;
          } else if (input.provider === "XERO" && int.tenantId) {
            const result = await xeroCreateContact(token, int.tenantId, { name: client.name, email: client.email || undefined, phone: client.phone || undefined });
            externalId = result.id;
          } else { skipped++; continue; }

          await ctx.db.externalIdMapping.create({
            data: { integrationId: int.id, entityType: "client", internalId: client.id, externalId, lastSyncedAt: new Date() },
          });
          await ctx.db.syncLog.create({
            data: { integrationId: int.id, direction: "to_external", entityType: "client", entityId: client.id, externalId, action: "CREATED" },
          });
          created++;
        } catch (e: any) {
          await ctx.db.syncLog.create({
            data: { integrationId: int.id, direction: "to_external", entityType: "client", entityId: client.id, action: "FAILED", errorMessage: e.message },
          });
          failed++;
        }
      }

      return { created, updated, skipped, failed, total: clients.length };
    }),

  syncInvoices: publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM) }))
    .mutation(async ({ ctx, input }) => {
      const int = await ctx.db.accountingIntegration.findUniqueOrThrow({ where: { provider: input.provider } });
      if (!int.isConnected) throw new Error("Not connected");
      const token = await refreshIfExpired(int);

      const invoices = await ctx.db.invoice.findMany({
        where: { status: { in: ["SENT", "PAID", "OVERDUE"] } },
        include: { matter: { include: { client: true } }, lineItems: true },
      });

      let created = 0, skipped = 0, failed = 0;

      for (const inv of invoices) {
        const existing = await ctx.db.externalIdMapping.findUnique({
          where: { integrationId_entityType_internalId: { integrationId: int.id, entityType: "invoice", internalId: inv.id } },
        });
        if (existing) { skipped++; continue; }

        // Find client external ID
        const clientMapping = await ctx.db.externalIdMapping.findUnique({
          where: { integrationId_entityType_internalId: { integrationId: int.id, entityType: "client", internalId: inv.matter.clientId } },
        });
        if (!clientMapping) { skipped++; continue; }

        try {
          let externalId: string;
          const lineItems = inv.lineItems.map((li) => ({ description: li.description, amount: Number(li.amount) }));

          if (input.provider === "QUICKBOOKS" && int.realmId) {
            const result = await qbCreateInvoice(token, int.realmId, { customerRef: clientMapping.externalId, lineItems, dueDate: inv.dueDate.toISOString().split("T")[0], invoiceNumber: inv.invoiceNumber });
            externalId = result.id;
          } else if (input.provider === "XERO" && int.tenantId) {
            const result = await xeroCreateInvoice(token, int.tenantId, { contactId: clientMapping.externalId, lineItems, dueDate: inv.dueDate.toISOString().split("T")[0], invoiceNumber: inv.invoiceNumber });
            externalId = result.id;
          } else { skipped++; continue; }

          await ctx.db.externalIdMapping.create({
            data: { integrationId: int.id, entityType: "invoice", internalId: inv.id, externalId, lastSyncedAt: new Date() },
          });
          await ctx.db.syncLog.create({
            data: { integrationId: int.id, direction: "to_external", entityType: "invoice", entityId: inv.id, externalId, action: "CREATED" },
          });
          created++;
        } catch (e: any) {
          await ctx.db.syncLog.create({
            data: { integrationId: int.id, direction: "to_external", entityType: "invoice", entityId: inv.id, action: "FAILED", errorMessage: e.message },
          });
          failed++;
        }
      }

      return { created, skipped, failed, total: invoices.length };
    }),

  syncAll: publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM) }))
    .mutation(async ({ ctx, input }) => {
      const int = await ctx.db.accountingIntegration.findUniqueOrThrow({ where: { provider: input.provider } });
      await ctx.db.accountingIntegration.update({ where: { provider: input.provider }, data: { syncStatus: "SYNCING" } });

      try {
        // Note: in a real implementation, each sync step would call the specific sync mutations
        // For now, update the sync status
        await ctx.db.accountingIntegration.update({
          where: { provider: input.provider },
          data: { syncStatus: "IDLE", lastSyncAt: new Date(), syncError: null },
        });
        return { success: true, message: "Sync initiated" };
      } catch (e: any) {
        await ctx.db.accountingIntegration.update({
          where: { provider: input.provider },
          data: { syncStatus: "ERROR", syncError: e.message },
        });
        return { success: false, error: e.message };
      }
    }),

  // ─── Account Mapping ───────────────────────────────────────────

  getExternalAccounts: publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM) }))
    .query(async ({ ctx, input }) => {
      const int = await ctx.db.accountingIntegration.findUnique({ where: { provider: input.provider } });
      if (!int?.isConnected || !int.accessToken) return [];

      try {
        const token = await refreshIfExpired(int);
        if (input.provider === "QUICKBOOKS" && int.realmId) return qbGetAccounts(token, int.realmId);
        if (input.provider === "XERO" && int.tenantId) return xeroGetAccounts(token, int.tenantId);
      } catch { return []; }
      return [];
    }),

  getAccountMapping: publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM) }))
    .query(async ({ ctx, input }) => {
      const int = await ctx.db.accountingIntegration.findUnique({ where: { provider: input.provider } });
      if (!int?.accountMapping) return {};
      try { return JSON.parse(int.accountMapping); } catch { return {}; }
    }),

  saveAccountMapping: publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM), mapping: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.accountingIntegration.update({
        where: { provider: input.provider },
        data: { accountMapping: input.mapping },
      });
    }),

  // ─── Sync Logs ─────────────────────────────────────────────────

  getSyncLogs: publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM), entityType: z.string().optional(), action: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      const int = await ctx.db.accountingIntegration.findUnique({ where: { provider: input.provider } });
      if (!int) return [];
      const where: any = { integrationId: int.id };
      if (input.entityType) where.entityType = input.entityType;
      if (input.action) where.action = input.action;
      return ctx.db.syncLog.findMany({ where, orderBy: { createdAt: "desc" }, take: input.limit });
    }),

  getSyncStats: publicProcedure
    .input(z.object({ provider: z.enum(PROVIDER_ENUM) }))
    .query(async ({ ctx, input }) => {
      const int = await ctx.db.accountingIntegration.findUnique({ where: { provider: input.provider } });
      if (!int) return { totalSynced: 0, created: 0, updated: 0, failed: 0, lastSync: null };
      const logs = await ctx.db.syncLog.findMany({ where: { integrationId: int.id } });
      return {
        totalSynced: logs.length,
        created: logs.filter((l) => l.action === "CREATED").length,
        updated: logs.filter((l) => l.action === "UPDATED").length,
        failed: logs.filter((l) => l.action === "FAILED").length,
        lastSync: int.lastSyncAt,
      };
    }),

  // ─── Settings ──────────────────────────────────────────────────

  updateSettings: publicProcedure
    .input(z.object({
      provider: z.enum(PROVIDER_ENUM),
      syncDirection: z.enum(DIRECTION_ENUM).optional(),
      autoSyncEnabled: z.boolean().optional(),
      autoSyncFrequency: z.string().optional(),
      settings: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { provider, ...data } = input;
      return ctx.db.accountingIntegration.update({ where: { provider }, data });
    }),
});
