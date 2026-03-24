import { z } from "zod";
import crypto from "crypto";
import { router, publicProcedure } from "../trpc";
import { generateApiKey } from "@/lib/api/keys";
import { fireWebhook } from "@/lib/webhooks/dispatcher";
import { RECIPE_TEMPLATES } from "@/lib/automation/recipe-templates";

export const apiIntegrationsRouter = router({
  // ─── API Keys ─────────────────────────────────────────────────
  listApiKeys: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.apiKey.findMany({
      where: { isActive: true },
      select: { id: true, name: true, keyPrefix: true, scopes: true, lastUsedAt: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    });
  }),

  createApiKey: publicProcedure
    .input(z.object({ name: z.string().min(1), scopes: z.array(z.string()), expiresAt: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { rawKey, keyHash, keyPrefix } = generateApiKey();
      const key = await ctx.db.apiKey.create({
        data: {
          name: input.name,
          keyHash,
          keyPrefix,
          scopes: input.scopes.join(","),
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });
      return { id: key.id, rawKey, keyPrefix, name: key.name, scopes: input.scopes };
    }),

  revokeApiKey: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.apiKey.update({ where: { id: input.id }, data: { isActive: false, revokedAt: new Date() } });
    }),

  rotateApiKey: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const old = await ctx.db.apiKey.findUniqueOrThrow({ where: { id: input.id } });
      await ctx.db.apiKey.update({ where: { id: input.id }, data: { isActive: false, revokedAt: new Date() } });
      const { rawKey, keyHash, keyPrefix } = generateApiKey();
      const newKey = await ctx.db.apiKey.create({
        data: { name: old.name, keyHash, keyPrefix, scopes: old.scopes },
      });
      return { id: newKey.id, rawKey, keyPrefix, name: newKey.name };
    }),

  getApiKeyActivity: publicProcedure
    .input(z.object({ keyId: z.string(), days: z.number().default(30) }))
    .query(async ({ ctx, input }) => {
      const since = new Date(Date.now() - input.days * 86400000);
      return ctx.db.automationLog.findMany({
        where: { apiKeyId: input.keyId, createdAt: { gte: since } },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
    }),

  // ─── Webhook Subscriptions ────────────────────────────────────
  listWebhookSubscriptions: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.webhookSubscription.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { deliveries: true } } },
    });
  }),

  createWebhookSubscription: publicProcedure
    .input(z.object({ event: z.string(), targetUrl: z.string().url(), description: z.string().optional(), apiKeyId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const secret = crypto.randomBytes(32).toString("hex");
      return ctx.db.webhookSubscription.create({
        data: { firmId: "demo-firm", apiKeyId: input.apiKeyId, event: input.event, targetUrl: input.targetUrl, secret, description: input.description },
      });
    }),

  deleteWebhookSubscription: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.webhookSubscription.delete({ where: { id: input.id } })),

  toggleWebhookSubscription: publicProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => ctx.db.webhookSubscription.update({ where: { id: input.id }, data: { isActive: input.isActive } })),

  testWebhookSubscription: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sub = await ctx.db.webhookSubscription.findUniqueOrThrow({ where: { id: input.id } });
      await fireWebhook(sub.event, sub.firmId, { test: true, message: "Test webhook from Managal" });
      const delivery = await ctx.db.webhookDelivery.findFirst({ where: { subscriptionId: sub.id }, orderBy: { deliveredAt: "desc" } });
      return delivery;
    }),

  getWebhookDeliveries: publicProcedure
    .input(z.object({ subscriptionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.webhookDelivery.findMany({ where: { subscriptionId: input.subscriptionId }, orderBy: { deliveredAt: "desc" }, take: 50 });
    }),

  // ─── Stats & Logs ─────────────────────────────────────────────
  getAutomationStats: publicProcedure.query(async ({ ctx }) => {
    const since = new Date(Date.now() - 30 * 86400000);
    const total = await ctx.db.automationLog.count({ where: { createdAt: { gte: since } } });
    const successes = await ctx.db.automationLog.count({ where: { createdAt: { gte: since }, success: true } });
    const failures = await ctx.db.automationLog.count({ where: { createdAt: { gte: since }, success: false } });
    return { total, successes, failures, successRate: total > 0 ? Math.round((successes / total) * 100) : 100 };
  }),

  getAutomationLog: publicProcedure
    .input(z.object({ limit: z.number().default(50), source: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.source) where.source = input.source;
      return ctx.db.automationLog.findMany({ where, orderBy: { createdAt: "desc" }, take: input?.limit || 50 });
    }),

  // ─── Recipe Templates ─────────────────────────────────────────
  getRecipeTemplates: publicProcedure.query(() => RECIPE_TEMPLATES),
});
