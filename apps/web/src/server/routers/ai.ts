import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as openai from "@/lib/integrations/openai";
import * as aiRouter from "@/lib/ai-router";
import * as semanticSearch from "@/lib/semantic-search";
import * as transcriptionEngine from "@/lib/transcription-engine";

export const aiIntegrationRouter = router({
  // ── Settings ──────────────────────────────────────────────────────
  "settings.list": publicProcedure.query(async () => {
    const integrations = await db.aIIntegration.findMany();
    const anthropicConfigured = !!process.env.ANTHROPIC_API_KEY;
    const anthropic = integrations.find(i => i.provider === "ANTHROPIC");
    const oa = integrations.find(i => i.provider === "OPENAI");
    return {
      anthropic: { configured: anthropicConfigured, ...(anthropic || { provider: "ANTHROPIC", isEnabled: anthropicConfigured, displayName: "Anthropic (Claude)", defaultModel: "claude-sonnet-4-20250514" }) },
      openai: oa || { provider: "OPENAI", isEnabled: false, displayName: "OpenAI" },
    };
  }),

  "settings.get": publicProcedure.input(z.object({ provider: z.string() })).query(async ({ input }) => {
    return db.aIIntegration.findFirst({ where: { provider: input.provider as any } });
  }),

  "settings.update": publicProcedure.input(z.object({ provider: z.string(), displayName: z.string().optional(), apiKey: z.string().optional(), organizationId: z.string().optional(), projectId: z.string().optional(), defaultModel: z.string().optional(), defaultEmbeddingModel: z.string().optional(), defaultWhisperModel: z.string().optional(), defaultImageModel: z.string().optional(), maxTokensPerRequest: z.number().optional(), temperatureDefault: z.number().optional(), monthlyBudgetCap: z.number().optional(), rateLimitRPM: z.number().optional(), rateLimitTPM: z.number().optional(), enabledFeatures: z.string().optional(), routingStrategy: z.string().optional(), isEnabled: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { provider, ...data } = input;
      return db.aIIntegration.upsert({
        where: { provider: provider as any },
        create: { provider: provider as any, displayName: data.displayName || provider, ...data } as any,
        update: data as any,
      });
    }),

  "settings.test": publicProcedure.input(z.object({ provider: z.string() })).mutation(async ({ input }) => {
    if (input.provider === "OPENAI") return openai.testConnection();
    // Test Anthropic
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return { success: false, error: "ANTHROPIC_API_KEY not set" };
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" }, body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 10, messages: [{ role: "user", content: "ping" }] }) });
      return { success: res.ok, error: res.ok ? undefined : `Status ${res.status}` };
    } catch (err: any) { return { success: false, error: err.message }; }
  }),

  "settings.getRouting": publicProcedure.query(async () => {
    const configs = await db.aIIntegration.findMany();
    const oa = configs.find(c => c.provider === "OPENAI");
    return { strategy: oa?.routingStrategy || "anthropic_primary", enabledFeatures: oa?.enabledFeatures ? JSON.parse(oa.enabledFeatures) : [] };
  }),

  "settings.updateRouting": publicProcedure.input(z.object({ strategy: z.string(), featureOverrides: z.record(z.string()).optional() })).mutation(async ({ input }) => {
    return db.aIIntegration.updateMany({ where: { provider: "OPENAI" }, data: { routingStrategy: input.strategy } });
  }),

  "settings.getBudget": publicProcedure.input(z.object({ provider: z.string().optional() }).optional()).query(async ({ input }) => {
    const configs = await db.aIIntegration.findMany(input?.provider ? { where: { provider: input.provider as any } } : undefined);
    return configs.map(c => ({ provider: c.provider, currentSpend: Number(c.currentMonthSpend || 0), budgetCap: Number(c.monthlyBudgetCap || 0), percentUsed: c.monthlyBudgetCap && Number(c.monthlyBudgetCap) > 0 ? (Number(c.currentMonthSpend || 0) / Number(c.monthlyBudgetCap)) * 100 : 0 }));
  }),

  // ── Completions ───────────────────────────────────────────────────
  "completions.complete": publicProcedure.input(z.object({ feature: z.string(), systemPrompt: z.string(), userPrompt: z.string(), matterId: z.string().optional(), provider: z.string().optional(), model: z.string().optional(), temperature: z.number().optional(), maxTokens: z.number().optional() }))
    .mutation(async ({ input }) => {
      return aiRouter.complete({ ...input, preferredProvider: input.provider });
    }),

  "completions.completeStructured": publicProcedure.input(z.object({ feature: z.string(), systemPrompt: z.string(), userPrompt: z.string(), schema: z.any(), schemaName: z.string(), matterId: z.string().optional(), provider: z.string().optional() }))
    .mutation(async ({ input }) => {
      return aiRouter.completeStructured({ ...input, schema: input.schema || {}, preferredProvider: input.provider });
    }),

  "completions.compare": publicProcedure.input(z.object({ systemPrompt: z.string(), userPrompt: z.string(), feature: z.string().optional() }))
    .mutation(async ({ input }) => {
      const feature = input.feature || "comparison";
      const [anthropicResult, openaiResult] = await Promise.allSettled([
        aiRouter.complete({ ...input, feature, preferredProvider: "ANTHROPIC" }),
        aiRouter.complete({ ...input, feature, preferredProvider: "OPENAI" }),
      ]);
      return {
        anthropic: anthropicResult.status === "fulfilled" ? anthropicResult.value : { content: "", error: (anthropicResult as any).reason?.message, provider: "ANTHROPIC" },
        openai: openaiResult.status === "fulfilled" ? openaiResult.value : { content: "", error: (openaiResult as any).reason?.message, provider: "OPENAI" },
      };
    }),

  // ── Embeddings & Semantic Search ──────────────────────────────────
  "embeddings.embedDocument": publicProcedure.input(z.object({ documentId: z.string() })).mutation(async ({ input }) => {
    return semanticSearch.embedDocument(input.documentId);
  }),

  "embeddings.embedMatter": publicProcedure.input(z.object({ matterId: z.string() })).mutation(async ({ input }) => {
    return semanticSearch.embedMatterDocuments(input.matterId);
  }),

  "embeddings.search": publicProcedure.input(z.object({ query: z.string(), matterId: z.string().optional(), topK: z.number().optional() })).mutation(async ({ input }) => {
    return semanticSearch.searchDocuments(input);
  }),

  "embeddings.searchAcrossMatters": publicProcedure.input(z.object({ query: z.string(), matterIds: z.array(z.string()), topK: z.number().optional() })).mutation(async ({ input }) => {
    return semanticSearch.searchAcrossMatters(input.query, input.matterIds, input.topK);
  }),

  "embeddings.findSimilar": publicProcedure.input(z.object({ documentId: z.string(), matterId: z.string().optional() })).query(async ({ input }) => {
    return semanticSearch.findSimilarDocuments(input.documentId, input.matterId);
  }),

  "embeddings.answerFromDocs": publicProcedure.input(z.object({ question: z.string(), matterId: z.string() })).mutation(async ({ input }) => {
    return semanticSearch.answerFromDocuments(input);
  }),

  "embeddings.summarizeCollection": publicProcedure.input(z.object({ matterId: z.string() })).mutation(async ({ input }) => {
    return semanticSearch.summarizeDocumentCollection(input.matterId);
  }),

  "embeddings.getStats": publicProcedure.input(z.object({ matterId: z.string().optional() }).optional()).query(async ({ input }) => {
    return semanticSearch.getEmbeddingStats(input?.matterId);
  }),

  "embeddings.deleteForDocument": publicProcedure.input(z.object({ documentId: z.string() })).mutation(async ({ input }) => {
    return semanticSearch.deleteDocumentEmbeddings(input.documentId);
  }),

  "embeddings.rebuildForMatter": publicProcedure.input(z.object({ matterId: z.string() })).mutation(async ({ input }) => {
    await db.documentEmbedding.deleteMany({ where: { matterId: input.matterId } });
    return semanticSearch.embedMatterDocuments(input.matterId);
  }),

  // ── Transcription ─────────────────────────────────────────────────
  "transcription.transcribeFile": publicProcedure.input(z.object({ fileContent: z.string(), mimeType: z.string(), language: z.string().optional(), matterId: z.string().optional() }))
    .mutation(async ({ input }) => {
      return transcriptionEngine.transcribeFile({ fileContent: input.fileContent, fileMimeType: input.mimeType, language: input.language, matterId: input.matterId });
    }),

  "transcription.transcribeCallRecording": publicProcedure.input(z.object({ callRecordId: z.string() })).mutation(async ({ input }) => {
    return transcriptionEngine.transcribeCallRecording(input.callRecordId);
  }),

  "transcription.transcribeZoomRecording": publicProcedure.input(z.object({ meetingId: z.string() })).mutation(async ({ input }) => {
    return transcriptionEngine.transcribeZoomRecording(input.meetingId);
  }),

  "transcription.transcribeDeposition": publicProcedure.input(z.object({ sessionId: z.string() })).mutation(async ({ input }) => {
    return transcriptionEngine.transcribeDepositionAudio(input.sessionId);
  }),

  "transcription.transcribeVoicemail": publicProcedure.input(z.object({ audioContent: z.string(), matterId: z.string().optional(), clientId: z.string().optional() }))
    .mutation(async ({ input }) => {
      return transcriptionEngine.transcribeVoicemail(input);
    }),

  "transcription.batchTranscribe": publicProcedure.input(z.object({ files: z.array(z.object({ content: z.string(), mimeType: z.string(), referenceId: z.string(), referenceType: z.string() })) }))
    .mutation(async ({ input }) => {
      return transcriptionEngine.batchTranscribe(input.files);
    }),

  // ── Image Generation ──────────────────────────────────────────────
  "images.generate": publicProcedure.input(z.object({ prompt: z.string(), size: z.string().optional(), quality: z.string().optional() })).mutation(async ({ input }) => {
    return aiRouter.generateImage(input);
  }),

  "images.generateForDocument": publicProcedure.input(z.object({ description: z.string(), matterId: z.string().optional(), documentType: z.string().optional() })).mutation(async ({ input }) => {
    const prompt = `Professional legal document visualization: ${input.description}. Style: clean, professional, suitable for legal proceedings.`;
    return aiRouter.generateImage({ prompt, matterId: input.matterId });
  }),

  // ── Moderation ────────────────────────────────────────────────────
  "moderation.check": publicProcedure.input(z.object({ text: z.string() })).mutation(async ({ input }) => {
    return aiRouter.moderate(input.text);
  }),

  // ── Prompt Templates ──────────────────────────────────────────────
  "prompts.list": publicProcedure.input(z.object({ feature: z.string().optional(), provider: z.string().optional() }).optional()).query(async ({ input }) => {
    const where: any = { isActive: true };
    if (input?.feature) where.feature = input.feature;
    if (input?.provider) where.preferredProvider = input.provider;
    return db.aIPromptTemplate.findMany({ where, orderBy: { name: "asc" } });
  }),

  "prompts.get": publicProcedure.input(z.object({ templateId: z.string() })).query(async ({ input }) => {
    return db.aIPromptTemplate.findUniqueOrThrow({ where: { id: input.templateId } });
  }),

  "prompts.create": publicProcedure.input(z.object({ name: z.string(), feature: z.string(), systemPrompt: z.string(), userPromptTemplate: z.string().optional(), preferredProvider: z.string().optional(), preferredModel: z.string().optional(), temperature: z.number().optional(), maxTokens: z.number().optional(), responseFormat: z.string().optional(), responseSchema: z.string().optional() }))
    .mutation(async ({ input }) => {
      return db.aIPromptTemplate.create({ data: input as any });
    }),

  "prompts.update": publicProcedure.input(z.object({ templateId: z.string(), data: z.record(z.unknown()) })).mutation(async ({ input }) => {
    return db.aIPromptTemplate.update({ where: { id: input.templateId }, data: input.data as any });
  }),

  "prompts.delete": publicProcedure.input(z.object({ templateId: z.string() })).mutation(async ({ input }) => {
    return db.aIPromptTemplate.update({ where: { id: input.templateId }, data: { isActive: false } });
  }),

  "prompts.test": publicProcedure.input(z.object({ templateId: z.string(), testInputs: z.record(z.string()).optional() })).mutation(async ({ input }) => {
    const template = await db.aIPromptTemplate.findUniqueOrThrow({ where: { id: input.templateId } });
    let userPrompt = template.userPromptTemplate || "";
    for (const [key, value] of Object.entries(input.testInputs || {})) {
      userPrompt = userPrompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    const [anthropicResult, openaiResult] = await Promise.allSettled([
      aiRouter.complete({ feature: template.feature, systemPrompt: template.systemPrompt, userPrompt, preferredProvider: "ANTHROPIC", temperature: template.temperature ? Number(template.temperature) : undefined, maxTokens: template.maxTokens ?? undefined }),
      aiRouter.complete({ feature: template.feature, systemPrompt: template.systemPrompt, userPrompt, preferredProvider: "OPENAI", temperature: template.temperature ? Number(template.temperature) : undefined, maxTokens: template.maxTokens ?? undefined }),
    ]);
    await db.aIPromptTemplate.update({ where: { id: input.templateId }, data: { usageCount: { increment: 2 }, lastUsedAt: new Date() } });
    return {
      anthropic: anthropicResult.status === "fulfilled" ? anthropicResult.value : { content: "", error: (anthropicResult as any).reason?.message },
      openai: openaiResult.status === "fulfilled" ? openaiResult.value : { content: "", error: (openaiResult as any).reason?.message },
    };
  }),

  "prompts.duplicate": publicProcedure.input(z.object({ templateId: z.string(), newName: z.string() })).mutation(async ({ input }) => {
    const source = await db.aIPromptTemplate.findUniqueOrThrow({ where: { id: input.templateId } });
    const { id, createdAt, updatedAt, usageCount, lastUsedAt, ...rest } = source as any;
    return db.aIPromptTemplate.create({ data: { ...rest, name: input.newName, usageCount: 0 } });
  }),

  // ── Usage & Analytics ─────────────────────────────────────────────
  "usage.getSummary": publicProcedure.input(z.object({ from: z.string(), to: z.string(), provider: z.string().optional(), feature: z.string().optional() })).query(async ({ input }) => {
    return aiRouter.getUsageStats({ from: new Date(input.from), to: new Date(input.to) });
  }),

  "usage.getByFeature": publicProcedure.input(z.object({ from: z.string(), to: z.string() })).query(async ({ input }) => {
    const logs = await db.aIUsageLog.findMany({ where: { createdAt: { gte: new Date(input.from), lte: new Date(input.to) } } });
    const byFeature: Record<string, { requests: number; tokens: number; cost: number }> = {};
    for (const log of logs) {
      if (!byFeature[log.feature]) byFeature[log.feature] = { requests: 0, tokens: 0, cost: 0 };
      byFeature[log.feature].requests++;
      byFeature[log.feature].tokens += log.totalTokens;
      byFeature[log.feature].cost += Number(log.cost || 0);
    }
    return byFeature;
  }),

  "usage.getByProvider": publicProcedure.input(z.object({ from: z.string(), to: z.string() })).query(async ({ input }) => {
    const logs = await db.aIUsageLog.findMany({ where: { createdAt: { gte: new Date(input.from), lte: new Date(input.to) } } });
    const byProvider: Record<string, { requests: number; tokens: number; cost: number; avgLatency: number }> = {};
    for (const log of logs) {
      if (!byProvider[log.provider]) byProvider[log.provider] = { requests: 0, tokens: 0, cost: 0, avgLatency: 0 };
      byProvider[log.provider].requests++;
      byProvider[log.provider].tokens += log.totalTokens;
      byProvider[log.provider].cost += Number(log.cost || 0);
      byProvider[log.provider].avgLatency += log.latencyMs || 0;
    }
    for (const key of Object.keys(byProvider)) { if (byProvider[key].requests > 0) byProvider[key].avgLatency = Math.round(byProvider[key].avgLatency / byProvider[key].requests); }
    return byProvider;
  }),

  "usage.getByMatter": publicProcedure.input(z.object({ from: z.string(), to: z.string(), matterId: z.string().optional() })).query(async ({ input }) => {
    const where: any = { createdAt: { gte: new Date(input.from), lte: new Date(input.to) }, matterId: { not: null } };
    if (input.matterId) where.matterId = input.matterId;
    const logs = await db.aIUsageLog.findMany({ where });
    const byMatter: Record<string, { requests: number; tokens: number; cost: number }> = {};
    for (const log of logs) {
      const mid = log.matterId!;
      if (!byMatter[mid]) byMatter[mid] = { requests: 0, tokens: 0, cost: 0 };
      byMatter[mid].requests++;
      byMatter[mid].tokens += log.totalTokens;
      byMatter[mid].cost += Number(log.cost || 0);
    }
    return byMatter;
  }),

  "usage.getCosts": publicProcedure.input(z.object({ from: z.string(), to: z.string() })).query(async ({ input }) => {
    const logs = await db.aIUsageLog.findMany({ where: { createdAt: { gte: new Date(input.from), lte: new Date(input.to) } } });
    let total = 0;
    const byProvider: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    const byFeature: Record<string, number> = {};
    for (const log of logs) {
      const cost = Number(log.cost || 0);
      total += cost;
      byProvider[log.provider] = (byProvider[log.provider] || 0) + cost;
      byModel[log.model] = (byModel[log.model] || 0) + cost;
      byFeature[log.feature] = (byFeature[log.feature] || 0) + cost;
    }
    return { total: Math.round(total * 100) / 100, byProvider, byModel, byFeature };
  }),

  "usage.getPerformance": publicProcedure.input(z.object({ from: z.string(), to: z.string() })).query(async ({ input }) => {
    const logs = await db.aIUsageLog.findMany({ where: { createdAt: { gte: new Date(input.from), lte: new Date(input.to) } } });
    const total = logs.length;
    const avgLatency = total > 0 ? Math.round(logs.reduce((s, l) => s + (l.latencyMs || 0), 0) / total) : 0;
    const errorRate = total > 0 ? logs.filter(l => l.status !== "SUCCESS").length / total : 0;
    return { totalRequests: total, avgLatency, errorRate, successRate: 1 - errorRate };
  }),

  "usage.compareProviders": publicProcedure.input(z.object({ feature: z.string().optional(), from: z.string(), to: z.string() })).query(async ({ input }) => {
    return aiRouter.getFeaturePerformance(input.feature || "all", { from: new Date(input.from), to: new Date(input.to) });
  }),

  "usage.getFeaturePerformance": publicProcedure.input(z.object({ feature: z.string(), from: z.string(), to: z.string() })).query(async ({ input }) => {
    return aiRouter.getFeaturePerformance(input.feature, { from: new Date(input.from), to: new Date(input.to) });
  }),

  "usage.getHealth": publicProcedure.query(async () => {
    return aiRouter.getProviderHealth();
  }),

  // ── Reports ───────────────────────────────────────────────────────
  "reports.usage": publicProcedure.input(z.object({ from: z.string(), to: z.string() })).query(async ({ input }) => {
    return aiRouter.getUsageStats({ from: new Date(input.from), to: new Date(input.to) });
  }),

  "reports.cost": publicProcedure.input(z.object({ from: z.string(), to: z.string() })).query(async ({ input }) => {
    const logs = await db.aIUsageLog.findMany({ where: { createdAt: { gte: new Date(input.from), lte: new Date(input.to) } }, orderBy: { createdAt: "asc" } });
    const dailyCosts: Record<string, number> = {};
    for (const log of logs) {
      const day = log.createdAt.toISOString().split("T")[0];
      dailyCosts[day] = (dailyCosts[day] || 0) + Number(log.cost || 0);
    }
    const totalCost = Object.values(dailyCosts).reduce((s, c) => s + c, 0);
    const days = Object.keys(dailyCosts).length || 1;
    return { totalCost: Math.round(totalCost * 100) / 100, dailyCosts, avgDailyCost: Math.round((totalCost / days) * 100) / 100, projectedMonthly: Math.round((totalCost / days) * 30 * 100) / 100 };
  }),

  "reports.performance": publicProcedure.input(z.object({ from: z.string(), to: z.string() })).query(async ({ input }) => {
    return aiRouter.getUsageStats({ from: new Date(input.from), to: new Date(input.to) });
  }),

  "reports.routing": publicProcedure.input(z.object({ from: z.string(), to: z.string() })).query(async ({ input }) => {
    const logs = await db.aIUsageLog.findMany({ where: { createdAt: { gte: new Date(input.from), lte: new Date(input.to) } } });
    const routing: Record<string, Record<string, number>> = {};
    for (const log of logs) {
      if (!routing[log.feature]) routing[log.feature] = {};
      routing[log.feature][log.provider] = (routing[log.feature][log.provider] || 0) + 1;
    }
    return routing;
  }),

  "reports.export": publicProcedure.input(z.object({ reportType: z.string(), format: z.string().optional() })).query(async ({ input }) => {
    return { reportType: input.reportType, format: input.format || "csv", url: null, message: "Export not yet implemented" };
  }),
});
