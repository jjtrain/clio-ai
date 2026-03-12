import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { generateAiChatResponse } from "@/lib/ai-chat";

const DEFAULT_SYSTEM_PROMPT = `You are a friendly and professional legal intake assistant for {firmName}. Your role is to:

1. Greet visitors warmly and ask how you can help
2. Collect their basic information: full name, email address, and phone number
3. Understand what legal issue they need help with
4. Determine which practice area best fits their needs
5. Provide a brief, helpful response without giving legal advice
6. Let them know an attorney will follow up with them

Practice areas we handle: {practiceAreas}

Important rules:
- Never provide specific legal advice
- Be empathetic and professional
- If someone seems to be in crisis or danger, provide emergency resources (911)
- If you've collected enough information (name, contact info, and issue description), let the visitor know that an attorney from our firm will be in touch shortly
- If the visitor specifically asks to speak with a human, immediately hand off the conversation

Keep responses concise (2-4 sentences typically). Be warm but efficient.`;

async function buildSystemPrompt(db: any): Promise<{ prompt: string; model: string }> {
  const [settings, chatSettings] = await Promise.all([
    db.settings.findUnique({ where: { id: "default" } }),
    db.chatWidgetSettings.findUnique({ where: { id: "default" } }),
  ]);

  const firmName = settings?.firmName || "Our Law Firm";
  const practiceAreas = chatSettings?.practiceAreas
    ? JSON.parse(chatSettings.practiceAreas).join(", ")
    : "Family Law, Criminal Defense, Personal Injury, Estate Planning, Business Law";

  const basePrompt = chatSettings?.aiSystemPrompt || DEFAULT_SYSTEM_PROMPT;
  const prompt = basePrompt
    .replace("{firmName}", firmName)
    .replace("{practiceAreas}", practiceAreas);

  return { prompt, model: chatSettings?.aiModel || "claude-sonnet-4-20250514" };
}

