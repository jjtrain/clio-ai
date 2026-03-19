import * as aiRouter from "@/lib/ai-router";

async function callClaude(params: {
  system: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const result = await aiRouter.complete({
    feature: "document_generation",
    systemPrompt: params.system,
    userPrompt: params.userMessage,
    maxTokens: params.maxTokens || 4000,
  });
  return result.content;
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : fallback;
  } catch {
    return fallback;
  }
}

export async function generateDocumentFromPrompt(params: {
  prompt: string;
  matterContext?: { name: string; description?: string; practiceArea?: string; clientName?: string; parties?: string[] };
  firmInfo?: { name?: string; address?: string; phone?: string; email?: string };
  model?: string;
}): Promise<{ title: string; content: string }> {
  const contextParts: string[] = [];
  if (params.matterContext) {
    contextParts.push(`Matter: ${params.matterContext.name}`);
    if (params.matterContext.description) contextParts.push(`Description: ${params.matterContext.description}`);
    if (params.matterContext.practiceArea) contextParts.push(`Practice Area: ${params.matterContext.practiceArea}`);
    if (params.matterContext.clientName) contextParts.push(`Client: ${params.matterContext.clientName}`);
    if (params.matterContext.parties?.length) contextParts.push(`Parties: ${params.matterContext.parties.join(", ")}`);
  }
  if (params.firmInfo) {
    const f = params.firmInfo;
    contextParts.push(`Firm: ${[f.name, f.address, f.phone, f.email].filter(Boolean).join(" | ")}`);
  }

  const result = await callClaude({
    system: `You are an expert legal document drafter. Generate a professional legal document based on the request. Use proper legal formatting with headings, numbered paragraphs, and formal language. Include all standard clauses appropriate for the document type. Use the provided matter and firm context to personalize the document. Format as clean HTML with proper structure. Return JSON with 'title' (document title) and 'content' (full HTML document). Do NOT include signature blocks - those are handled separately. Return ONLY valid JSON.`,
    userMessage: `${params.prompt}${contextParts.length > 0 ? `\n\nContext:\n${contextParts.join("\n")}` : ""}`,
    model: params.model,
    maxTokens: 4000,
  });

  return parseJson(result, { title: "Untitled Document", content: "<p>Unable to generate document.</p>" });
}

export function generateFromTemplate(templateContent: string, variables: Record<string, string>): string {
  let content = templateContent;
  for (const [key, value] of Object.entries(variables)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return content;
}

export async function suggestTemplateVariables(params: {
  documentContent: string;
  model?: string;
}): Promise<Array<{ name: string; label: string; type: string }>> {
  const result = await callClaude({
    system: `Analyze this legal document template and identify all variable fields that should be customizable. Look for: party names, dates, dollar amounts, addresses, case numbers, court names, specific terms, and any other values that would change between uses. Return ONLY a valid JSON array of {name (UPPER_SNAKE_CASE), label (human readable), type ('text'|'date'|'number'|'select'|'textarea')}.`,
    userMessage: params.documentContent.slice(0, 8000),
    model: params.model,
    maxTokens: 2000,
  });

  return parseJsonArray(result, []);
}

export async function improveDocument(params: {
  content: string;
  instructions: string;
  model?: string;
}): Promise<{ content: string; changes: string[] }> {
  const result = await callClaude({
    system: `You are a legal editor. Improve the provided legal document according to the instructions. Make professional improvements while maintaining legal accuracy. Return ONLY valid JSON with 'content' (improved HTML) and 'changes' (array of strings describing what you changed).`,
    userMessage: `Instructions: ${params.instructions}\n\nDocument:\n${params.content.slice(0, 10000)}`,
    model: params.model,
    maxTokens: 4000,
  });

  return parseJson(result, { content: params.content, changes: ["No changes were made"] });
}

export async function assembleDocumentSetSuggestion(params: {
  matterType: string;
  practiceArea: string;
  model?: string;
}): Promise<Array<{ templateCategory: string; title: string; description: string; order: number }>> {
  const result = await callClaude({
    system: `You are a legal practice management expert. For a ${params.practiceArea} ${params.matterType} matter, suggest the complete set of documents that should be prepared. Return ONLY a valid JSON array of {templateCategory (matching: ENGAGEMENT/PLEADING/MOTION/LETTER/AGREEMENT/DISCOVERY/COURT_FORM/OTHER), title (document name), description (brief purpose), order (suggested preparation order)}.`,
    userMessage: `Suggest documents for a ${params.practiceArea} ${params.matterType} matter.`,
    model: params.model,
    maxTokens: 2000,
  });

  return parseJsonArray(result, []);
}
