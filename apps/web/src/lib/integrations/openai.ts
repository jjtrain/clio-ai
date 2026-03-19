import { db } from "@/lib/db";

const API_BASE = "https://api.openai.com/v1";

async function getConfig() {
  const integration = await db.aIIntegration.findFirst({ where: { provider: "OPENAI", isEnabled: true } });
  if (!integration?.apiKey) return null;
  return integration;
}

function headers(apiKey: string, orgId?: string | null) {
  const h: Record<string, string> = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  if (orgId) h["OpenAI-Organization"] = orgId;
  return h;
}

export async function testConnection() {
  const config = await getConfig();
  if (!config) return { success: false, error: "OpenAI not configured" };
  try {
    const res = await fetch(`${API_BASE}/models`, { headers: headers(config.apiKey!, config.organizationId) });
    if (!res.ok) return { success: false, error: `API error: ${res.status}` };
    const data = await res.json();
    const models = (data.data || []).map((m: any) => m.id).filter((id: string) => id.startsWith("gpt") || id.startsWith("o1") || id.startsWith("o3") || id.includes("embedding") || id.includes("whisper") || id.includes("dall-e") || id.includes("tts"));
    return { success: true, availableModels: models, organization: config.organizationId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function chatCompletion(params: {
  model?: string; messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number; maxTokens?: number; responseFormat?: "text" | "json_object" | "json_schema";
  jsonSchema?: any; tools?: any[]; toolChoice?: any; feature?: string; matterId?: string;
}) {
  const config = await getConfig();
  if (!config) throw new Error("OpenAI not configured");
  const model = params.model || config.defaultModel || "gpt-4o";
  const start = Date.now();
  const body: any = { model, messages: params.messages, temperature: params.temperature ?? Number(config.temperatureDefault ?? 0.3), max_tokens: params.maxTokens ?? config.maxTokensPerRequest };
  if (params.responseFormat === "json_object") body.response_format = { type: "json_object" };
  if (params.responseFormat === "json_schema" && params.jsonSchema) body.response_format = { type: "json_schema", json_schema: params.jsonSchema };
  if (params.tools) { body.tools = params.tools; if (params.toolChoice) body.tool_choice = params.toolChoice; }

  const res = await fetch(`${API_BASE}/chat/completions`, { method: "POST", headers: headers(config.apiKey!, config.organizationId), body: JSON.stringify(body) });
  const latencyMs = Date.now() - start;
  if (!res.ok) {
    const errText = await res.text();
    await logUsage({ model, feature: params.feature || "unknown", matterId: params.matterId, requestType: "CHAT", inputTokens: 0, outputTokens: 0, latencyMs, status: res.status === 429 ? "RATE_LIMITED" : "FAILED", error: errText });
    throw new Error(`OpenAI API error ${res.status}: ${errText}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";
  const usage = data.usage || {};
  const cost = estimateCost({ model, inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0 });
  await logUsage({ model, feature: params.feature || "unknown", matterId: params.matterId, requestType: "CHAT", inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0, cost: cost.estimatedCost, latencyMs, status: "SUCCESS" });
  return { content, usage: { inputTokens: usage.prompt_tokens || 0, outputTokens: usage.completion_tokens || 0, totalTokens: usage.total_tokens || 0 }, model, finishReason: data.choices?.[0]?.finish_reason, cost: cost.estimatedCost };
}

export async function chatCompletionWithRetry(params: Parameters<typeof chatCompletion>[0], retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await chatCompletion(params);
    } catch (err: any) {
      if (attempt === retries || !err.message?.includes("429")) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  throw new Error("Max retries exceeded");
}

export async function structuredOutput(params: { model?: string; systemPrompt: string; userPrompt: string; schema: any; schemaName: string; feature?: string; matterId?: string }) {
  return chatCompletion({
    model: params.model, feature: params.feature, matterId: params.matterId,
    messages: [{ role: "system", content: params.systemPrompt }, { role: "user", content: params.userPrompt }],
    responseFormat: "json_schema", jsonSchema: { name: params.schemaName, strict: true, schema: params.schema },
  });
}

export async function createEmbedding(params: { input: string | string[]; model?: string; dimensions?: number; feature?: string; matterId?: string }) {
  const config = await getConfig();
  if (!config) throw new Error("OpenAI not configured");
  const model = params.model || config.defaultEmbeddingModel || "text-embedding-3-small";
  const start = Date.now();
  const body: any = { model, input: params.input };
  if (params.dimensions) body.dimensions = params.dimensions;
  const res = await fetch(`${API_BASE}/embeddings`, { method: "POST", headers: headers(config.apiKey!, config.organizationId), body: JSON.stringify(body) });
  const latencyMs = Date.now() - start;
  if (!res.ok) { const err = await res.text(); throw new Error(`Embedding error: ${err}`); }
  const data = await res.json();
  const tokens = data.usage?.total_tokens || 0;
  const cost = estimateCost({ model, inputTokens: tokens, outputTokens: 0, embeddingTokens: tokens });
  await logUsage({ model, feature: params.feature || "embedding", matterId: params.matterId, requestType: "EMBEDDING", inputTokens: tokens, outputTokens: 0, cost: cost.estimatedCost, latencyMs, status: "SUCCESS" });
  return { embeddings: data.data.map((d: any) => ({ embedding: d.embedding, index: d.index })), usage: { totalTokens: tokens }, model };
}

export async function createEmbeddingBatch(texts: string[], model?: string, batchSize = 100) {
  const allEmbeddings: { embedding: number[]; index: number }[] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const result = await createEmbedding({ input: batch, model });
    allEmbeddings.push(...result.embeddings.map((e: any, j: number) => ({ embedding: e.embedding, index: i + j })));
  }
  return allEmbeddings;
}

export async function transcribeAudio(params: { audioContent: string; audioMimeType: string; language?: string; prompt?: string; responseFormat?: string; timestampGranularity?: string; feature?: string; matterId?: string }) {
  const config = await getConfig();
  if (!config) throw new Error("OpenAI not configured");
  const model = config.defaultWhisperModel || "whisper-1";
  const start = Date.now();
  const audioBuffer = Buffer.from(params.audioContent, "base64");
  const ext = params.audioMimeType.split("/")[1] || "mp3";
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: params.audioMimeType }), `audio.${ext}`);
  formData.append("model", model);
  if (params.language) formData.append("language", params.language);
  if (params.prompt) formData.append("prompt", params.prompt);
  formData.append("response_format", params.responseFormat || "verbose_json");
  if (params.timestampGranularity) formData.append("timestamp_granularities[]", params.timestampGranularity);

  const res = await fetch(`${API_BASE}/audio/transcriptions`, { method: "POST", headers: { Authorization: `Bearer ${config.apiKey}` }, body: formData as any });
  const latencyMs = Date.now() - start;
  if (!res.ok) { const err = await res.text(); throw new Error(`Transcription error: ${err}`); }
  const data = await res.json();
  const durationSec = Math.round(data.duration || audioBuffer.length / 16000);
  const cost = estimateCost({ model, inputTokens: 0, outputTokens: 0, audioSeconds: durationSec });
  await logUsage({ model, feature: params.feature || "transcription", matterId: params.matterId, requestType: "TRANSCRIPTION", inputTokens: 0, outputTokens: 0, audioDuration: durationSec, cost: cost.estimatedCost, latencyMs, status: "SUCCESS" });
  return { text: data.text, segments: data.segments, words: data.words, duration: data.duration };
}

export async function translateAudio(params: { audioContent: string; audioMimeType: string }) {
  const config = await getConfig();
  if (!config) throw new Error("OpenAI not configured");
  const audioBuffer = Buffer.from(params.audioContent, "base64");
  const ext = params.audioMimeType.split("/")[1] || "mp3";
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer], { type: params.audioMimeType }), `audio.${ext}`);
  formData.append("model", config.defaultWhisperModel || "whisper-1");
  const res = await fetch(`${API_BASE}/audio/translations`, { method: "POST", headers: { Authorization: `Bearer ${config.apiKey}` }, body: formData as any });
  if (!res.ok) { const err = await res.text(); throw new Error(`Translation error: ${err}`); }
  const data = await res.json();
  return { text: data.text };
}

export async function generateImage(params: { prompt: string; model?: string; size?: string; quality?: string; style?: string; n?: number; feature?: string; matterId?: string }) {
  const config = await getConfig();
  if (!config) throw new Error("OpenAI not configured");
  const model = params.model || config.defaultImageModel || "dall-e-3";
  const start = Date.now();
  const body: any = { model, prompt: params.prompt, n: params.n || 1, size: params.size || "1024x1024" };
  if (params.quality) body.quality = params.quality;
  if (params.style) body.style = params.style;
  const res = await fetch(`${API_BASE}/images/generations`, { method: "POST", headers: headers(config.apiKey!, config.organizationId), body: JSON.stringify(body) });
  const latencyMs = Date.now() - start;
  if (!res.ok) { const err = await res.text(); throw new Error(`Image generation error: ${err}`); }
  const data = await res.json();
  const imageCount = data.data?.length || 0;
  const cost = estimateCost({ model, inputTokens: 0, outputTokens: 0, imageCount });
  await logUsage({ model, feature: params.feature || "image_generation", matterId: params.matterId, requestType: "IMAGE_GENERATION", inputTokens: 0, outputTokens: 0, imageCount, cost: cost.estimatedCost, latencyMs, status: "SUCCESS" });
  return { images: data.data.map((img: any) => ({ url: img.url, revisedPrompt: img.revised_prompt })) };
}

export async function moderateContent(input: string) {
  const config = await getConfig();
  if (!config) throw new Error("OpenAI not configured");
  const res = await fetch(`${API_BASE}/moderations`, { method: "POST", headers: headers(config.apiKey!, config.organizationId), body: JSON.stringify({ input }) });
  if (!res.ok) { const err = await res.text(); throw new Error(`Moderation error: ${err}`); }
  const data = await res.json();
  const result = data.results?.[0] || {};
  return { flagged: result.flagged || false, categories: result.categories || {}, categoryScores: result.category_scores || {} };
}

export async function listModels() {
  const config = await getConfig();
  if (!config) throw new Error("OpenAI not configured");
  const res = await fetch(`${API_BASE}/models`, { headers: headers(config.apiKey!, config.organizationId) });
  if (!res.ok) throw new Error("Failed to list models");
  const data = await res.json();
  return (data.data || []).map((m: any) => ({ id: m.id, created: m.created, ownedBy: m.owned_by }));
}

const PRICING: Record<string, { input: number; output: number; embedding?: number; audio?: number; image?: number }> = {
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "o1": { input: 15, output: 60 },
  "o3-mini": { input: 1.1, output: 4.4 },
  "text-embedding-3-large": { input: 0.13, output: 0, embedding: 0.13 },
  "text-embedding-3-small": { input: 0.02, output: 0, embedding: 0.02 },
  "whisper-1": { input: 0, output: 0, audio: 0.006 },
  "dall-e-3": { input: 0, output: 0, image: 0.04 },
};

export function estimateCost(params: { model: string; inputTokens: number; outputTokens: number; embeddingTokens?: number; audioSeconds?: number; imageCount?: number }) {
  const pricing = PRICING[params.model] || PRICING["gpt-4o-mini"];
  let cost = 0;
  cost += (params.inputTokens / 1_000_000) * pricing.input;
  cost += (params.outputTokens / 1_000_000) * pricing.output;
  if (params.embeddingTokens && pricing.embedding) cost += (params.embeddingTokens / 1_000_000) * pricing.embedding;
  if (params.audioSeconds && pricing.audio) cost += (params.audioSeconds / 60) * pricing.audio;
  if (params.imageCount && pricing.image) cost += params.imageCount * pricing.image;
  return { estimatedCost: Math.round(cost * 1_000_000) / 1_000_000, breakdown: { input: (params.inputTokens / 1_000_000) * pricing.input, output: (params.outputTokens / 1_000_000) * pricing.output } };
}

export async function logUsage(params: { model: string; feature: string; matterId?: string; requestType: string; inputTokens: number; outputTokens: number; audioDuration?: number; imageCount?: number; cost?: number; latencyMs?: number; status: string; error?: string }) {
  try {
    await db.aIUsageLog.create({
      data: {
        provider: "OPENAI", model: params.model, feature: params.feature, matterId: params.matterId,
        requestType: params.requestType as any, inputTokens: params.inputTokens, outputTokens: params.outputTokens,
        totalTokens: params.inputTokens + params.outputTokens, audioDurationSeconds: params.audioDuration,
        imageCount: params.imageCount, cost: params.cost, latencyMs: params.latencyMs,
        status: params.status as any, errorMessage: params.error,
      },
    });
    if (params.cost && params.cost > 0) {
      await db.aIIntegration.updateMany({ where: { provider: "OPENAI" }, data: { currentMonthSpend: { increment: params.cost }, lastUsedAt: new Date() } });
    }
  } catch { /* logging should not break requests */ }
  return null;
}

export async function checkBudget() {
  const config = await getConfig();
  const currentSpend = Number(config?.currentMonthSpend ?? 0);
  const budgetCap = Number(config?.monthlyBudgetCap ?? 0);
  const percentUsed = budgetCap > 0 ? (currentSpend / budgetCap) * 100 : 0;
  return { currentSpend, budgetCap, percentUsed, isBlocked: budgetCap > 0 && currentSpend >= budgetCap };
}
