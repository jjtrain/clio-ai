import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  getTwilioConfig,
  sendSms,
  formatPhoneNumber,
  testTwilioConnection,
} from "@/lib/twilio";

const STARTER_TEMPLATES = [
  { name: "Appointment Reminder", category: "Reminder", shortcode: "/appt", content: "Hi {NAME}, this is a reminder about your appointment with {FIRM_NAME} on {DATE} at {TIME}. Please reply to confirm or call us to reschedule." },
  { name: "Follow Up", category: "Follow-up", shortcode: "/followup", content: "Hi {NAME}, this is {FIRM_NAME} following up on your inquiry. We'd love to help you with your legal matter. Please call us or reply to this message to schedule a consultation." },
  { name: "Payment Reminder", category: "Payment", shortcode: "/payment", content: "Hi {NAME}, this is {FIRM_NAME}. We wanted to remind you about your outstanding balance. Please contact our office or visit our portal to make a payment. Thank you." },
  { name: "Document Request", category: "General", shortcode: "/docs", content: "Hi {NAME}, {FIRM_NAME} here. We need some documents from you for your {MATTER} case. Please send them to our office at your earliest convenience. Reply with any questions." },
  { name: "Consultation Booked", category: "Scheduling", shortcode: "/booked", content: "Hi {NAME}, your consultation with {FIRM_NAME} has been scheduled for {DATE} at {TIME}. We look forward to speaking with you." },
  { name: "General Check-in", category: "General", shortcode: "/checkin", content: "Hi {NAME}, {FIRM_NAME} here. Just checking in on your case. If you have any questions or updates, please don't hesitate to reach out." },
];

async function ensureStarterTemplates(db: any) {
  const count = await db.textTemplate.count();
  if (count === 0) {
    await db.textTemplate.createMany({ data: STARTER_TEMPLATES });
  }
}

