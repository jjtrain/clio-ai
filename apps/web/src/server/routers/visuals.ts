import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import * as trialline from "@/lib/integrations/trialline";
import * as agilelaw from "@/lib/integrations/agilelaw";
import * as engine from "@/lib/timelines-engine";

function maskKey(k: string | null) { return k ? "****" + k.slice(-4) : null; }

export const visualsRouter = router({
  // ─── Settings ──────────────────────────────────────────────────
  "settings.list": publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.visualsIntegration.findMany({ orderBy: { provider: "asc" } });
    return all.map((i) => ({ ...i, apiKey: maskKey(i.apiKey), apiSecret: maskKey(i.apiSecret) }));
  }),

  "settings.get": publicProcedure
    .input(z.object({ provider: z.string() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.visualsIntegration.findUniqueOrThrow({ where: { provider: input.provider as any } });
      return { ...row, apiKey: maskKey(row.apiKey), apiSecret: maskKey(row.apiSecret) };
    }),

  "settings.update": publicProcedure
    .input(z.object({ provider: z.string(), displayName: z.string().optional(), apiKey: z.string().optional().nullable(), apiSecret: z.string().optional().nullable(), baseUrl: z.string().optional().nullable(), accountId: z.string().optional().nullable(), accessToken: z.string().optional().nullable(), refreshToken: z.string().optional().nullable(), webhookUrl: z.string().optional().nullable(), webhookSecret: z.string().optional().nullable(), autoSyncDocuments: z.boolean().optional(), autoSyncTimeline: z.boolean().optional(), isEnabled: z.boolean().optional(), settings: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { provider, ...data } = input;
      const clean: any = { ...data };
      if (clean.apiKey?.startsWith("****")) delete clean.apiKey;
      if (clean.apiSecret?.startsWith("****")) delete clean.apiSecret;
      return ctx.db.visualsIntegration.upsert({ where: { provider: provider as any }, create: { provider: provider as any, displayName: input.displayName || provider, ...clean }, update: clean });
    }),

  "settings.test": publicProcedure
    .input(z.object({ provider: z.string() }))
    .mutation(async ({ input }) => {
      const tests: Record<string, () => Promise<any>> = { TRIALLINE: trialline.testConnection, AGILELAW: agilelaw.testConnection };
      const fn = tests[input.provider];
      if (!fn) return { success: false, error: "Unknown provider" };
      return fn();
    }),

  // ─── Timelines ─────────────────────────────────────────────────
  "timelines.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), timelineType: z.string().optional(), status: z.string().optional(), provider: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.timelineType) where.timelineType = input.timelineType;
      if (input?.status) where.status = input.status;
      if (input?.provider) where.provider = input.provider;
      return ctx.db.caseTimeline.findMany({ where, include: { matter: true }, orderBy: { updatedAt: "desc" } });
    }),

  "timelines.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.caseTimeline.findUniqueOrThrow({ where: { id: input.id }, include: { events: { orderBy: { date: "asc" } }, matter: true } });
    }),

  "timelines.create": publicProcedure
    .input(z.object({ matterId: z.string(), title: z.string(), description: z.string().optional(), timelineType: z.string().optional(), theme: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.caseTimeline.create({ data: { ...input, timelineType: (input.timelineType as any) || "CASE_CHRONOLOGY" } });
    }),

  "timelines.update": publicProcedure
    .input(z.object({ id: z.string(), title: z.string().optional(), description: z.string().optional(), timelineType: z.string().optional(), status: z.string().optional(), theme: z.string().optional(), filters: z.string().optional(), annotations: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.caseTimeline.update({ where: { id }, data: data as any });
    }),

  "timelines.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.caseTimeline.delete({ where: { id: input.id } })),

  "timelines.duplicate": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const src = await ctx.db.caseTimeline.findUniqueOrThrow({ where: { id: input.id }, include: { events: true } });
      const copy = await ctx.db.caseTimeline.create({ data: { matterId: src.matterId, title: `${src.title} (Copy)`, description: src.description, timelineType: src.timelineType, theme: src.theme, filters: src.filters, previousVersionId: src.id } });
      for (const e of src.events) {
        await ctx.db.timelineEvent.create({ data: { timelineId: copy.id, title: e.title, date: e.date, endDate: e.endDate, description: e.description, category: e.category, subcategory: e.subcategory, significance: e.significance, party: e.party, parties: e.parties, location: e.location, source: e.source, tags: e.tags, color: e.color, icon: e.icon, isKeyEvent: e.isKeyEvent, notes: e.notes, position: e.position } });
      }
      return copy;
    }),

  "timelines.buildFromMatter": publicProcedure
    .input(z.object({ matterId: z.string(), timelineType: z.string().optional() }))
    .mutation(async ({ input }) => engine.buildTimelineFromMatter(input.matterId, input.timelineType)),

  "timelines.buildMedical": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ input }) => engine.buildMedicalTimeline(input.matterId)),

  "timelines.buildDiscovery": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ input }) => engine.buildDiscoveryTimeline(input.matterId)),

  "timelines.buildLitigation": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ input }) => engine.buildLitigationTimeline(input.matterId)),

  "timelines.syncToProvider": publicProcedure
    .input(z.object({ timelineId: z.string() }))
    .mutation(async ({ input }) => engine.syncTimelineToTrialLine(input.timelineId)),

  "timelines.syncFromProvider": publicProcedure
    .input(z.object({ externalTimelineId: z.string(), matterId: z.string() }))
    .mutation(async ({ input }) => engine.syncTimelineFromTrialLine(input.externalTimelineId, input.matterId)),

  "timelines.generateSummary": publicProcedure
    .input(z.object({ timelineId: z.string() }))
    .mutation(async ({ input }) => engine.generateAISummary(input.timelineId)),

  "timelines.detectPatterns": publicProcedure
    .input(z.object({ timelineId: z.string() }))
    .mutation(async ({ input }) => engine.detectPatterns(input.timelineId)),

  "timelines.compare": publicProcedure
    .input(z.object({ timelineId1: z.string(), timelineId2: z.string() }))
    .mutation(async ({ input }) => engine.compareTimelines(input.timelineId1, input.timelineId2)),

  "timelines.share": publicProcedure
    .input(z.object({ id: z.string(), recipients: z.array(z.string()).optional(), accessLevel: z.string().optional(), expiresAt: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...params } = input;
      const result = await trialline.shareTimeline(id, params);
      if (result.success) await ctx.db.caseTimeline.update({ where: { id }, data: { isPublic: true, status: "SHARED" } });
      return result;
    }),

  "timelines.getShareUrl": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => trialline.getShareUrl(input.id)),

  "timelines.revokeShare": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await trialline.revokeShare(input.id);
      if (result.success) await ctx.db.caseTimeline.update({ where: { id: input.id }, data: { isPublic: false } });
      return result;
    }),

  "timelines.export": publicProcedure
    .input(z.object({ timelineId: z.string(), format: z.string(), includeAnnotations: z.boolean().optional(), includeDocuments: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const result = await engine.exportTimelineAsDocument(input.timelineId, input.format);
      await ctx.db.caseTimeline.update({ where: { id: input.timelineId }, data: { lastExportedAt: new Date(), lastExportedFormat: input.format } });
      return result;
    }),

  "timelines.getCategories": publicProcedure.query(async () => trialline.getCategories()),

  "timelines.getThemes": publicProcedure.query(async () => trialline.getThemes()),

  "timelines.getEmbedCode": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => trialline.getEmbedCode(input.id)),

  "timelines.createPresentation": publicProcedure
    .input(z.object({ timelineId: z.string(), boardType: z.string().optional() }))
    .mutation(async ({ input }) => engine.createPresentationFromTimeline(input.timelineId, input.boardType)),

  // ─── Events ────────────────────────────────────────────────────
  "events.list": publicProcedure
    .input(z.object({ timelineId: z.string(), category: z.string().optional(), significance: z.string().optional(), party: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { timelineId: input.timelineId };
      if (input.category) where.category = input.category;
      if (input.significance) where.significance = input.significance;
      if (input.party) where.party = input.party;
      if (input.dateFrom || input.dateTo) { where.date = {}; if (input.dateFrom) where.date.gte = new Date(input.dateFrom); if (input.dateTo) where.date.lte = new Date(input.dateTo); }
      return ctx.db.timelineEvent.findMany({ where, orderBy: { date: "asc" } });
    }),

  "events.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.timelineEvent.findUniqueOrThrow({ where: { id: input.id } })),

  "events.create": publicProcedure
    .input(z.object({ timelineId: z.string(), title: z.string(), date: z.string().or(z.date()), endDate: z.string().or(z.date()).optional(), description: z.string().optional(), category: z.string().optional(), subcategory: z.string().optional(), significance: z.string().optional(), party: z.string().optional(), parties: z.string().optional(), location: z.string().optional(), source: z.string().optional(), tags: z.string().optional(), color: z.string().optional(), icon: z.string().optional(), isKeyEvent: z.boolean().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { date, endDate, ...rest } = input;
      const event = await ctx.db.timelineEvent.create({ data: { ...rest, date: new Date(date), endDate: endDate ? new Date(endDate) : undefined, category: (rest.category as any) || "OTHER", significance: (rest.significance as any) || "MEDIUM" } });
      await ctx.db.caseTimeline.update({ where: { id: input.timelineId }, data: { eventCount: { increment: 1 } } });
      return event;
    }),

  "events.update": publicProcedure
    .input(z.object({ id: z.string(), title: z.string().optional(), date: z.string().or(z.date()).optional(), endDate: z.string().or(z.date()).optional().nullable(), description: z.string().optional().nullable(), category: z.string().optional(), subcategory: z.string().optional().nullable(), significance: z.string().optional(), party: z.string().optional().nullable(), location: z.string().optional().nullable(), tags: z.string().optional().nullable(), color: z.string().optional().nullable(), icon: z.string().optional().nullable(), isKeyEvent: z.boolean().optional(), isDisputed: z.boolean().optional(), disputeNotes: z.string().optional().nullable(), notes: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { id, date, endDate, ...rest } = input;
      const data: any = { ...rest };
      if (date !== undefined) data.date = new Date(date);
      if (endDate !== undefined) data.endDate = endDate ? new Date(endDate) : null;
      return ctx.db.timelineEvent.update({ where: { id }, data });
    }),

  "events.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.timelineEvent.delete({ where: { id: input.id } });
      await ctx.db.caseTimeline.update({ where: { id: event.timelineId }, data: { eventCount: { decrement: 1 } } });
      return event;
    }),

  "events.bulkCreate": publicProcedure
    .input(z.object({ timelineId: z.string(), events: z.array(z.object({ title: z.string(), date: z.string(), description: z.string().optional(), category: z.string().optional() })) }))
    .mutation(async ({ ctx, input }) => {
      const created = [];
      for (const e of input.events) {
        const evt = await ctx.db.timelineEvent.create({ data: { timelineId: input.timelineId, title: e.title, date: new Date(e.date), description: e.description, category: (e.category as any) || "OTHER" } });
        created.push(evt);
      }
      await ctx.db.caseTimeline.update({ where: { id: input.timelineId }, data: { eventCount: { increment: created.length } } });
      return created;
    }),

  "events.reorder": publicProcedure
    .input(z.object({ timelineId: z.string(), eventIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      for (let i = 0; i < input.eventIds.length; i++) {
        await ctx.db.timelineEvent.update({ where: { id: input.eventIds[i] }, data: { position: i } });
      }
      return { success: true };
    }),

  "events.addFromRecord": publicProcedure
    .input(z.object({ timelineId: z.string(), sourceType: z.string(), sourceRecordId: z.string() }))
    .mutation(async ({ input }) => engine.addEventFromRecord(input.timelineId, input.sourceType, input.sourceRecordId)),

  "events.syncToProvider": publicProcedure
    .input(z.object({ timelineId: z.string(), eventId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.timelineEvent.findUniqueOrThrow({ where: { id: input.eventId } });
      return trialline.addEvent(input.timelineId, { title: event.title, date: event.date.toISOString(), description: event.description || undefined, category: event.category });
    }),

  "events.addAnnotation": publicProcedure
    .input(z.object({ timelineId: z.string(), eventId: z.string(), text: z.string(), author: z.string().optional(), type: z.string().optional() }))
    .mutation(async ({ input }) => trialline.addAnnotation(input.timelineId, { eventId: input.eventId, text: input.text, author: input.author, type: input.type })),

  "events.bulkSync": publicProcedure
    .input(z.object({ timelineId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const timeline = await ctx.db.caseTimeline.findUniqueOrThrow({ where: { id: input.timelineId }, include: { events: true } });
      if (!timeline.externalTimelineId) return { success: false, error: "No external timeline linked" };
      const events = timeline.events.map((e) => ({ title: e.title, date: e.date.toISOString(), description: e.description || undefined, category: e.category }));
      return trialline.bulkAddEvents(timeline.externalTimelineId, events);
    }),

  // ─── Deposition ────────────────────────────────────────────────
  "deposition.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), status: z.string().optional(), deponentName: z.string().optional(), dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;
      if (input?.deponentName) where.deponentName = { contains: input.deponentName, mode: "insensitive" };
      if (input?.dateFrom || input?.dateTo) { where.depositionDate = {}; if (input?.dateFrom) where.depositionDate.gte = new Date(input.dateFrom); if (input?.dateTo) where.depositionDate.lte = new Date(input.dateTo); }
      return ctx.db.depositionSession.findMany({ where, include: { matter: true, exhibits: true }, orderBy: { depositionDate: "desc" } });
    }),

  "deposition.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.depositionSession.findUniqueOrThrow({ where: { id: input.id }, include: { exhibits: true, annotations: true, matter: true } })),

  "deposition.create": publicProcedure
    .input(z.object({ matterId: z.string(), title: z.string(), deponentName: z.string(), depositionDate: z.string().or(z.date()), depositionTime: z.string().optional(), location: z.string().optional(), locationType: z.string().optional(), examiningAttorney: z.string().optional(), defendingAttorney: z.string().optional(), courtReporter: z.string().optional(), videographer: z.string().optional(), videoConferenceUrl: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { depositionDate, ...rest } = input;
      return ctx.db.depositionSession.create({ data: { ...rest, depositionDate: new Date(depositionDate), locationType: (rest.locationType as any) || "IN_PERSON" } });
    }),

  "deposition.update": publicProcedure
    .input(z.object({ id: z.string(), title: z.string().optional(), deponentName: z.string().optional(), depositionDate: z.string().or(z.date()).optional(), depositionTime: z.string().optional().nullable(), location: z.string().optional().nullable(), locationType: z.string().optional(), status: z.string().optional(), examiningAttorney: z.string().optional().nullable(), defendingAttorney: z.string().optional().nullable(), courtReporter: z.string().optional().nullable(), videographer: z.string().optional().nullable(), videoConferenceUrl: z.string().optional().nullable(), notes: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { id, depositionDate, ...rest } = input;
      const data: any = { ...rest };
      if (depositionDate !== undefined) data.depositionDate = new Date(depositionDate);
      return ctx.db.depositionSession.update({ where: { id }, data });
    }),

  "deposition.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.depositionSession.delete({ where: { id: input.id } })),

  "deposition.prepare": publicProcedure
    .input(z.object({ matterId: z.string(), deponentName: z.string(), depositionDate: z.string() }))
    .mutation(async ({ input }) => engine.prepareDepositionSession(input.matterId, input.deponentName, input.depositionDate)),

  "deposition.start": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.depositionSession.update({ where: { id: input.id }, data: { status: "IN_PROGRESS" } });
      const session = await ctx.db.depositionSession.findUniqueOrThrow({ where: { id: input.id } });
      if (session.externalSessionId) return agilelaw.startSession(session.externalSessionId);
      return { success: true };
    }),

  "deposition.end": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.depositionSession.update({ where: { id: input.id }, data: { status: "COMPLETED" } });
      const session = await ctx.db.depositionSession.findUniqueOrThrow({ where: { id: input.id } });
      if (session.externalSessionId) return agilelaw.endSession(session.externalSessionId);
      return { success: true };
    }),

  "deposition.analyze": publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ input }) => engine.analyzeDeposition(input.sessionId)),

  "deposition.linkTranscript": publicProcedure
    .input(z.object({ id: z.string(), transcriptUrl: z.string().optional(), transcriptText: z.string().optional(), provider: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...params } = input;
      const session = await ctx.db.depositionSession.findUniqueOrThrow({ where: { id } });
      if (session.externalSessionId) await agilelaw.linkTranscript(session.externalSessionId, params);
      return ctx.db.depositionSession.update({ where: { id }, data: { transcriptLinked: true } });
    }),

  "deposition.share": publicProcedure
    .input(z.object({ id: z.string(), recipients: z.array(z.string()).optional(), accessLevel: z.string().optional(), expiresAt: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...params } = input;
      return agilelaw.shareSession(id, params);
    }),

  "deposition.export": publicProcedure
    .input(z.object({ id: z.string(), format: z.string(), includeAnnotations: z.boolean().optional(), includeExhibits: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...params } = input;
      return agilelaw.exportSession(id, params);
    }),

  "deposition.getExhibitIndex": publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ input }) => engine.buildExhibitIndex(input.sessionId)),

  // ─── Exhibits ──────────────────────────────────────────────────
  "exhibits.list": publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.depositionExhibit.findMany({ where: { sessionId: input.sessionId }, orderBy: { position: "asc" } })),

  "exhibits.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.depositionExhibit.findUniqueOrThrow({ where: { id: input.id } })),

  "exhibits.create": publicProcedure
    .input(z.object({ sessionId: z.string(), exhibitNumber: z.string(), title: z.string(), description: z.string().optional(), documentId: z.string().optional(), externalDocUrl: z.string().optional(), fileType: z.string().optional(), pageCount: z.number().optional(), isConfidential: z.boolean().optional(), confidentialityDesignation: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const exhibit = await ctx.db.depositionExhibit.create({ data: input });
      await ctx.db.depositionSession.update({ where: { id: input.sessionId }, data: { exhibitCount: { increment: 1 } } });
      return exhibit;
    }),

  "exhibits.update": publicProcedure
    .input(z.object({ id: z.string(), exhibitNumber: z.string().optional(), title: z.string().optional(), description: z.string().optional().nullable(), documentId: z.string().optional().nullable(), fileType: z.string().optional().nullable(), pageCount: z.number().optional().nullable(), isConfidential: z.boolean().optional(), confidentialityDesignation: z.string().optional().nullable(), notes: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.depositionExhibit.update({ where: { id }, data });
    }),

  "exhibits.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const exhibit = await ctx.db.depositionExhibit.delete({ where: { id: input.id } });
      await ctx.db.depositionSession.update({ where: { id: exhibit.sessionId }, data: { exhibitCount: { decrement: 1 } } });
      return exhibit;
    }),

  "exhibits.bulkAdd": publicProcedure
    .input(z.object({ sessionId: z.string(), exhibits: z.array(z.object({ exhibitNumber: z.string(), title: z.string(), description: z.string().optional(), documentId: z.string().optional() })) }))
    .mutation(async ({ ctx, input }) => {
      const created = [];
      for (const e of input.exhibits) {
        const exhibit = await ctx.db.depositionExhibit.create({ data: { sessionId: input.sessionId, ...e } });
        created.push(exhibit);
      }
      await ctx.db.depositionSession.update({ where: { id: input.sessionId }, data: { exhibitCount: { increment: created.length } } });
      return created;
    }),

  "exhibits.reorder": publicProcedure
    .input(z.object({ sessionId: z.string(), exhibitIds: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      for (let i = 0; i < input.exhibitIds.length; i++) {
        await ctx.db.depositionExhibit.update({ where: { id: input.exhibitIds[i] }, data: { position: i } });
      }
      return { success: true };
    }),

  "exhibits.addFromUrl": publicProcedure
    .input(z.object({ sessionId: z.string(), url: z.string(), name: z.string(), exhibitNumber: z.string().optional(), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { sessionId, ...params } = input;
      return agilelaw.addExhibitFromUrl(sessionId, params);
    }),

  "exhibits.syncToProvider": publicProcedure
    .input(z.object({ sessionId: z.string(), exhibitId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const exhibit = await ctx.db.depositionExhibit.findUniqueOrThrow({ where: { id: input.exhibitId } });
      return agilelaw.addExhibit(input.sessionId, { name: exhibit.title, exhibitNumber: exhibit.exhibitNumber, description: exhibit.description || undefined, fileUrl: exhibit.externalDocUrl || undefined });
    }),

  "exhibits.present": publicProcedure
    .input(z.object({ sessionId: z.string(), exhibitId: z.string(), page: z.number().optional(), zoom: z.number().optional() }))
    .mutation(async ({ input }) => engine.presentDepositionExhibit(input.sessionId, input.exhibitId, { page: input.page, zoom: input.zoom })),

  "exhibits.presentPage": publicProcedure
    .input(z.object({ sessionId: z.string(), exhibitId: z.string(), page: z.number(), annotations: z.boolean().optional() }))
    .mutation(async ({ input }) => agilelaw.presentPage(input.sessionId, { exhibitId: input.exhibitId, page: input.page, annotations: input.annotations })),

  "exhibits.mark": publicProcedure
    .input(z.object({ sessionId: z.string(), exhibitId: z.string(), markType: z.string(), label: z.string().optional(), page: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.depositionExhibit.update({ where: { id: input.exhibitId }, data: { markedBy: input.markType, markedAt: new Date() } });
      return agilelaw.markExhibit(input.sessionId, input.exhibitId, { markType: input.markType, label: input.label, page: input.page });
    }),

  "exhibits.offerIntoEvidence": publicProcedure
    .input(z.object({ sessionId: z.string(), exhibitId: z.string(), offeredBy: z.string().optional(), basis: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.depositionExhibit.update({ where: { id: input.exhibitId }, data: { offeredIntoEvidence: true, admissionStatus: "OFFERED" } });
      return agilelaw.offerIntoEvidence(input.sessionId, input.exhibitId, { offeredBy: input.offeredBy, basis: input.basis, notes: input.notes });
    }),

  "exhibits.recordObjection": publicProcedure
    .input(z.object({ sessionId: z.string(), exhibitId: z.string(), objectionType: z.string(), objectedBy: z.string().optional(), basis: z.string().optional(), ruling: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.depositionExhibit.update({ where: { id: input.exhibitId }, data: { objection: input.objectionType, admissionStatus: "OBJECTED" } });
      return agilelaw.recordObjection(input.sessionId, input.exhibitId, { objectionType: input.objectionType, objectedBy: input.objectedBy, basis: input.basis, ruling: input.ruling });
    }),

  "exhibits.stamp": publicProcedure
    .input(z.object({ sessionId: z.string(), exhibitId: z.string(), stampType: z.string(), text: z.string().optional(), position: z.string().optional() }))
    .mutation(async ({ input }) => agilelaw.stampExhibit(input.sessionId, input.exhibitId, { stampType: input.stampType, text: input.text, position: input.position })),

  "exhibits.linkToTranscript": publicProcedure
    .input(z.object({ exhibitId: z.string(), transcriptPages: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.depositionExhibit.update({ where: { id: input.exhibitId }, data: { linkedTranscriptPages: input.transcriptPages } })),

  // ─── Annotations ───────────────────────────────────────────────
  "annotations.list": publicProcedure
    .input(z.object({ sessionId: z.string(), exhibitId: z.string().optional(), annotationType: z.string().optional(), createdBy: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { sessionId: input.sessionId };
      if (input.exhibitId) where.exhibitId = input.exhibitId;
      if (input.annotationType) where.annotationType = input.annotationType;
      if (input.createdBy) where.createdBy = input.createdBy;
      return ctx.db.depositionAnnotation.findMany({ where, orderBy: { createdAt: "asc" } });
    }),

  "annotations.create": publicProcedure
    .input(z.object({ sessionId: z.string(), exhibitId: z.string().optional(), transcriptPage: z.number().optional(), transcriptLine: z.number().optional(), annotationType: z.string().optional(), content: z.string().optional(), color: z.string().optional(), coordinates: z.string().optional(), createdBy: z.string(), isPrivate: z.boolean().optional(), tags: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const annotation = await ctx.db.depositionAnnotation.create({ data: { ...input, annotationType: (input.annotationType as any) || "TEXT_NOTE" } });
      await ctx.db.depositionSession.update({ where: { id: input.sessionId }, data: { annotationCount: { increment: 1 } } });
      return annotation;
    }),

  "annotations.update": publicProcedure
    .input(z.object({ id: z.string(), content: z.string().optional().nullable(), color: z.string().optional().nullable(), coordinates: z.string().optional().nullable(), isPrivate: z.boolean().optional(), tags: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.depositionAnnotation.update({ where: { id }, data });
    }),

  "annotations.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const annotation = await ctx.db.depositionAnnotation.delete({ where: { id: input.id } });
      await ctx.db.depositionSession.update({ where: { id: annotation.sessionId }, data: { annotationCount: { decrement: 1 } } });
      return annotation;
    }),

  "annotations.sync": publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.depositionSession.findUniqueOrThrow({ where: { id: input.sessionId } });
      if (!session.externalSessionId) return { success: false, error: "No external session linked" };
      const remote = await agilelaw.getAnnotations(session.externalSessionId);
      return { success: true, data: remote };
    }),

  // ─── Presentations ────────────────────────────────────────────
  "presentations.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), boardType: z.string().optional(), status: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.boardType) where.boardType = input.boardType;
      if (input?.status) where.status = input.status;
      return ctx.db.presentationBoard.findMany({ where, orderBy: { updatedAt: "desc" } });
    }),

  "presentations.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.presentationBoard.findUniqueOrThrow({ where: { id: input.id } })),

  "presentations.create": publicProcedure
    .input(z.object({ matterId: z.string(), title: z.string(), description: z.string().optional(), boardType: z.string().optional(), theme: z.string().optional(), presenterNotes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.presentationBoard.create({ data: { ...input, boardType: (input.boardType as any) || "CUSTOM", slides: "[]" } });
    }),

  "presentations.update": publicProcedure
    .input(z.object({ id: z.string(), title: z.string().optional(), description: z.string().optional().nullable(), boardType: z.string().optional(), status: z.string().optional(), theme: z.string().optional().nullable(), presenterNotes: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.presentationBoard.update({ where: { id }, data: data as any });
    }),

  "presentations.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.presentationBoard.delete({ where: { id: input.id } })),

  "presentations.addSlide": publicProcedure
    .input(z.object({ boardId: z.string(), slide: z.object({ title: z.string().optional(), content: z.string().optional(), imageUrl: z.string().optional(), exhibitId: z.string().optional(), layout: z.string().optional(), notes: z.string().optional() }), position: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const board = await ctx.db.presentationBoard.findUniqueOrThrow({ where: { id: input.boardId } });
      const slides = JSON.parse(board.slides || "[]");
      const pos = input.position ?? slides.length;
      slides.splice(pos, 0, { ...input.slide, id: `slide_${Date.now()}` });
      return ctx.db.presentationBoard.update({ where: { id: input.boardId }, data: { slides: JSON.stringify(slides), slideCount: slides.length } });
    }),

  "presentations.updateSlide": publicProcedure
    .input(z.object({ boardId: z.string(), slideIndex: z.number(), slide: z.object({ title: z.string().optional(), content: z.string().optional(), imageUrl: z.string().optional(), exhibitId: z.string().optional(), layout: z.string().optional(), notes: z.string().optional() }) }))
    .mutation(async ({ ctx, input }) => {
      const board = await ctx.db.presentationBoard.findUniqueOrThrow({ where: { id: input.boardId } });
      const slides = JSON.parse(board.slides || "[]");
      if (input.slideIndex < 0 || input.slideIndex >= slides.length) throw new Error("Invalid slide index");
      slides[input.slideIndex] = { ...slides[input.slideIndex], ...input.slide };
      return ctx.db.presentationBoard.update({ where: { id: input.boardId }, data: { slides: JSON.stringify(slides) } });
    }),

  "presentations.deleteSlide": publicProcedure
    .input(z.object({ boardId: z.string(), slideIndex: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const board = await ctx.db.presentationBoard.findUniqueOrThrow({ where: { id: input.boardId } });
      const slides = JSON.parse(board.slides || "[]");
      slides.splice(input.slideIndex, 1);
      return ctx.db.presentationBoard.update({ where: { id: input.boardId }, data: { slides: JSON.stringify(slides), slideCount: slides.length } });
    }),

  "presentations.reorderSlides": publicProcedure
    .input(z.object({ boardId: z.string(), slideOrder: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      const board = await ctx.db.presentationBoard.findUniqueOrThrow({ where: { id: input.boardId } });
      const slides = JSON.parse(board.slides || "[]");
      const reordered = input.slideOrder.map((i) => slides[i]).filter(Boolean);
      return ctx.db.presentationBoard.update({ where: { id: input.boardId }, data: { slides: JSON.stringify(reordered) } });
    }),

  "presentations.present": publicProcedure
    .input(z.object({ id: z.string(), slideIndex: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.presentationBoard.update({ where: { id: input.id }, data: { status: "PRESENTING", currentSlideIndex: input.slideIndex ?? 0, lastPresentedAt: new Date() } });
    }),

  "presentations.share": publicProcedure
    .input(z.object({ id: z.string(), password: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const url = `share_${input.id}_${Date.now()}`;
      return ctx.db.presentationBoard.update({ where: { id: input.id }, data: { sharedUrl: url, sharedPassword: input.password || null } });
    }),

  "presentations.duplicate": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const src = await ctx.db.presentationBoard.findUniqueOrThrow({ where: { id: input.id } });
      return ctx.db.presentationBoard.create({ data: { matterId: src.matterId, title: `${src.title} (Copy)`, description: src.description, boardType: src.boardType, slides: src.slides, slideCount: src.slideCount, theme: src.theme, presenterNotes: src.presenterNotes } });
    }),

  "presentations.export": publicProcedure
    .input(z.object({ id: z.string(), format: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const board = await ctx.db.presentationBoard.findUniqueOrThrow({ where: { id: input.id } });
      const slides = JSON.parse(board.slides || "[]");
      return { board, slides, format: input.format, exportedAt: new Date().toISOString() };
    }),

  // ─── Reports ───────────────────────────────────────────────────
  "reports.matterTimelines": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const timelines = await ctx.db.caseTimeline.findMany({ where: { matterId: input.matterId }, include: { events: true } });
      return { matterId: input.matterId, timelineCount: timelines.length, timelines: timelines.map((t) => ({ id: t.id, title: t.title, type: t.timelineType, status: t.status, eventCount: t.events.length })) };
    }),

  "reports.depositionSummary": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sessions = await ctx.db.depositionSession.findMany({ where: { matterId: input.matterId }, include: { exhibits: true, annotations: true } });
      return { matterId: input.matterId, sessionCount: sessions.length, sessions: sessions.map((s) => ({ id: s.id, deponentName: s.deponentName, date: s.depositionDate, status: s.status, exhibitCount: s.exhibits.length, annotationCount: s.annotations.length })) };
    }),

  "reports.exhibitMaster": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sessions = await ctx.db.depositionSession.findMany({ where: { matterId: input.matterId }, include: { exhibits: true } });
      const allExhibits = sessions.flatMap((s) => s.exhibits.map((e) => ({ ...e, deponentName: s.deponentName, sessionTitle: s.title })));
      return { matterId: input.matterId, totalExhibits: allExhibits.length, exhibits: allExhibits };
    }),

  "reports.export": publicProcedure
    .input(z.object({ reportType: z.string(), matterId: z.string(), format: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const format = input.format || "markdown";
      if (input.reportType === "timelines") {
        const timelines = await ctx.db.caseTimeline.findMany({ where: { matterId: input.matterId }, include: { events: { orderBy: { date: "asc" } } } });
        return { reportType: input.reportType, format, data: timelines, generatedAt: new Date().toISOString() };
      }
      if (input.reportType === "depositions") {
        const sessions = await ctx.db.depositionSession.findMany({ where: { matterId: input.matterId }, include: { exhibits: true, annotations: true } });
        return { reportType: input.reportType, format, data: sessions, generatedAt: new Date().toISOString() };
      }
      if (input.reportType === "exhibits") {
        const sessions = await ctx.db.depositionSession.findMany({ where: { matterId: input.matterId }, include: { exhibits: true } });
        return { reportType: input.reportType, format, data: sessions.flatMap((s) => s.exhibits), generatedAt: new Date().toISOString() };
      }
      return { reportType: input.reportType, format, data: null, error: "Unknown report type" };
    }),
});

import { db } from "@/lib/db";
