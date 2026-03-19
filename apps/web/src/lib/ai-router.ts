import { db } from "@/lib/db";
import * as openai from "@/lib/integrations/openai";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// ── Anthropic completion wrapper ──────────────────────────────────────
async function anthropicComplete(params: { systemPrompt: string; userPrompt: string; model?: string; temperature?: number; maxTokens?: number; feature?: string; matterId?: string }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Anthropic API key not configured");
  const model = params.model || "claude-sonnet-4-20250514";
  const start = Date.now();
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model, max_tokens: params.maxTokens || 4096, temperature: params.temperature ?? 0.3, system: params.systemPrompt, messages: [{ role: "user", content: params.userPrompt }] }),
  });
  const latencyMs = Date.now() - start;
  if (!res.ok) {
    const errText = await res.text();
    await logAnthropicUsage({ model, feature: params.feature || "unknown", matterId: params.matterId, inputTokens: 0, outputTokens: 0, latencyMs, status: "FAILED", error: errText });
    throw new Error(`Anthropic error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const content = data.content?.[0]?.text || "";
  const usage = data.usage || {};
  await logAnthropicUsage({ model, feature: params.feature || "unknown", matterId: params.matterId, inputTokens: usage.input_tokens || 0, outputTokens: usage.output_tokens || 0, latencyMs, status: "SUCCESS" });
  return { content, provider: "ANTHROPIC" as const, model, usage: { inputTokens: usage.input_tokens || 0, outputTokens: usage.output_tokens || 0, totalTokens: (usage.input_tokens || 0) + (usage.output_tokens || 0) }, latencyMs };
}

async function logAnthropicUsage(params: { model: string; feature: string; matterId?: string; inputTokens: number; outputTokens: number; latencyMs: number; status: string; error?: string }) {
  try {
    await db.aIUsageLog.create({
      data: {
        provider: "ANTHROPIC", model: params.model, feature: params.feature, matterId: params.matterId,
        requestType: "CHAT", inputTokens: params.inputTokens, outputTokens: params.outputTokens,
        totalTokens: params.inputTokens + params.outputTokens, latencyMs: params.latencyMs,
        status: params.status as any, errorMessage: params.error,
        cost: estimateAnthropicCost(params.model, params.inputTokens, params.outputTokens),
      },
    });
  } catch { /* logging should not break requests */ }
}

function estimateAnthropicCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4-20250514": { input: 3, output: 15 },
    "claude-haiku-4-5-20251001": { input: 1, output: 5 },
    "claude-opus-4-6": { input: 15, output: 75 },
  };
  const p = pricing[model] || pricing["claude-sonnet-4-20250514"];
  return (inputTokens / 1_000_000) * p.input + (outputTokens / 1_000_000) * p.output;
}

// ── Routing ──────────────────────────────────────────────────────────
async function getRoutingConfig() {
  const configs = await db.aIIntegration.findMany();
  const anthropicConfig = configs.find(c => c.provider === "ANTHROPIC");
  const openaiConfig = configs.find(c => c.provider === "OPENAI");
  const strategy = openaiConfig?.routingStrategy || anthropicConfig?.routingStrategy || "anthropic_primary";
  return { anthropicConfig, openaiConfig, strategy, anthropicEnabled: true /* always available via env */, openaiEnabled: openaiConfig?.isEnabled && !!openaiConfig?.apiKey };
}

const OPENAI_ONLY_FEATURES = ["embedding", "embeddings", "transcription", "image_generation"];
const ANTHROPIC_PREFERRED = ["document_review", "legal_research", "rfe_analysis", "compliance_review", "deposition_analysis", "research"];

export async function route(params: { feature: string; requestType?: string; complexity?: string; matterId?: string; preferredProvider?: string; requiresEmbedding?: boolean; requiresTranscription?: boolean; requiresImage?: boolean }) {
  const { strategy, openaiEnabled } = await getRoutingConfig();

  // Always route OpenAI-only capabilities
  if (params.requiresEmbedding || OPENAI_ONLY_FEATURES.includes(params.feature)) return { provider: "OPENAI" as const, model: "text-embedding-3-small", reasoning: "Embeddings only available via OpenAI" };
  if (params.requiresTranscription) return { provider: "OPENAI" as const, model: "whisper-1", reasoning: "Transcription only available via OpenAI Whisper" };
  if (params.requiresImage) return { provider: "OPENAI" as const, model: "dall-e-3", reasoning: "Image generation only available via OpenAI DALL-E" };

  if (!openaiEnabled) return { provider: "ANTHROPIC" as const, model: "claude-sonnet-4-20250514", reasoning: "OpenAI not configured, using Anthropic" };

  if (strategy === "openai_primary") return { provider: "OPENAI" as const, model: "gpt-4o", reasoning: "OpenAI primary strategy" };
  if (strategy === "cost_optimized") {
    if (params.complexity === "simple") return { provider: "OPENAI" as const, model: "gpt-4o-mini", reasoning: "Cost optimized: simple task → gpt-4o-mini" };
    return { provider: "ANTHROPIC" as const, model: "claude-sonnet-4-20250514", reasoning: "Cost optimized: complex task → Claude" };
  }
  if (strategy === "best_model" && ANTHROPIC_PREFERRED.includes(params.feature)) return { provider: "ANTHROPIC" as const, model: "claude-sonnet-4-20250514", reasoning: `Best model for ${params.feature}: Claude` };

  // Default: anthropic_primary
  return { provider: "ANTHROPIC" as const, model: "claude-sonnet-4-20250514", reasoning: "Anthropic primary strategy" };
}

// ── Universal completion ─────────────────────────────────────────────
export async function complete(params: { feature: string; systemPrompt: string; userPrompt: string; matterId?: string; temperature?: number; maxTokens?: number; responseFormat?: string; jsonSchema?: any; preferredProvider?: string }) {
  const routing = await route({ feature: params.feature, matterId: params.matterId, preferredProvider: params.preferredProvider, complexity: params.userPrompt.length > 2000 ? "complex" : "simple" });

  try {
    if (routing.provider === "OPENAI") {
      const result = await openai.chatCompletion({
        model: routing.model, feature: params.feature, matterId: params.matterId,
        messages: [{ role: "system", content: params.systemPrompt }, { role: "user", content: params.userPrompt }],
        temperature: params.temperature, maxTokens: params.maxTokens,
        responseFormat: params.responseFormat === "json" ? "json_object" : undefined,
      });
      return { content: result.content, provider: "OPENAI" as const, model: result.model, usage: result.usage };
    }
    return await anthropicComplete({ ...params, model: routing.model, feature: params.feature });
  } catch (err) {
    // Fallback to other provider
    try {
      if (routing.provider === "ANTHROPIC") {
        const result = await openai.chatCompletion({
          feature: params.feature, matterId: params.matterId,
          messages: [{ role: "system", content: params.systemPrompt }, { role: "user", content: params.userPrompt }],
          temperature: params.temperature, maxTokens: params.maxTokens,
        });
        return { content: result.content, provider: "OPENAI" as const, model: result.model, usage: result.usage };
      }
      return await anthropicComplete({ ...params, feature: params.feature });
    } catch {
      throw err; // Both providers failed
    }
  }
}

export async function completeStructured(params: { feature: string; systemPrompt: string; userPrompt: string; schema: any; schemaName: string; matterId?: string; preferredProvider?: string }) {
  const routing = await route({ feature: params.feature, matterId: params.matterId, preferredProvider: params.preferredProvider });
  if (routing.provider === "OPENAI") {
    const result = await openai.structuredOutput({ systemPrompt: params.systemPrompt, userPrompt: params.userPrompt, schema: params.schema, schemaName: params.schemaName, feature: params.feature, matterId: params.matterId });
    try { return { data: JSON.parse(result.content), provider: "OPENAI" as const, model: result.model }; } catch { return { data: result.content, provider: "OPENAI" as const, model: result.model }; }
  }
  const result = await anthropicComplete({ ...params, feature: params.feature, systemPrompt: params.systemPrompt + "\n\nRespond ONLY with valid JSON matching this schema: " + JSON.stringify(params.schema) });
  try { return { data: JSON.parse(result.content), provider: "ANTHROPIC" as const, model: result.model }; } catch { return { data: result.content, provider: "ANTHROPIC" as const, model: result.model }; }
}

export async function embed(params: { texts: string[]; model?: string; dimensions?: number; matterId?: string }) {
  const embeddings = await openai.createEmbeddingBatch(params.texts, params.model);
  return embeddings;
}

export async function transcribe(params: { audioContent: string; audioMimeType: string; language?: string; matterId?: string; timestamps?: boolean }) {
  return openai.transcribeAudio({ ...params, feature: "transcription", responseFormat: params.timestamps ? "verbose_json" : "json" });
}

export async function generateImage(params: { prompt: string; size?: string; quality?: string; matterId?: string }) {
  return openai.generateImage({ ...params, feature: "image_generation" });
}

export async function moderate(text: string) {
  return openai.moderateContent(text);
}

export async function getProviderHealth() {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 3600000);
  const logs = await db.aIUsageLog.findMany({ where: { createdAt: { gte: hourAgo } } });
  const anthropicLogs = logs.filter(l => l.provider === "ANTHROPIC");
  const openaiLogs = logs.filter(l => l.provider === "OPENAI");
  const calcHealth = (logs: any[]) => ({
    requests: logs.length,
    avgLatency: logs.length > 0 ? Math.round(logs.reduce((s, l) => s + (l.latencyMs || 0), 0) / logs.length) : 0,
    errorRate: logs.length > 0 ? logs.filter(l => l.status !== "SUCCESS").length / logs.length : 0,
    status: logs.filter(l => l.status === "FAILED").length > logs.length * 0.5 ? "degraded" : "healthy",
  });
  return { anthropic: calcHealth(anthropicLogs), openai: calcHealth(openaiLogs) };
}

export async function getUsageStats(dateRange: { from: Date; to: Date }) {
  const logs = await db.aIUsageLog.findMany({ where: { createdAt: { gte: dateRange.from, lte: dateRange.to } } });
  const byProvider: Record<string, number> = {};
  const byModel: Record<string, number> = {};
  const byFeature: Record<string, number> = {};
  let totalTokens = 0, totalCost = 0, totalLatency = 0;
  for (const log of logs) {
    byProvider[log.provider] = (byProvider[log.provider] || 0) + 1;
    byModel[log.model] = (byModel[log.model] || 0) + 1;
    byFeature[log.feature] = (byFeature[log.feature] || 0) + 1;
    totalTokens += log.totalTokens;
    totalCost += Number(log.cost || 0);
    totalLatency += log.latencyMs || 0;
  }
  return { totalRequests: logs.length, byProvider, byModel, byFeature, totalTokens, totalCost: Math.round(totalCost * 100) / 100, avgLatency: logs.length > 0 ? Math.round(totalLatency / logs.length) : 0, errorRate: logs.length > 0 ? logs.filter(l => l.status !== "SUCCESS").length / logs.length : 0 };
}

export async function getFeaturePerformance(feature: string, dateRange: { from: Date; to: Date }) {
  const logs = await db.aIUsageLog.findMany({ where: { feature, createdAt: { gte: dateRange.from, lte: dateRange.to } } });
  const anthropic = logs.filter(l => l.provider === "ANTHROPIC");
  const oa = logs.filter(l => l.provider === "OPENAI");
  const calc = (subset: any[]) => ({ requests: subset.length, avgLatency: subset.length > 0 ? Math.round(subset.reduce((s: number, l: any) => s + (l.latencyMs || 0), 0) / subset.length) : 0, avgCost: subset.length > 0 ? subset.reduce((s: number, l: any) => s + Number(l.cost || 0), 0) / subset.length : 0, errorRate: subset.length > 0 ? subset.filter((l: any) => l.status !== "SUCCESS").length / subset.length : 0 });
  return { feature, anthropic: calc(anthropic), openai: calc(oa) };
}
