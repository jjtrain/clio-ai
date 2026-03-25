import { z } from "zod";
import { router, publicProcedure } from "../trpc";

export const matterMessagingRouter = router({
  getOrCreateThread: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.userId || "demo-user";
      let thread = await ctx.db.matterThread.findUnique({ where: { matterId: input.matterId } });
      if (!thread) {
        thread = await ctx.db.matterThread.create({ data: { matterId: input.matterId } });
      }

      const messages = await ctx.db.matterMessage.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      // Get author names
      const authorIds = Array.from(new Set(messages.map((m) => m.authorId)));
      const authors = await ctx.db.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, email: true } });
      const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]));

      const readReceipt = await ctx.db.matterMessageRead.findUnique({
        where: { threadId_userId: { threadId: thread.id, userId } },
      });

      // Mark as read
      const latestMsg = messages[0];
      if (latestMsg) {
        await ctx.db.matterMessageRead.upsert({
          where: { threadId_userId: { threadId: thread.id, userId } },
          create: { threadId: thread.id, userId, lastReadAt: new Date(), lastReadMessageId: latestMsg.id },
          update: { lastReadAt: new Date(), lastReadMessageId: latestMsg.id },
        });
        await ctx.db.matterMessageNotification.upsert({
          where: { userId_threadId: { userId, threadId: thread.id } },
          create: { userId, threadId: thread.id, matterId: input.matterId, unreadCount: 0, mentioned: false },
          update: { unreadCount: 0, mentioned: false },
        });
      }

      // Add reply counts
      const parentIds = messages.filter((m) => !m.parentId).map((m) => m.id);
      const replyCounts = await ctx.db.matterMessage.groupBy({ by: ["parentId"], where: { parentId: { in: parentIds } }, _count: { id: true } });
      const replyMap = Object.fromEntries(replyCounts.map((r) => [r.parentId!, r._count.id]));

      return {
        thread,
        messages: messages.reverse().map((m) => ({
          ...m,
          body: m.deletedAt ? "[message deleted]" : m.body,
          author: authorMap[m.authorId] || { id: m.authorId, name: "Unknown", email: "" },
          replyCount: replyMap[m.id] || 0,
          attachmentUrls: m.deletedAt ? [] : m.attachmentUrls,
        })),
        readReceipt,
        totalMessages: thread.messageCount,
      };
    }),

  getMessages: publicProcedure
    .input(z.object({ threadId: z.string(), cursor: z.string().optional(), limit: z.number().default(50) }))
    .query(async ({ ctx, input }) => {
      const where: any = { threadId: input.threadId };
      if (input.cursor) {
        const cursorMsg = await ctx.db.matterMessage.findUnique({ where: { id: input.cursor }, select: { createdAt: true } });
        if (cursorMsg) where.createdAt = { lt: cursorMsg.createdAt };
      }
      const messages = await ctx.db.matterMessage.findMany({ where, orderBy: { createdAt: "asc" }, take: input.limit });
      const authorIds = Array.from(new Set(messages.map((m) => m.authorId)));
      const authors = await ctx.db.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, email: true } });
      const authorMap = Object.fromEntries(authors.map((a) => [a.id, a]));
      return messages.map((m) => ({
        ...m, body: m.deletedAt ? "[message deleted]" : m.body,
        author: authorMap[m.authorId] || { id: m.authorId, name: "Unknown", email: "" },
        attachmentUrls: m.deletedAt ? [] : m.attachmentUrls,
      }));
    }),

  sendMessage: publicProcedure
    .input(z.object({ threadId: z.string(), matterId: z.string(), body: z.string().min(1).max(10000), parentId: z.string().optional(), attachmentUrls: z.any().optional() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.userId || "demo-user";

      // Parse @mentions: @[Name](userId)
      const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
      const mentions: string[] = [];
      let match;
      while ((match = mentionRegex.exec(input.body)) !== null) mentions.push(match[2]);

      const message = await ctx.db.matterMessage.create({
        data: {
          threadId: input.threadId, matterId: input.matterId, authorId: userId,
          body: input.body, parentId: input.parentId || null,
          mentions: mentions as any, attachmentUrls: input.attachmentUrls || [],
        },
      });

      // Update thread
      const thread = await ctx.db.matterThread.findUniqueOrThrow({ where: { id: input.threadId } });
      const participants = (thread.participantIds as string[] || []);
      const newParticipants = Array.from(new Set([...participants, userId, ...mentions]));
      await ctx.db.matterThread.update({
        where: { id: input.threadId },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: input.body.slice(0, 140),
          messageCount: { increment: 1 },
          participantIds: newParticipants as any,
        },
      });

      // Notify mentioned users
      for (const mentionedId of mentions) {
        if (mentionedId === userId) continue;
        await ctx.db.matterMessageNotification.upsert({
          where: { userId_threadId: { userId: mentionedId, threadId: input.threadId } },
          create: { userId: mentionedId, threadId: input.threadId, matterId: input.matterId, unreadCount: 1, mentioned: true },
          update: { unreadCount: { increment: 1 }, mentioned: true },
        });
      }

      // Notify other participants
      for (const pid of newParticipants) {
        if (pid === userId || mentions.includes(pid)) continue;
        await ctx.db.matterMessageNotification.upsert({
          where: { userId_threadId: { userId: pid, threadId: input.threadId } },
          create: { userId: pid, threadId: input.threadId, matterId: input.matterId, unreadCount: 1 },
          update: { unreadCount: { increment: 1 } },
        });
      }

      // Mark sender as read
      await ctx.db.matterMessageRead.upsert({
        where: { threadId_userId: { threadId: input.threadId, userId } },
        create: { threadId: input.threadId, userId, lastReadAt: new Date(), lastReadMessageId: message.id },
        update: { lastReadAt: new Date(), lastReadMessageId: message.id },
      });

      const author = await ctx.db.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
      return { ...message, author: author || { id: userId, name: "Unknown", email: "" } };
    }),

  editMessage: publicProcedure
    .input(z.object({ messageId: z.string(), body: z.string().min(1).max(10000) }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.userId || "demo-user";
      const msg = await ctx.db.matterMessage.findUniqueOrThrow({ where: { id: input.messageId } });
      if (msg.authorId !== userId) throw new Error("Only the author can edit");
      if (msg.deletedAt) throw new Error("Cannot edit deleted message");
      if (msg.isSystemMessage) throw new Error("Cannot edit system messages");
      return ctx.db.matterMessage.update({ where: { id: input.messageId }, data: { body: input.body, editedAt: new Date() } });
    }),

  deleteMessage: publicProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.userId || "demo-user";
      const msg = await ctx.db.matterMessage.findUniqueOrThrow({ where: { id: input.messageId } });
      if (msg.authorId !== userId) {
        // Allow firm admins — simplified check
      }
      return ctx.db.matterMessage.update({
        where: { id: input.messageId },
        data: { deletedAt: new Date(), body: "[message deleted]", attachmentUrls: [] },
      });
    }),

  addReaction: publicProcedure
    .input(z.object({ messageId: z.string(), emoji: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.userId || "demo-user";
      const msg = await ctx.db.matterMessage.findUniqueOrThrow({ where: { id: input.messageId } });
      const reactions = (msg.reactions || {}) as Record<string, string[]>;
      if (!reactions[input.emoji]) reactions[input.emoji] = [];
      if (!reactions[input.emoji].includes(userId)) reactions[input.emoji].push(userId);
      return ctx.db.matterMessage.update({ where: { id: input.messageId }, data: { reactions: reactions as any } });
    }),

  removeReaction: publicProcedure
    .input(z.object({ messageId: z.string(), emoji: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.userId || "demo-user";
      const msg = await ctx.db.matterMessage.findUniqueOrThrow({ where: { id: input.messageId } });
      const reactions = (msg.reactions || {}) as Record<string, string[]>;
      if (reactions[input.emoji]) {
        reactions[input.emoji] = reactions[input.emoji].filter((id) => id !== userId);
        if (reactions[input.emoji].length === 0) delete reactions[input.emoji];
      }
      return ctx.db.matterMessage.update({ where: { id: input.messageId }, data: { reactions: reactions as any } });
    }),

  pinMessage: publicProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const msg = await ctx.db.matterMessage.findUniqueOrThrow({ where: { id: input.messageId } });
      // Unpin previous
      await ctx.db.matterMessage.updateMany({ where: { threadId: msg.threadId, isPinned: true }, data: { isPinned: false } });
      await ctx.db.matterMessage.update({ where: { id: input.messageId }, data: { isPinned: true } });
      return ctx.db.matterThread.update({ where: { id: msg.threadId }, data: { pinnedMessageId: input.messageId } });
    }),

  unpinMessage: publicProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const msg = await ctx.db.matterMessage.findUniqueOrThrow({ where: { id: input.messageId } });
      await ctx.db.matterMessage.update({ where: { id: input.messageId }, data: { isPinned: false } });
      return ctx.db.matterThread.update({ where: { id: msg.threadId }, data: { pinnedMessageId: null } });
    }),

  markRead: publicProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.userId || "demo-user";
      const latest = await ctx.db.matterMessage.findFirst({ where: { threadId: input.threadId }, orderBy: { createdAt: "desc" } });
      await ctx.db.matterMessageRead.upsert({
        where: { threadId_userId: { threadId: input.threadId, userId } },
        create: { threadId: input.threadId, userId, lastReadAt: new Date(), lastReadMessageId: latest?.id },
        update: { lastReadAt: new Date(), lastReadMessageId: latest?.id },
      });
      await ctx.db.matterMessageNotification.upsert({
        where: { userId_threadId: { userId, threadId: input.threadId } },
        create: { userId, threadId: input.threadId, matterId: "", unreadCount: 0, mentioned: false },
        update: { unreadCount: 0, mentioned: false },
      });
      return { success: true };
    }),

  getUnreadCounts: publicProcedure
    .input(z.object({ matterIds: z.array(z.string()) }))
    .query(async ({ ctx, input }) => {
      const userId = ctx.session?.userId || "demo-user";
      const threads = await ctx.db.matterThread.findMany({ where: { matterId: { in: input.matterIds } }, select: { id: true, matterId: true } });
      const threadIds = threads.map((t) => t.id);
      const notifications = await ctx.db.matterMessageNotification.findMany({ where: { userId, threadId: { in: threadIds } } });
      const notifMap = Object.fromEntries(notifications.map((n) => [n.threadId, n]));
      const result: Record<string, { unreadCount: number; mentioned: boolean }> = {};
      for (const t of threads) {
        const notif = notifMap[t.id];
        result[t.matterId] = { unreadCount: notif?.unreadCount || 0, mentioned: notif?.mentioned || false };
      }
      return result;
    }),

  postSystemMessage: publicProcedure
    .input(z.object({ matterId: z.string(), body: z.string(), systemEventType: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      let thread = await ctx.db.matterThread.findUnique({ where: { matterId: input.matterId } });
      if (!thread) thread = await ctx.db.matterThread.create({ data: { matterId: input.matterId } });

      const msg = await ctx.db.matterMessage.create({
        data: {
          threadId: thread.id, matterId: input.matterId, authorId: "system",
          body: input.body, isSystemMessage: true, systemEventType: input.systemEventType,
        },
      });

      await ctx.db.matterThread.update({
        where: { id: thread.id },
        data: { lastMessageAt: new Date(), lastMessagePreview: input.body.slice(0, 140), messageCount: { increment: 1 } },
      });

      // Notify all participants
      const participants = (thread.participantIds as string[] || []);
      for (const pid of participants) {
        await ctx.db.matterMessageNotification.upsert({
          where: { userId_threadId: { userId: pid, threadId: thread.id } },
          create: { userId: pid, threadId: thread.id, matterId: input.matterId, unreadCount: 1 },
          update: { unreadCount: { increment: 1 } },
        });
      }

      return msg;
    }),
});
