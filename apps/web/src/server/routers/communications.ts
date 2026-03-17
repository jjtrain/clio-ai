import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getUnifiedInbox, getCallLog, getProviderStats, matchCallerToClient } from "@/lib/communications-engine";
import { smithAiTestConnection, smithAiGetCalls, rubyTestConnection, patliveTestConnection, dialpadTestConnection, dialpadGetCalls, caseStatusTestConnection, caseStatusCreateCase, caseStatusSendMessage, privilegeTestConnection, privilegeSendMessage, honaTestConnection, honaCreateCase } from "@/lib/integrations/comm-providers";

function maskKey(k: string | null) { return k ? "****" + k.slice(-4) : null; }

export const communicationsRouter = router({
  // ─── Settings ──────────────────────────────────────────────────
  "settings.list": publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.commIntegration.findMany({ orderBy: { provider: "asc" } });
    return all.map((i) => ({ ...i, apiKey: maskKey(i.apiKey), apiSecret: maskKey(i.apiSecret) }));
  }),
  "settings.update": publicProcedure
    .input(z.object({ provider: z.string(), displayName: z.string().optional(), apiKey: z.string().optional().nullable(), apiSecret: z.string().optional().nullable(), baseUrl: z.string().optional().nullable(), accountId: z.string().optional().nullable(), phoneNumber: z.string().optional().nullable(), isEnabled: z.boolean().optional(), settings: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { provider, ...data } = input;
      const clean: any = { ...data };
      if (clean.apiKey?.startsWith("****")) delete clean.apiKey;
      if (clean.apiSecret?.startsWith("****")) delete clean.apiSecret;
      return ctx.db.commIntegration.upsert({ where: { provider }, create: { provider, displayName: input.displayName || provider, ...clean }, update: clean });
    }),
  "settings.test": publicProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ input }) => {
      const tests: Record<string, () => Promise<any>> = { SMITH_AI: smithAiTestConnection, RUBY_RECEPTIONISTS: rubyTestConnection, PATLIVE: patliveTestConnection, DIALPAD: dialpadTestConnection, CASE_STATUS: caseStatusTestConnection, PRIVILEGE_LAW: privilegeTestConnection, HONA: honaTestConnection };
      const fn = tests[input.provider];
      if (!fn) return { success: false, error: "Unknown provider" };
      return fn();
    }),

  // ─── Unified Inbox ─────────────────────────────────────────────
  inbox: publicProcedure.query(async () => getUnifiedInbox()),
  "inbox.markHandled": publicProcedure
    .input(z.object({ type: z.string(), recordId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.type === "call") await ctx.db.callRecord.update({ where: { id: input.recordId }, data: { actionRequired: false, actionCompletedAt: new Date() } });
      if (input.type === "chat") await ctx.db.chatConversation.update({ where: { id: input.recordId }, data: { status: "RESOLVED" } });
      if (input.type === "message") await ctx.db.secureMessage.update({ where: { id: input.recordId }, data: { isRead: true, readAt: new Date() } });
      return { success: true };
    }),

  // ─── Calls ─────────────────────────────────────────────────────
  "calls.list": publicProcedure
    .input(z.object({ provider: z.string().optional(), matterId: z.string().optional(), clientId: z.string().optional(), status: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.provider) where.provider = input.provider;
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.clientId) where.clientId = input.clientId;
      if (input?.status) where.status = input.status;
      return ctx.db.callRecord.findMany({ where, orderBy: { startedAt: "desc" }, take: input?.limit || 50 });
    }),
  "calls.getById": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.callRecord.findUniqueOrThrow({ where: { id: input.id } })),
  "calls.linkToMatter": publicProcedure
    .input(z.object({ callId: z.string(), matterId: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.callRecord.update({ where: { id: input.callId }, data: { matterId: input.matterId } })),
  "calls.completeAction": publicProcedure
    .input(z.object({ callId: z.string(), completedBy: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.callRecord.update({ where: { id: input.callId }, data: { actionRequired: false, actionCompletedAt: new Date(), actionDescription: input.completedBy } })),
  "calls.addNote": publicProcedure
    .input(z.object({ callId: z.string(), note: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const call = await ctx.db.callRecord.findUniqueOrThrow({ where: { id: input.callId } });
      return ctx.db.callRecord.update({ where: { id: input.callId }, data: { summary: (call.summary || "") + "\n\nNote: " + input.note } });
    }),

  // ─── Chats ─────────────────────────────────────────────────────
  "chats.list": publicProcedure
    .input(z.object({ provider: z.string().optional(), status: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.provider) where.provider = input.provider;
      if (input?.status) where.status = input.status;
      return ctx.db.chatConversation.findMany({ where, include: { messages: { orderBy: { timestamp: "desc" }, take: 1 } }, orderBy: { startedAt: "desc" }, take: input?.limit || 50 });
    }),
  "chats.getById": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.chatConversation.findUniqueOrThrow({ where: { id: input.id }, include: { messages: { orderBy: { timestamp: "asc" } } } })),
  "chats.resolve": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.chatConversation.update({ where: { id: input.id }, data: { status: "RESOLVED", endedAt: new Date() } })),

  // ─── VoIP (Dialpad) ───────────────────────────────────────────
  "dialpad.calls.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      return ctx.db.voIPCall.findMany({ where, orderBy: { startedAt: "desc" }, take: input?.limit || 50 });
    }),
  "dialpad.calls.getById": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.voIPCall.findUniqueOrThrow({ where: { id: input.id } })),

  // ─── Client Portals ────────────────────────────────────────────
  "portals.list": publicProcedure
    .input(z.object({ provider: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.provider) where.provider = input.provider;
      return ctx.db.clientPortalConnection.findMany({ where, orderBy: { lastActivityAt: "desc" } });
    }),
  "portals.create": publicProcedure
    .input(z.object({ provider: z.string(), matterId: z.string(), clientId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const client = await ctx.db.client.findUniqueOrThrow({ where: { id: input.clientId } });
      const matter = await ctx.db.matter.findUniqueOrThrow({ where: { id: input.matterId } });
      let result: any = null;
      if (input.provider === "CASE_STATUS") result = await caseStatusCreateCase({ clientName: client.name, clientEmail: client.email || "", caseName: matter.name, caseType: matter.practiceArea || "General", stage: matter.pipelineStage });
      if (input.provider === "HONA") result = await honaCreateCase({ clientName: client.name, clientEmail: client.email || "", caseName: matter.name, caseType: matter.practiceArea || "General" });
      return ctx.db.clientPortalConnection.create({
        data: { provider: input.provider, matterId: input.matterId, clientId: input.clientId, externalCaseId: result?.success ? (result.data?.caseId || result.data?.id) : undefined, portalUrl: result?.success ? (result.data?.portalUrl || result.data?.portal_url) : undefined },
      });
    }),
  "portals.sendMessage": publicProcedure
    .input(z.object({ connectionId: z.string(), message: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const conn = await ctx.db.clientPortalConnection.findUniqueOrThrow({ where: { id: input.connectionId } });
      if (conn.provider === "CASE_STATUS" && conn.externalCaseId) await caseStatusSendMessage(conn.externalCaseId, input.message);
      await ctx.db.clientPortalConnection.update({ where: { id: input.connectionId }, data: { messageCount: { increment: 1 }, lastActivityAt: new Date() } });
      return { success: true };
    }),

  // ─── Secure Messaging ──────────────────────────────────────────
  "secure.list": publicProcedure
    .input(z.object({ clientId: z.string().optional(), isRead: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.clientId) where.clientId = input.clientId;
      if (input?.isRead !== undefined) where.isRead = input.isRead;
      return ctx.db.secureMessage.findMany({ where, orderBy: { sentAt: "desc" }, take: 50 });
    }),
  "secure.send": publicProcedure
    .input(z.object({ clientId: z.string(), subject: z.string().optional(), body: z.string(), matterId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await privilegeSendMessage({ clientId: input.clientId, body: input.body, subject: input.subject });
      return ctx.db.secureMessage.create({ data: { clientId: input.clientId, matterId: input.matterId, direction: "TO_CLIENT", subject: input.subject, body: input.body, sentAt: new Date() } });
    }),
  "secure.markRead": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.secureMessage.update({ where: { id: input.id }, data: { isRead: true, readAt: new Date() } })),

  // ─── Screening Rules ───────────────────────────────────────────
  "screening.list": publicProcedure
    .input(z.object({ provider: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.provider) where.provider = input.provider;
      return ctx.db.receptionistScreeningRule.findMany({ where, orderBy: { priority: "desc" } });
    }),
  "screening.create": publicProcedure
    .input(z.object({ provider: z.string(), ruleType: z.string(), name: z.string(), conditions: z.string(), action: z.string(), transferTo: z.string().optional(), priority: z.number().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.receptionistScreeningRule.create({ data: input })),
  "screening.update": publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), conditions: z.string().optional(), action: z.string().optional(), transferTo: z.string().optional().nullable(), isActive: z.boolean().optional(), priority: z.number().optional() }))
    .mutation(async ({ ctx, input }) => { const { id, ...data } = input; return ctx.db.receptionistScreeningRule.update({ where: { id }, data }); }),
  "screening.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.receptionistScreeningRule.delete({ where: { id: input.id } })),

  // ─── Reports ───────────────────────────────────────────────────
  "reports.overview": publicProcedure.query(async () => getProviderStats()),
  "reports.callVolume": publicProcedure
    .input(z.object({ startDate: z.string().optional(), endDate: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.startDate || input?.endDate) { where.startedAt = {}; if (input?.startDate) where.startedAt.gte = new Date(input.startDate); if (input?.endDate) where.startedAt.lte = new Date(input.endDate); }
      const calls = await ctx.db.callRecord.findMany({ where, select: { startedAt: true, provider: true } });
      const byDay: Record<string, number> = {};
      for (const c of calls) { const d = new Date(c.startedAt).toISOString().split("T")[0]; byDay[d] = (byDay[d] || 0) + 1; }
      return { byDay, total: calls.length };
    }),

  // ─── Dashboard Stats ───────────────────────────────────────────
  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const callsToday = await ctx.db.callRecord.count({ where: { startedAt: { gte: today } } });
    const activeChats = await ctx.db.chatConversation.count({ where: { status: { in: ["ACTIVE", "WAITING"] } } });
    const unreadMessages = await ctx.db.secureMessage.count({ where: { isRead: false, direction: "FROM_CLIENT" } });
    const leadsToday = await ctx.db.callRecord.count({ where: { startedAt: { gte: today }, disposition: "NEW_LEAD" } });
    const satisfaction = await ctx.db.clientPortalConnection.aggregate({ _avg: { clientSatisfactionScore: true } });
    return { callsToday, activeChats, unreadMessages, leadsToday, avgSatisfaction: Number(satisfaction._avg.clientSatisfactionScore || 0) };
  }),
});