export const messagingRouter = router({
  // ==================== CONVERSATIONS ====================

  listConversations: publicProcedure
    .input(z.object({
      isArchived: z.boolean().optional(),
      search: z.string().optional(),
      matterId: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.isArchived !== undefined) where.isArchived = input.isArchived;
      else where.isArchived = false;
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.search) {
        where.OR = [
          { client: { name: { contains: input.search, mode: "insensitive" } } },
          { clientPhone: { contains: input.search } },
        ];
      }

      return ctx.db.textConversation.findMany({
        where,
        orderBy: { lastMessageAt: { sort: "desc", nulls: "last" } },
        include: {
          client: { select: { id: true, name: true, phone: true } },
        },
      });
    }),

  getConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const conversation = await ctx.db.textConversation.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          client: { select: { id: true, name: true, phone: true, email: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 50,
          },
        },
      });
      return {
        ...conversation,
        messages: conversation.messages.reverse(),
      };
    }),

  getOrCreateConversation: publicProcedure
    .input(z.object({
      clientId: z.string(),
      clientPhone: z.string(),
      matterId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const config = await getTwilioConfig();
      const firmPhone = config?.phoneNumber || "";
      const phone = formatPhoneNumber(input.clientPhone);

      // Try to find existing
      const existing = await ctx.db.textConversation.findUnique({
        where: { clientPhone_firmPhone: { clientPhone: phone, firmPhone } },
      });
      if (existing) return existing;

      return ctx.db.textConversation.create({
        data: {
          clientId: input.clientId,
          clientPhone: phone,
          firmPhone,
          matterId: input.matterId || null,
        },
      });
    }),

  archiveConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.textConversation.update({
        where: { id: input.id },
        data: { isArchived: true },
      });
    }),

  unarchiveConversation: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.textConversation.update({
        where: { id: input.id },
        data: { isArchived: false },
      });
    }),

  markConversationRead: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.textMessage.updateMany({
        where: { conversationId: input.id, direction: "INBOUND", isRead: false },
        data: { isRead: true, readAt: new Date() },
      });
      return ctx.db.textConversation.update({
        where: { id: input.id },
        data: { unreadCount: 0 },
      });
    }),

  // ==================== MESSAGES ====================

  sendMessage: publicProcedure
    .input(z.object({
      conversationId: z.string(),
      body: z.string().min(1),
      matterId: z.string().optional(),
      mediaUrl: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const conversation = await ctx.db.textConversation.findUniqueOrThrow({
        where: { id: input.conversationId },
      });

      if (conversation.isOptedOut) {
        throw new Error("This client has opted out of text messages. Cannot send.");
      }

      const config = await getTwilioConfig();
      if (!config) throw new Error("Text messaging is not configured. Please add Twilio credentials in Settings.");

      let body = input.body;

      // Check if first outbound and consent required
      if (config.requireConsent) {
        const priorOutbound = await ctx.db.textMessage.count({
          where: { conversationId: input.conversationId, direction: "OUTBOUND" },
        });
        if (priorOutbound === 0 && config.consentMessage) {
          // Send consent message first
          const consentBody = config.consentMessage
            .replace(/\{FIRM_NAME\}/g, config.defaultSignature?.replace(/^-\s*/, "") || "Our Firm");
          const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || "";
          await sendSms(config, conversation.clientPhone, consentBody, undefined, `${baseUrl}/api/twilio/status`);
        }
      }

      // Append signature
      if (config.defaultSignature) {
        body = `${body}\n${config.defaultSignature}`;
      }

      // Send via Twilio
      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || "";
      const result = await sendSms(
        config,
        conversation.clientPhone,
        body,
        input.mediaUrl,
        `${baseUrl}/api/twilio/status`
      );

      // Create message record
      const message = await ctx.db.textMessage.create({
        data: {
          conversationId: input.conversationId,
          clientId: conversation.clientId,
          matterId: input.matterId || conversation.matterId || null,
          direction: "OUTBOUND" as any,
          fromNumber: config.phoneNumber,
          toNumber: conversation.clientPhone,
          body: input.body,
          status: result.success ? "SENT" : "FAILED",
          externalId: result.messageId || null,
          errorMessage: result.error || null,
          sentAt: result.success ? new Date() : null,
          mediaUrl: input.mediaUrl || null,
        },
      });

      // Update conversation
      await ctx.db.textConversation.update({
        where: { id: input.conversationId },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: input.body.substring(0, 100),
        },
      });

      return message;
    }),

  getMessages: publicProcedure
    .input(z.object({
      conversationId: z.string(),
      limit: z.number().min(1).max(100).default(50),
      cursor: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const messages = await ctx.db.textMessage.findMany({
        where: { conversationId: input.conversationId },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      });

      let nextCursor: string | undefined;
      if (messages.length > input.limit) {
        const next = messages.pop();
        nextCursor = next?.id;
      }

      return { messages: messages.reverse(), nextCursor };
    }),

  getMessagesByClient: publicProcedure
    .input(z.object({ clientId: z.string(), limit: z.number().default(20) }))
    .query(async ({ ctx, input }) => {
      return ctx.db.textMessage.findMany({
        where: { clientId: input.clientId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  getMessagesByMatter: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.textMessage.findMany({
        where: { matterId: input.matterId },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }),

  deleteMessage: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.textMessage.delete({ where: { id: input.id } });
    }),

  retryFailed: publicProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const message = await ctx.db.textMessage.findUniqueOrThrow({ where: { id: input.messageId } });
      if (message.status !== "FAILED") throw new Error("Only failed messages can be retried");

      const config = await getTwilioConfig();
      if (!config) throw new Error("Text messaging is not configured");

      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || "";
      const result = await sendSms(config, message.toNumber, message.body, message.mediaUrl || undefined, `${baseUrl}/api/twilio/status`);

      return ctx.db.textMessage.update({
        where: { id: input.messageId },
        data: {
          status: result.success ? "SENT" : "FAILED",
          externalId: result.messageId || message.externalId,
          errorMessage: result.error || null,
          sentAt: result.success ? new Date() : null,
        },
      });
    }),

  // ==================== QUICK SEND ====================

  quickSend: publicProcedure
    .input(z.object({
      clientId: z.string(),
      body: z.string().min(1),
      matterId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.db.client.findUniqueOrThrow({ where: { id: input.clientId } });
      if (!client.phone) throw new Error("Client has no phone number on file");

      const config = await getTwilioConfig();
      if (!config) throw new Error("Text messaging is not configured");

      const phone = formatPhoneNumber(client.phone);

      // Get or create conversation
      let conversation = await ctx.db.textConversation.findUnique({
        where: { clientPhone_firmPhone: { clientPhone: phone, firmPhone: config.phoneNumber } },
      });
      if (!conversation) {
        conversation = await ctx.db.textConversation.create({
          data: {
            clientId: input.clientId,
            clientPhone: phone,
            firmPhone: config.phoneNumber,
            matterId: input.matterId || null,
          },
        });
      }

      // Use sendMessage logic
      let body = input.body;
      if (config.defaultSignature) body = `${body}\n${config.defaultSignature}`;

      const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_URL || "";
      const result = await sendSms(config, phone, body, undefined, `${baseUrl}/api/twilio/status`);

      const message = await ctx.db.textMessage.create({
        data: {
          conversationId: conversation.id,
          clientId: input.clientId,
          matterId: input.matterId || null,
          direction: "OUTBOUND" as any,
          fromNumber: config.phoneNumber,
          toNumber: phone,
          body: input.body,
          status: result.success ? "SENT" : "FAILED",
          externalId: result.messageId || null,
          errorMessage: result.error || null,
          sentAt: result.success ? new Date() : null,
        },
      });

      await ctx.db.textConversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date(), lastMessagePreview: input.body.substring(0, 100) },
      });

      return { message, conversationId: conversation.id };
    }),

  // ==================== TEMPLATES ====================

  listTemplates: publicProcedure.query(async ({ ctx }) => {
    await ensureStarterTemplates(ctx.db);
    return ctx.db.textTemplate.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
  }),

  getTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.textTemplate.findUniqueOrThrow({ where: { id: input.id } });
    }),

  createTemplate: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      content: z.string().min(1),
      category: z.string().optional(),
      shortcode: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.textTemplate.create({ data: input });
    }),

  updateTemplate: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      content: z.string().optional(),
      category: z.string().optional(),
      shortcode: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.textTemplate.update({ where: { id }, data });
    }),

  deleteTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.textTemplate.delete({ where: { id: input.id } });
    }),

  applyTemplate: publicProcedure
    .input(z.object({
      templateId: z.string(),
      clientName: z.string().optional(),
      matterName: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const template = await ctx.db.textTemplate.findUniqueOrThrow({ where: { id: input.templateId } });
      const firmSettings = await ctx.db.settings.findUnique({ where: { id: "default" } }).catch(() => null);

      let content = template.content
        .replace(/\{NAME\}/g, input.clientName || "[Client]")
        .replace(/\{MATTER\}/g, input.matterName || "[Matter]")
        .replace(/\{FIRM_NAME\}/g, (firmSettings as any)?.firmName || "[Firm]")
        .replace(/\{DATE\}/g, new Date().toLocaleDateString())
        .replace(/\{TIME\}/g, new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));

      // Increment usage
      await ctx.db.textTemplate.update({ where: { id: input.templateId }, data: { usageCount: { increment: 1 } } });

      return { content };
    }),

  // ==================== SETTINGS ====================

  getSettings: publicProcedure.query(async ({ ctx }) => {
    let settings = await ctx.db.textMessageSettings.findUnique({ where: { id: "default" } });
    if (!settings) {
      settings = await ctx.db.textMessageSettings.create({ data: { id: "default" } });
    }
    return {
      ...settings,
      twilioAuthToken: settings.twilioAuthToken ? "••••••••" : null,
    };
  }),

  updateSettings: publicProcedure
    .input(z.object({
      isEnabled: z.boolean().optional(),
      twilioAccountSid: z.string().optional(),
      twilioAuthToken: z.string().optional(),
      twilioPhoneNumber: z.string().optional(),
      defaultSignature: z.string().optional(),
      autoReplyEnabled: z.boolean().optional(),
      autoReplyMessage: z.string().optional(),
      autoReplyOutsideHours: z.boolean().optional(),
      businessHours: z.string().optional(),
      messageRetentionDays: z.number().optional(),
      consentMessage: z.string().optional(),
      requireConsent: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const data: any = {};
      Object.entries(input).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === "twilioAuthToken" && (value as string).startsWith("••")) return;
          data[key] = value;
        }
      });
      return ctx.db.textMessageSettings.upsert({
        where: { id: "default" },
        update: data,
        create: { id: "default", ...data },
      });
    }),

  testConnection: publicProcedure.mutation(async ({ ctx }) => {
    const settings = await ctx.db.textMessageSettings.findUnique({ where: { id: "default" } });
    if (!settings?.twilioAccountSid || !settings?.twilioAuthToken) {
      throw new Error("Twilio credentials not configured");
    }
    return testTwilioConnection(settings.twilioAccountSid, settings.twilioAuthToken);
  }),

  // ==================== STATS ====================

  getStats: publicProcedure
    .input(z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const dateFilter: any = {};
      if (input?.startDate) dateFilter.gte = new Date(input.startDate);
      if (input?.endDate) dateFilter.lte = new Date(input.endDate);
      const where = Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {};

      const [totalSent, totalReceived, totalFailed, conversations] = await Promise.all([
        ctx.db.textMessage.count({ where: { ...where, direction: "OUTBOUND", status: { not: "FAILED" } } }),
        ctx.db.textMessage.count({ where: { ...where, direction: "INBOUND" } }),
        ctx.db.textMessage.count({ where: { ...where, status: "FAILED" } }),
        ctx.db.textConversation.count(),
      ]);

      return { totalSent, totalReceived, totalFailed, conversations };
    }),
});
