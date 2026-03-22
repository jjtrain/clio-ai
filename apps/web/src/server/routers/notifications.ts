import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as pushEngine from "@/lib/push-engine";

export const notificationsRouter = router({
  // 1. subscribePush
  subscribePush: publicProcedure
    .input(z.object({
      userId: z.string(),
      subscription: z.object({ endpoint: z.string(), keys: z.object({ p256dh: z.string(), auth: z.string() }) }),
      deviceInfo: z.object({ userAgent: z.string().optional(), platform: z.string().optional() }).optional(),
    }))
    .mutation(async ({ input }) => {
      return pushEngine.subscribe(input.userId, input.subscription, input.deviceInfo);
    }),

  // 2. unsubscribePush
  unsubscribePush: publicProcedure
    .input(z.object({ subscriptionId: z.string() }))
    .mutation(async ({ input }) => {
      return pushEngine.unsubscribe(input.subscriptionId);
    }),

  // 3. getSubscriptions
  getSubscriptions: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      return db.pushSubscription.findMany({ where: { userId: input.userId, isActive: true } });
    }),

  // 4. testPush
  testPush: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      return pushEngine.sendPushNotification(input.userId, { title: "Test Notification", body: "Push notifications are working!" });
    }),

  // 5. getPreferences
  getPreferences: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      const existing = await db.notificationPreference.findFirst({ where: { userId: input.userId } });
      if (existing) return existing;
      return db.notificationPreference.create({ data: { userId: input.userId } });
    }),

  // 6. updatePreferences
  updatePreferences: publicProcedure
    .input(z.object({
      userId: z.string(),
      data: z.record(z.unknown()),
    }))
    .mutation(async ({ input }) => {
      return db.notificationPreference.upsert({
        where: { userId: input.userId },
        update: input.data as any,
        create: { userId: input.userId, ...(input.data as any) },
      });
    }),

  // 7. list
  list: publicProcedure
    .input(z.object({
      userId: z.string(),
      channel: z.string().optional(),
      category: z.string().optional(),
      read: z.boolean().optional(),
      cursor: z.string().optional(),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      const where: any = { userId: input.userId };
      if (input.channel) where.channel = input.channel;
      if (input.category) where.category = input.category;
      if (input.read !== undefined) where.read = input.read;
      const items = await db.sentNotification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });
      const hasMore = items.length > input.limit;
      return { items: items.slice(0, input.limit), nextCursor: hasMore ? items[input.limit - 1].id : null };
    }),

  // 8. getUnreadCount
  getUnreadCount: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      return pushEngine.getUnreadCount(input.userId);
    }),

  // 9. markRead
  markRead: publicProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ input }) => {
      return pushEngine.markRead(input.notificationId);
    }),

  // 10. markClicked
  markClicked: publicProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ input }) => {
      return pushEngine.markClicked(input.notificationId);
    }),

  // 11. markAllRead
  markAllRead: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      return pushEngine.markAllRead(input.userId);
    }),

  // 12. delete
  delete: publicProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(async ({ input }) => {
      return db.sentNotification.delete({ where: { id: input.notificationId } });
    }),

  // 13. deleteAll
  deleteAll: publicProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input }) => {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return db.sentNotification.deleteMany({ where: { userId: input.userId, read: true, createdAt: { lt: cutoff } } });
    }),

  // 14. send
  send: publicProcedure
    .input(z.object({
      userId: z.string(), category: z.string(), severity: z.string(),
      title: z.string(), body: z.string(), icon: z.string().optional(),
      url: z.string().optional(), matterId: z.string().optional(),
      entityType: z.string().optional(), entityId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return pushEngine.sendNotification(input);
    }),

  // 15. sendBulk
  sendBulk: publicProcedure
    .input(z.object({
      userIds: z.array(z.string()),
      category: z.string(), severity: z.string(),
      title: z.string(), body: z.string(), icon: z.string().optional(),
      url: z.string().optional(), matterId: z.string().optional(),
      entityType: z.string().optional(), entityId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { userIds, ...params } = input;
      return pushEngine.sendBulkNotification(userIds, params);
    }),

  // 16. getDailyDigest
  getDailyDigest: publicProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input }) => {
      return pushEngine.generateDailyDigest(input.userId);
    }),

  // 17. sendDailyDigest
  sendDailyDigest: publicProcedure
    .input(z.object({ userId: z.string().optional() }))
    .mutation(async ({ input }) => {
      if (input.userId) {
        return { digest: await pushEngine.generateDailyDigest(input.userId) };
      }
      const users = await db.user.findMany({ select: { id: true } });
      const results = await Promise.all(users.map((u) => pushEngine.generateDailyDigest(u.id)));
      return { sent: results.length };
    }),

  // 18. sendCustom
  sendCustom: publicProcedure
    .input(z.object({
      userIds: z.array(z.string()),
      title: z.string(), body: z.string(),
      category: z.string().default("custom"), severity: z.string().default("LOW"),
      icon: z.string().optional(), url: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { userIds, ...params } = input;
      return pushEngine.sendBulkNotification(userIds, params);
    }),

  // 19. getStats
  getStats: publicProcedure
    .input(z.object({ userId: z.string().optional(), since: z.string().optional() }))
    .query(async ({ input }) => {
      const where: any = {};
      if (input.userId) where.userId = input.userId;
      if (input.since) where.createdAt = { gte: new Date(input.since) };
      const total = await db.sentNotification.count({ where });
      const delivered = await db.sentNotification.count({ where: { ...where, delivered: true } });
      const read = await db.sentNotification.count({ where: { ...where, read: true } });
      const clicked = await db.sentNotification.count({ where: { ...where, clicked: true } });
      return { total, delivered, read, clicked, deliveryRate: total ? delivered / total : 0, readRate: total ? read / total : 0, clickRate: total ? clicked / total : 0 };
    }),

  // 20. runDeadlineCheck
  runDeadlineCheck: publicProcedure
    .mutation(async () => {
      return pushEngine.checkAllAlerts();
    }),
});