export const chatRouter = router({
  // ========== Public Procedures ==========

  startSession: publicProcedure
    .input(
      z.object({
        referrer: z.string().optional(),
        pageUrl: z.string().optional(),
      }).optional()
    )
    .mutation(async ({ ctx, input }) => {
      const chatSettings = await ctx.db.chatWidgetSettings.findUnique({
        where: { id: "default" },
      });

      const session = await ctx.db.chatSession.create({
        data: {
          referrer: input?.referrer || null,
          pageUrl: input?.pageUrl || null,
        },
      });

      // Create welcome message
      const welcomeMsg = chatSettings?.welcomeMessage ||
        "Hello! Welcome to our firm. How can I assist you today?";

      await ctx.db.chatMessage.create({
        data: {
          sessionId: session.id,
          role: "AI",
          content: welcomeMsg,
        },
      });

      // Auto-create lead if enabled
      let leadId: string | null = null;
      if (chatSettings?.autoCreateLead !== false) {
        const lead = await ctx.db.lead.create({
          data: {
            name: "Chat Visitor",
            source: "LIVE_CHAT",
            status: "NEW",
            priority: "MEDIUM",
            chatSessionId: session.id,
            referrer: input?.referrer || null,
          },
        });
        leadId = lead.id;

        await ctx.db.chatSession.update({
          where: { id: session.id },
          data: { leadId: lead.id },
        });

        await ctx.db.leadActivity.create({
          data: {
            leadId: lead.id,
            type: "CREATED",
            description: "Lead created from live chat session",
          },
        });
      }

      return {
        sessionId: session.id,
        welcomeMessage: welcomeMsg,
      };
    }),

  sendMessage: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.chatSession.findUnique({
        where: { id: input.sessionId },
        include: { messages: { orderBy: { createdAt: "asc" } } },
      });

      if (!session) throw new Error("Session not found");
      if (session.status === "ENDED") throw new Error("Session has ended");

      // Store visitor message
      await ctx.db.chatMessage.create({
        data: {
          sessionId: input.sessionId,
          role: "VISITOR",
          content: input.content,
        },
      });

      // If AI is handling, generate AI response
      if (session.isAiHandling) {
        const { prompt, model } = await buildSystemPrompt(ctx.db);

        const messageHistory = [
          ...session.messages.filter((m) => m.role !== "AI" || m.content !== session.messages[0]?.content ? true : true)
            .map((m) => ({
              role: m.role,
              content: m.content,
            })),
          { role: "VISITOR", content: input.content },
        ];

        const aiResponse = await generateAiChatResponse({
          messages: messageHistory,
          systemPrompt: prompt,
          model,
        });

        await ctx.db.chatMessage.create({
          data: {
            sessionId: input.sessionId,
            role: "AI",
            content: aiResponse,
          },
        });

        // Check if visitor asked for human
        const lowerContent = input.content.toLowerCase();
        if (
          lowerContent.includes("speak to a human") ||
          lowerContent.includes("talk to a person") ||
          lowerContent.includes("real person") ||
          lowerContent.includes("speak to someone") ||
          lowerContent.includes("talk to an attorney") ||
          lowerContent.includes("speak with a lawyer")
        ) {
          await ctx.db.chatSession.update({
            where: { id: input.sessionId },
            data: { status: "WAITING_FOR_AGENT", isAiHandling: false },
          });

          await ctx.db.chatMessage.create({
            data: {
              sessionId: input.sessionId,
              role: "AI",
              content: "I'm connecting you with an attorney now. Please hold on a moment.",
            },
          });
        }

        // Try to extract visitor info from conversation
        const allMessages = [...session.messages, { role: "VISITOR", content: input.content }];
        const visitorMessages = allMessages.filter((m) => m.role === "VISITOR").map((m) => m.content).join(" ");

        const emailMatch = visitorMessages.match(/[\w.-]+@[\w.-]+\.\w+/);
        const phoneMatch = visitorMessages.match(/[\d()+-][\d()+-\s]{6,}/);

        const updates: any = {};
        if (emailMatch && !session.visitorEmail) updates.visitorEmail = emailMatch[0];
        if (phoneMatch && !session.visitorPhone) updates.visitorPhone = phoneMatch[0].trim();

        // Simple name extraction: if no name yet, check for "my name is" or "I'm" patterns
        if (!session.visitorName) {
          const nameMatch = visitorMessages.match(/(?:my name is|i'm|i am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i);
          if (nameMatch) updates.visitorName = nameMatch[1];
        }

        if (Object.keys(updates).length > 0) {
          await ctx.db.chatSession.update({
            where: { id: input.sessionId },
            data: updates,
          });

          // Update linked lead if exists
          if (session.leadId) {
            const leadUpdates: any = {};
            if (updates.visitorEmail) leadUpdates.email = updates.visitorEmail;
            if (updates.visitorPhone) leadUpdates.phone = updates.visitorPhone;
            if (updates.visitorName) leadUpdates.name = updates.visitorName;
            await ctx.db.lead.update({ where: { id: session.leadId }, data: leadUpdates });
          }
        }

        return { response: aiResponse, status: session.status };
      }

      // If agent is handling, just store the message (agent will poll for it)
      return { response: null, status: session.status };
    }),

  getSession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.chatSession.findUnique({
        where: { id: input.sessionId },
        include: {
          messages: { orderBy: { createdAt: "asc" } },
        },
      });
      if (!session) throw new Error("Session not found");
      return session;
    }),

  getWidgetSettings: publicProcedure.query(async ({ ctx }) => {
    const settings = await ctx.db.chatWidgetSettings.findUnique({
      where: { id: "default" },
    });
    return {
      isEnabled: settings?.isEnabled ?? false,
      widgetColor: settings?.widgetColor ?? "#3B82F6",
      widgetPosition: settings?.widgetPosition ?? "bottom-right",
      welcomeMessage: settings?.welcomeMessage ?? "Hello! How can we help you today?",
      offlineMessage: settings?.offlineMessage ?? "We're currently offline. Please leave a message.",
      practiceAreas: settings?.practiceAreas ? JSON.parse(settings.practiceAreas) : [],
      showOfflineForm: settings?.showOfflineForm ?? true,
    };
  }),

  endSession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.chatSession.update({
        where: { id: input.sessionId },
        data: { status: "ENDED", endedAt: new Date() },
      });
    }),

  // ========== Admin Procedures ==========

  listSessions: publicProcedure
    .input(
      z.object({
        status: z.enum(["AI_HANDLING", "WAITING_FOR_AGENT", "AGENT_CONNECTED", "ENDED"]).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.status) where.status = input.status;

      const [sessions, total] = await Promise.all([
        ctx.db.chatSession.findMany({
          where,
          orderBy: { updatedAt: "desc" },
          take: input?.limit || 50,
          skip: input?.offset || 0,
          include: {
            _count: { select: { messages: true } },
            messages: { orderBy: { createdAt: "desc" }, take: 1 },
          },
        }),
        ctx.db.chatSession.count({ where }),
      ]);

      return { sessions, total };
    }),

  getSessionMessages: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.chatMessage.findMany({
        where: { sessionId: input.sessionId },
        orderBy: { createdAt: "asc" },
      });
    }),

  sendAgentMessage: publicProcedure
    .input(
      z.object({
        sessionId: z.string(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.chatSession.findUnique({
        where: { id: input.sessionId },
      });
      if (!session) throw new Error("Session not found");

      await ctx.db.chatMessage.create({
        data: {
          sessionId: input.sessionId,
          role: "AGENT",
          content: input.content,
        },
      });

      if (session.status !== "AGENT_CONNECTED") {
        await ctx.db.chatSession.update({
          where: { id: input.sessionId },
          data: { status: "AGENT_CONNECTED", isAiHandling: false },
        });
      }

      return { success: true };
    }),

  takeOverSession: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.chatSession.update({
        where: { id: input.sessionId },
        data: { status: "AGENT_CONNECTED", isAiHandling: false },
      });

      await ctx.db.chatMessage.create({
        data: {
          sessionId: input.sessionId,
          role: "AI",
          content: "An attorney has joined the conversation.",
        },
      });

      return { success: true };
    }),

  getSettings: publicProcedure.query(async ({ ctx }) => {
    let settings = await ctx.db.chatWidgetSettings.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      settings = await ctx.db.chatWidgetSettings.create({
        data: { id: "default" },
      });
    }

    return {
      ...settings,
      practiceAreas: settings.practiceAreas ? JSON.parse(settings.practiceAreas) : [],
      businessHours: settings.businessHours ? JSON.parse(settings.businessHours) : [],
    };
  }),

  updateSettings: publicProcedure
    .input(
      z.object({
        isEnabled: z.boolean().optional(),
        widgetColor: z.string().optional(),
        widgetPosition: z.string().optional(),
        welcomeMessage: z.string().optional(),
        offlineMessage: z.string().optional(),
        aiEnabled: z.boolean().optional(),
        aiSystemPrompt: z.string().optional(),
        aiModel: z.string().optional(),
        practiceAreas: z.array(z.string()).optional(),
        autoCreateLead: z.boolean().optional(),
        businessHours: z.any().optional(),
        showOfflineForm: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: any = {};
      if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;
      if (input.widgetColor) data.widgetColor = input.widgetColor;
      if (input.widgetPosition) data.widgetPosition = input.widgetPosition;
      if (input.welcomeMessage !== undefined) data.welcomeMessage = input.welcomeMessage;
      if (input.offlineMessage !== undefined) data.offlineMessage = input.offlineMessage;
      if (input.aiEnabled !== undefined) data.aiEnabled = input.aiEnabled;
      if (input.aiSystemPrompt !== undefined) data.aiSystemPrompt = input.aiSystemPrompt;
      if (input.aiModel) data.aiModel = input.aiModel;
      if (input.practiceAreas) data.practiceAreas = JSON.stringify(input.practiceAreas);
      if (input.autoCreateLead !== undefined) data.autoCreateLead = input.autoCreateLead;
      if (input.businessHours) data.businessHours = JSON.stringify(input.businessHours);
      if (input.showOfflineForm !== undefined) data.showOfflineForm = input.showOfflineForm;

      return ctx.db.chatWidgetSettings.upsert({
        where: { id: "default" },
        update: data,
        create: { id: "default", ...data },
      });
    }),
});
