import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import * as gmail from "@/lib/integrations/gmail";
import * as outlook from "@/lib/integrations/outlook";
import * as engine from "@/lib/email-engine";
import { db } from "@/lib/db";

export const emailRouter = router({
  // ─── Settings ───────────────────────────────────────────────────
  "settings.list": publicProcedure.query(async () => {
    return db.emailIntegration.findMany();
  }),
  "settings.get": publicProcedure
    .input(z.object({ provider: z.string() }))
    .query(async ({ input }) => db.emailIntegration.findUnique({ where: { provider: input.provider as any } })),
  "settings.update": publicProcedure
    .input(z.object({ provider: z.string(), isEnabled: z.boolean().optional(), email: z.string().optional(), accessToken: z.string().optional().nullable(), refreshToken: z.string().optional().nullable(), syncInterval: z.number().optional(), settings: z.string().optional().nullable() }))
    .mutation(async ({ input }) => {
      const { provider, ...data } = input;
      return db.emailIntegration.upsert({ where: { provider: provider as any }, create: { provider: provider as any, displayName: provider, ...data }, update: data });
    }),
  "settings.test": publicProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ input }) => {
      return input.provider === "GMAIL" ? gmail.testConnection() : outlook.testConnection();
    }),
  "settings.getSignature": publicProcedure
    .input(z.object({ provider: z.string() }))
    .query(async ({ input }) => {
      const integration = await db.emailIntegration.findUnique({ where: { provider: input.provider as any } });
      return { signatureHtml: integration?.signatureHtml ?? null };
    }),
  "settings.updateSignature": publicProcedure
    .input(z.object({ provider: z.string(), signatureHtml: z.string() }))
    .mutation(async ({ input }) => db.emailIntegration.update({ where: { provider: input.provider as any }, data: { signatureHtml: input.signatureHtml } })),

  // ─── Messages ──────────────────────────────────────────────────
  "messages.list": publicProcedure
    .input(z.object({ provider: z.string().optional(), matterId: z.string().optional(), clientId: z.string().optional(), folder: z.string().optional(), isRead: z.boolean().optional(), isInbound: z.boolean().optional(), isSent: z.boolean().optional(), hasAttachments: z.boolean().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional(), from: z.string().optional(), subject: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.provider) where.provider = input.provider as any;
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.clientId) where.clientId = input.clientId;
      if (input?.folder) where.folder = input.folder;
      if (input?.isRead !== undefined) where.isRead = input.isRead;
      if (input?.isInbound !== undefined) where.isInbound = input.isInbound;
      if (input?.isSent !== undefined) where.isSent = input.isSent;
      if (input?.hasAttachments) where.emailAttachments = { some: {} };
      if (input?.dateFrom || input?.dateTo) where.date = { ...(input?.dateFrom ? { gte: new Date(input.dateFrom) } : {}), ...(input?.dateTo ? { lte: new Date(input.dateTo) } : {}) };
      if (input?.from) where.fromAddress = { contains: input.from };
      if (input?.subject) where.subject = { contains: input.subject };
      return db.emailMessage.findMany({ where, orderBy: { date: "desc" }, take: input?.limit || 50 });
    }),
  "messages.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => db.emailMessage.findUniqueOrThrow({ where: { id: input.id }, include: { emailAttachments: true } })),
  "messages.send": publicProcedure
    .input(z.object({ to: z.string(), subject: z.string(), body: z.string(), cc: z.string().optional(), bcc: z.string().optional(), matterId: z.string().optional(), provider: z.string().optional(), templateId: z.string().optional(), scheduledFor: z.string().optional() }).passthrough())
    .mutation(async ({ input }) => engine.sendEmail(input as any)),
  "messages.reply": publicProcedure
    .input(z.object({ messageId: z.string(), body: z.string(), cc: z.string().optional(), bcc: z.string().optional() }))
    .mutation(async ({ input }) => engine.replyToEmail(input.messageId, input.body)),
  "messages.forward": publicProcedure
    .input(z.object({ messageId: z.string(), to: z.string(), body: z.string().optional() }))
    .mutation(async ({ input }) => engine.forwardEmail(input.messageId, input.to, input.body)),
  "messages.createDraft": publicProcedure
    .input(z.object({ provider: z.string(), to: z.string().optional(), subject: z.string().optional(), body: z.string().optional() }))
    .mutation(async ({ input }) => {
      return input.provider === "GMAIL" ? gmail.createDraft(input as any) : outlook.createDraft(input as any);
    }),
  "messages.updateDraft": publicProcedure
    .input(z.object({ id: z.string(), to: z.string().optional(), subject: z.string().optional(), body: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.emailMessage.update({ where: { id }, data });
    }),
  "messages.sendDraft": publicProcedure
    .input(z.object({ id: z.string(), provider: z.string() }))
    .mutation(async ({ input }) => {
      return input.provider === "GMAIL" ? gmail.sendDraft(input.id) : outlook.sendDraft(input.id);
    }),
  "messages.deleteDraft": publicProcedure
    .input(z.object({ id: z.string(), provider: z.string(), externalId: z.string().optional() }))
    .mutation(async ({ input }) => {
      if (input.externalId) {
        input.provider === "GMAIL" ? await gmail.trashMessage(input.externalId) : await outlook.deleteMessage(input.externalId);
      }
      return db.emailMessage.delete({ where: { id: input.id } });
    }),
  "messages.markRead": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => db.emailMessage.update({ where: { id: input.id }, data: { isRead: true } })),
  "messages.markUnread": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => db.emailMessage.update({ where: { id: input.id }, data: { isRead: false } })),
  "messages.star": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => db.emailMessage.update({ where: { id: input.id }, data: { isStarred: true } })),
  "messages.unstar": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => db.emailMessage.update({ where: { id: input.id }, data: { isStarred: false } })),
  "messages.archive": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => db.emailMessage.update({ where: { id: input.id }, data: { isArchived: true } })),
  "messages.trash": publicProcedure
    .input(z.object({ id: z.string(), provider: z.string(), externalId: z.string() }))
    .mutation(async ({ input }) => {
      input.provider === "GMAIL" ? await gmail.trashMessage(input.externalId) : await outlook.deleteMessage(input.externalId);
      return db.emailMessage.update({ where: { id: input.id }, data: { folder: "TRASH" } });
    }),
  "messages.batchMarkRead": publicProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ input }) => db.emailMessage.updateMany({ where: { id: { in: input.ids } }, data: { isRead: true } })),
  "messages.batchArchive": publicProcedure
    .input(z.object({ ids: z.array(z.string()) }))
    .mutation(async ({ input }) => db.emailMessage.updateMany({ where: { id: { in: input.ids } }, data: { isArchived: true } })),
  "messages.batchFileToMatter": publicProcedure
    .input(z.object({ ids: z.array(z.string()), matterId: z.string() }))
    .mutation(async ({ input }) => db.emailMessage.updateMany({ where: { id: { in: input.ids } }, data: { matterId: input.matterId } })),

  // ─── Filing ────────────────────────────────────────────────────
  "filing.fileToMatter": publicProcedure
    .input(z.object({ messageId: z.string(), matterId: z.string() }))
    .mutation(async ({ input }) => engine.fileEmailToMatter(input.messageId, input.matterId)),
  "filing.fileThreadToMatter": publicProcedure
    .input(z.object({ threadId: z.string(), matterId: z.string() }))
    .mutation(async ({ input }) => db.emailMessage.updateMany({ where: { externalThreadId: input.threadId }, data: { matterId: input.matterId } })),
  "filing.unfiled": publicProcedure.query(async () => engine.getUnfiledEmails()),
  "filing.autoFileAll": publicProcedure.mutation(async () => {
    const unfiled = await engine.getUnfiledEmails();
    const messages = (unfiled as any)?.data || [];
    const results = await Promise.all(messages.map((msg: any) => engine.autoFileEmail(msg.id)));
    return { processed: messages.length, results };
  }),
  "filing.suggestMatter": publicProcedure
    .input(z.object({ messageId: z.string() }))
    .query(async ({ input }) => {
      const msg = await db.emailMessage.findUniqueOrThrow({ where: { id: input.messageId } });
      const matters = await db.matter.findMany({ where: { client: { email: { contains: (msg as any).fromAddress } } }, take: 5 });
      return { suggestions: matters };
    }),

  // ─── Threads ───────────────────────────────────────────────────
  "threads.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), provider: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.provider) where.provider = input.provider as any;
      return db.emailThread.findMany({ where, orderBy: { lastMessageDate: "desc" }, take: input?.limit || 50 });
    }),
  "threads.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const thread = await db.emailThread.findUniqueOrThrow({ where: { id: input.id } });
      const messages = await db.emailMessage.findMany({ where: { externalThreadId: input.id }, orderBy: { date: "asc" } });
      return { ...thread, messages };
    }),
  "threads.fileToMatter": publicProcedure
    .input(z.object({ id: z.string(), matterId: z.string() }))
    .mutation(async ({ input }) => {
      await db.emailThread.update({ where: { id: input.id }, data: { matterId: input.matterId } });
      await db.emailMessage.updateMany({ where: { externalThreadId: input.id }, data: { matterId: input.matterId } });
      return { success: true };
    }),
  "threads.summarize": publicProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ input }) => engine.summarizeThread(input.threadId)),

  // ─── Attachments ───────────────────────────────────────────────
  "attachments.list": publicProcedure
    .input(z.object({ messageId: z.string() }))
    .query(async ({ input }) => db.emailAttachment.findMany({ where: { messageId: input.messageId } })),
  "attachments.download": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const attachment = await db.emailAttachment.findUniqueOrThrow({ where: { id: input.id } });
      return { id: attachment.id, filename: (attachment as any).filename, contentType: (attachment as any).contentType, downloadUrl: `/api/attachments/${attachment.id}/download` };
    }),
  "attachments.saveToMatter": publicProcedure
    .input(z.object({ attachmentId: z.string(), matterId: z.string() }))
    .mutation(async ({ input }) => engine.saveAttachmentToMatter(input.attachmentId, 0, input.matterId)),
  "attachments.saveAllToMatter": publicProcedure
    .input(z.object({ messageId: z.string(), matterId: z.string() }))
    .mutation(async ({ input }) => {
      const attachments = await db.emailAttachment.findMany({ where: { messageId: input.messageId } });
      const results = await Promise.all(attachments.map((a, i) => engine.saveAttachmentToMatter(input.messageId, i, input.matterId)));
      return { saved: results.length, results };
    }),

  // ─── Labels ────────────────────────────────────────────────────
  "labels.list": publicProcedure
    .input(z.object({ provider: z.string() }))
    .query(async ({ input }) => db.emailLabel.findMany({ where: { provider: input.provider as any } })),
  "labels.create": publicProcedure
    .input(z.object({ provider: z.string(), name: z.string(), color: z.string().optional() }))
    .mutation(async ({ input }) => {
      input.provider === "GMAIL" ? await gmail.createLabel(input.name) : await outlook.createFolder(input.name);
      return db.emailLabel.create({ data: { provider: input.provider as any, externalLabelId: input.name, name: input.name, color: input.color } });
    }),
  "labels.createForMatter": publicProcedure
    .input(z.object({ matterId: z.string(), provider: z.string() }))
    .mutation(async ({ input }) => {
      const matter = await db.matter.findUniqueOrThrow({ where: { id: input.matterId } });
      const name = `Matter: ${(matter as any).name || (matter as any).title}`;
      input.provider === "GMAIL" ? await gmail.createLabel(name) : await outlook.createFolder(name);
      return db.emailLabel.create({ data: { provider: input.provider as any, externalLabelId: name, name, matterId: input.matterId } });
    }),
  "labels.update": publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), color: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.emailLabel.update({ where: { id }, data });
    }),
  "labels.delete": publicProcedure
    .input(z.object({ id: z.string(), provider: z.string(), externalId: z.string().optional() }))
    .mutation(async ({ input }) => {
      if (input.externalId) {
        input.provider === "GMAIL" ? await gmail.deleteLabel(input.externalId) : await outlook.createFolder(input.externalId);
      }
      return db.emailLabel.delete({ where: { id: input.id } });
    }),
  "labels.applyToMessage": publicProcedure
    .input(z.object({ messageId: z.string(), labelId: z.string(), provider: z.string(), externalMessageId: z.string().optional() }))
    .mutation(async ({ input }) => {
      if (input.externalMessageId && input.provider === "GMAIL") await gmail.modifyMessage(input.externalMessageId, [input.labelId], []);
      return db.emailMessage.update({ where: { id: input.messageId }, data: {} });
    }),
  "labels.removeFromMessage": publicProcedure
    .input(z.object({ messageId: z.string(), labelId: z.string(), provider: z.string(), externalMessageId: z.string().optional() }))
    .mutation(async ({ input }) => {
      if (input.externalMessageId && input.provider === "GMAIL") await gmail.modifyMessage(input.externalMessageId, [], [input.labelId]);
      const msg = await db.emailMessage.findUniqueOrThrow({ where: { id: input.messageId } });
      const labels = ((msg as any).labels || []).filter((l: string) => l !== input.labelId);
      return db.emailMessage.update({ where: { id: input.messageId }, data: { labels } });
    }),

  // ─── Templates ─────────────────────────────────────────────────
  "templates.list": publicProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.category) where.category = input.category;
      return db.emailComposeTemplate.findMany({ where, orderBy: { name: "asc" } });
    }),
  "templates.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => db.emailComposeTemplate.findUniqueOrThrow({ where: { id: input.id } })),
  "templates.create": publicProcedure
    .input(z.object({ name: z.string(), subject: z.string(), bodyHtml: z.string(), category: z.string().optional() }))
    .mutation(async ({ input }) => db.emailComposeTemplate.create({ data: input })),
  "templates.update": publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), subject: z.string().optional(), body: z.string().optional(), category: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.emailComposeTemplate.update({ where: { id }, data });
    }),
  "templates.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => db.emailComposeTemplate.delete({ where: { id: input.id } })),
  "templates.preview": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const template = await db.emailComposeTemplate.findUniqueOrThrow({ where: { id: input.id } });
      const vars: Record<string, string> = { "{{clientName}}": "Jane Doe", "{{matterName}}": "Sample Matter", "{{firmName}}": "Acme Law", "{{date}}": new Date().toLocaleDateString() };
      let rendered = (template as any).body || "";
      for (const [key, val] of Object.entries(vars)) rendered = rendered.replaceAll(key, val);
      return { subject: (template as any).subject, body: rendered };
    }),
  "templates.initialize": publicProcedure.mutation(async () => engine.initializeDefaultTemplates()),

  // ─── Rules ─────────────────────────────────────────────────────
  "rules.list": publicProcedure.query(async () => db.emailRule.findMany({ orderBy: { priority: "asc" } })),
  "rules.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => db.emailRule.findUniqueOrThrow({ where: { id: input.id } })),
  "rules.create": publicProcedure
    .input(z.object({ name: z.string(), conditions: z.any(), actions: z.any(), priority: z.number().optional(), isActive: z.boolean().default(true) }))
    .mutation(async ({ input }) => db.emailRule.create({ data: { name: input.name, conditions: typeof input.conditions === "string" ? input.conditions : JSON.stringify(input.conditions), actions: typeof input.actions === "string" ? input.actions : JSON.stringify(input.actions), priority: input.priority, isActive: input.isActive } })),
  "rules.update": publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), conditions: z.any().optional(), actions: z.any().optional(), priority: z.number().optional(), isEnabled: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.emailRule.update({ where: { id }, data });
    }),
  "rules.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => db.emailRule.delete({ where: { id: input.id } })),
  "rules.test": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const rule = await db.emailRule.findUniqueOrThrow({ where: { id: input.id } });
      const recent = await db.emailMessage.findMany({ where: { matterId: null }, take: 100, orderBy: { date: "desc" } });
      const conditions = (rule as any).conditions || {};
      const matches = recent.filter((m: any) => {
        if (conditions.from && !m.fromAddress?.includes(conditions.from)) return false;
        if (conditions.subject && !m.subject?.includes(conditions.subject)) return false;
        return true;
      });
      return { matchCount: matches.length, sampleMatches: matches.slice(0, 5) };
    }),
  "rules.suggest": publicProcedure.query(async () => {
    return { suggestions: [{ name: "Auto-file by client domain", description: "File emails from known client domains to their matters" }] };
  }),
  "rules.reorder": publicProcedure
    .input(z.object({ orderedIds: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      await Promise.all(input.orderedIds.map((id, i) => db.emailRule.update({ where: { id }, data: { priority: i } })));
      return { success: true };
    }),

  // ─── Scheduling ────────────────────────────────────────────────
  "scheduled.list": publicProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.status) where.status = input.status;
      return db.emailSchedule.findMany({ where, orderBy: { scheduledFor: "asc" } });
    }),
  "scheduled.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => db.emailSchedule.findUniqueOrThrow({ where: { id: input.id } })),
  "scheduled.cancel": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => db.emailSchedule.update({ where: { id: input.id }, data: { status: "CANCELLED" } })),
  "scheduled.reschedule": publicProcedure
    .input(z.object({ id: z.string(), scheduledFor: z.string() }))
    .mutation(async ({ input }) => db.emailSchedule.update({ where: { id: input.id }, data: { scheduledFor: new Date(input.scheduledFor) } })),

  // ─── Sync ──────────────────────────────────────────────────────
  "sync.run": publicProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ input }) => engine.syncInbox(input.provider as any)),
  "sync.runAll": publicProcedure.mutation(async () => {
    const integrations = await db.emailIntegration.findMany({ where: { isEnabled: true } });
    const results = await Promise.all(integrations.map((i) => engine.syncInbox(i.provider)));
    return { synced: integrations.length, results };
  }),
  "sync.status": publicProcedure
    .input(z.object({ provider: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.provider) where.provider = input.provider as any;
      return db.emailIntegration.findMany({ where, select: { provider: true, isEnabled: true, lastSyncAt: true, lastSyncStatus: true, lastSyncError: true } });
    }),
  "sync.history": publicProcedure
    .input(z.object({ provider: z.string().optional(), limit: z.number().default(20) }).optional())
    .query(async () => {
      return { history: [] };
    }),

  // ─── AI ────────────────────────────────────────────────────────
  "ai.generateDraft": publicProcedure
    .input(z.object({ purpose: z.string(), context: z.string().optional(), matterId: z.string().optional(), tone: z.string().optional() }))
    .mutation(async ({ input }) => engine.generateEmailDraft(input)),
  "ai.summarizeThread": publicProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ input }) => engine.summarizeThread(input.threadId)),
  "ai.detectActionItems": publicProcedure
    .input(z.object({ threadId: z.string() }))
    .mutation(async ({ input }) => engine.detectActionItems(input.threadId)),
  "ai.suggestReply": publicProcedure
    .input(z.object({ messageId: z.string(), tone: z.string().optional() }))
    .mutation(async ({ input }) => {
      return { suggestion: "Thank you for your email. I will review and respond shortly.", messageId: input.messageId };
    }),
  "ai.improveEmail": publicProcedure
    .input(z.object({ body: z.string(), tone: z.string().optional() }))
    .mutation(async ({ input }) => {
      return { improved: input.body, suggestions: ["Consider adding a clear call to action"] };
    }),

  // ─── Time ──────────────────────────────────────────────────────
  "time.logFromEmail": publicProcedure
    .input(z.object({ messageId: z.string(), matterId: z.string(), duration: z.number().optional(), description: z.string().optional() }))
    .mutation(async ({ input }) => engine.logTimeFromEmail(input.messageId, "system", input.duration)),
  "time.estimate": publicProcedure
    .input(z.object({ messageId: z.string() }))
    .query(async ({ input }) => {
      return { messageId: input.messageId, estimatedMinutes: 6, confidence: 0.7 };
    }),

  // ─── Reports ───────────────────────────────────────────────────
  "reports.volume": publicProcedure
    .input(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.dateFrom || input?.dateTo) where.date = { ...(input?.dateFrom ? { gte: new Date(input.dateFrom) } : {}), ...(input?.dateTo ? { lte: new Date(input.dateTo) } : {}) };
      const count = await db.emailMessage.count({ where });
      return { total: count };
    }),
  "reports.responseTime": publicProcedure.query(async () => {
    return { averageMinutes: null, medianMinutes: null, note: "Not yet implemented" };
  }),
  "reports.unfiled": publicProcedure.query(async () => {
    const count = await db.emailMessage.count({ where: { matterId: null } });
    return { unfiledCount: count };
  }),
  "reports.byMatter": publicProcedure.query(async () => {
    return db.emailMessage.groupBy({ by: ["matterId"], _count: { id: true }, orderBy: { _count: { id: "desc" } } });
  }),
  "reports.byClient": publicProcedure.query(async () => {
    return db.emailMessage.groupBy({ by: ["clientId"], _count: { id: true }, orderBy: { _count: { id: "desc" } } });
  }),
  "reports.attachments": publicProcedure.query(async () => {
    const count = await db.emailAttachment.count();
    return { totalAttachments: count };
  }),
});
