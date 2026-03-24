import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { sendMessage, getWindowStatus } from "@/lib/whatsapp/send-engine";
import { markMessageRead, getPhoneNumberQuality } from "@/lib/whatsapp/meta-client";
import { syncTemplates } from "@/lib/whatsapp/template-sync";

export const whatsappRouter = router({
  getConnectionStatus: publicProcedure.query(async ({ ctx }) => {
    const conn = await ctx.db.whatsAppConnection.findFirst({ where: { isActive: true } });
    if (!conn) return null;
    return { id: conn.id, phoneNumber: conn.phoneNumber, displayName: conn.displayName, qualityRating: conn.qualityRating, lastSyncAt: conn.lastSyncAt, isActive: conn.isActive };
  }),

  connect: publicProcedure
    .input(z.object({ wabaId: z.string(), phoneNumberId: z.string(), phoneNumber: z.string(), displayName: z.string(), accessToken: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const crypto = require("crypto");
      return ctx.db.whatsAppConnection.upsert({
        where: { firmId: "demo-firm" },
        create: { ...input, firmId: "demo-firm", webhookVerifyToken: crypto.randomBytes(16).toString("hex") },
        update: { ...input, isActive: true },
      });
    }),

  disconnect: publicProcedure.mutation(async ({ ctx }) => {
    return ctx.db.whatsAppConnection.updateMany({ where: { firmId: "demo-firm" }, data: { isActive: false } });
  }),

  listConversations: publicProcedure
    .input(z.object({ status: z.string().optional(), matterId: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.status) where.status = input.status;
      if (input?.matterId) where.matterId = input.matterId;
      return ctx.db.whatsAppConversation.findMany({
        where, orderBy: { lastMessageAt: "desc" }, take: input?.limit || 50,
      });
    }),

  getConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const conv = await ctx.db.whatsAppConversation.findUniqueOrThrow({ where: { id: input.id } });
      const messages = await ctx.db.whatsAppMessage.findMany({
        where: { conversationId: input.id }, orderBy: { sentAt: "desc" }, take: 50,
      });
      return { ...conv, messages: messages.reverse() };
    }),

  getMoreMessages: publicProcedure
    .input(z.object({ conversationId: z.string(), cursor: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.whatsAppMessage.findMany({
        where: { conversationId: input.conversationId, sentAt: { lt: new Date(input.cursor) } },
        orderBy: { sentAt: "desc" }, take: 50,
      });
    }),

  getWindowStatus: publicProcedure
    .input(z.object({ conversationId: z.string() }))
    .query(async ({ input }) => getWindowStatus(input.conversationId)),

  listTemplates: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.whatsAppTemplate.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
  }),

  getUnfiledConversations: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.whatsAppConversation.findMany({
      where: { matterId: null, status: { in: ["OPEN", "PENDING"] } },
      orderBy: { lastMessageAt: "desc" }, take: 50,
    });
  }),

  getConversationsByMatter: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.whatsAppConversation.findMany({
        where: { matterId: input.matterId }, orderBy: { lastMessageAt: "desc" },
      });
    }),

  // Mutations
  sendMessage: publicProcedure
    .input(z.object({
      conversationId: z.string(),
      type: z.enum(["text", "template"]),
      text: z.string().optional(),
      templateName: z.string().optional(),
      templateParams: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.userId || "demo-user";
      return sendMessage({
        firmId: "demo-firm",
        conversationId: input.conversationId,
        senderId: userId,
        type: input.type,
        text: input.text,
        templateName: input.templateName,
        templateParams: input.templateParams,
      });
    }),

  fileConversation: publicProcedure
    .input(z.object({ conversationId: z.string(), matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Update conversation
      await ctx.db.whatsAppConversation.update({
        where: { id: input.conversationId },
        data: { matterId: input.matterId, autoFiled: false, status: "OPEN" },
      });
      // Backfill all messages to matter
      await ctx.db.whatsAppMessage.updateMany({
        where: { conversationId: input.conversationId },
        data: { matterId: input.matterId },
      });
      return { success: true };
    }),

  unfileConversation: publicProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.whatsAppConversation.update({ where: { id: input.conversationId }, data: { matterId: null } });
      await ctx.db.whatsAppMessage.updateMany({ where: { conversationId: input.conversationId }, data: { matterId: null } });
      return { success: true };
    }),

  assignConversation: publicProcedure
    .input(z.object({ conversationId: z.string(), userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.whatsAppConversation.update({ where: { id: input.conversationId }, data: { assignedToId: input.userId } });
    }),

  resolveConversation: publicProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.whatsAppConversation.update({ where: { id: input.conversationId }, data: { status: "RESOLVED" } });
    }),

  archiveConversation: publicProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.whatsAppConversation.update({ where: { id: input.conversationId }, data: { status: "ARCHIVED" } });
    }),

  markAsRead: publicProcedure
    .input(z.object({ conversationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.whatsAppConversation.update({ where: { id: input.conversationId }, data: { unreadCount: 0 } });
      const latest = await ctx.db.whatsAppMessage.findFirst({
        where: { conversationId: input.conversationId, direction: "INBOUND" }, orderBy: { sentAt: "desc" },
      });
      if (latest) {
        try { await markMessageRead("demo-firm", latest.waMessageId); } catch {}
      }
      return { success: true };
    }),

  syncTemplates: publicProcedure.mutation(async () => syncTemplates("demo-firm")),

  testConnection: publicProcedure.mutation(async () => {
    try {
      const quality = await getPhoneNumberQuality("demo-firm");
      return { ok: true, quality };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  }),
});
