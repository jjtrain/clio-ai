const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

async function callClaude(params: {
  system: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: params.model || "claude-sonnet-4-20250514",
      max_tokens: params.maxTokens || 4000,
      system: params.system,
      messages: [{ role: "user", content: params.userMessage }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[AI Research] API error:", response.status, text);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
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

export async function conductLegalResearch(params: {
  query: string;
  jurisdiction: string;
  matterContext?: { name: string; description?: string; practiceArea?: string; parties?: string[] };
  model?: string;
}): Promise<{
  analysis: string;
  suggestedCases: Array<{ name: string; citation: string; relevance: string; summary: string }>;
  suggestedStatutes: Array<{ title: string; citation: string; relevance: string }>;
  strategy: string;
}> {
  const matterInfo = params.matterContext
    ? `\n\nMatter Context:\n- Name: ${params.matterContext.name}\n- Description: ${params.matterContext.description || "N/A"}\n- Practice Area: ${params.matterContext.practiceArea || "General"}\n- Parties: ${params.matterContext.parties?.join(", ") || "N/A"}`
    : "";

  const result = await callClaude({
    system: `You are an expert legal research assistant. Based on the query and matter context, provide: 1) A thorough legal analysis of the issue (well-structured HTML with headings), 2) Relevant case law citations with brief summaries and relevance explanations (note: provide your best knowledge of real cases but advise the attorney to verify all citations), 3) Relevant statutes and regulations, 4) Strategic recommendations. Format your response as JSON with fields: analysis (HTML string), suggestedCases (array of {name, citation, relevance: string, summary}), suggestedStatutes (array of {title, citation, relevance}), strategy (HTML string). Jurisdiction: ${params.jurisdiction}. Return ONLY valid JSON.`,
    userMessage: `Research this legal issue:\n\n${params.query}${matterInfo}`,
    model: params.model,
    maxTokens: 4000,
  });

  return parseJson(result, {
    analysis: "<p>Unable to generate analysis.</p>",
    suggestedCases: [],
    suggestedStatutes: [],
    strategy: "<p>Unable to generate strategy.</p>",
  });
}

export async function analyzeCase(params: {
  caseText: string;
  question: string;
  model?: string;
}): Promise<{ analysis: string; keyHoldings: string[]; applicability: string }> {
  const result = await callClaude({
    system: `You are a legal analyst. Analyze the provided case text in the context of the question asked. Provide: a detailed analysis, key holdings as bullet points, and how this case might apply to the attorney's situation. Return ONLY valid JSON with: analysis (HTML), keyHoldings (string array), applicability (HTML).`,
    userMessage: `Question: ${params.question}\n\nCase Text:\n${params.caseText.slice(0, 10000)}`,
    model: params.model,
    maxTokens: 3000,
  });

  return parseJson(result, {
    analysis: "<p>Unable to analyze case.</p>",
    keyHoldings: [],
    applicability: "<p>Unable to determine applicability.</p>",
  });
}

export async function compareAuthority(params: {
  sources: Array<{ title: string; content: string }>;
  issue: string;
  model?: string;
}): Promise<{ comparison: string; strengths: string; weaknesses: string; recommendation: string }> {
  const sourcesText = params.sources
    .map((s, i) => `Source ${i + 1}: ${s.title}\n${s.content}`)
    .join("\n\n---\n\n");

  const result = await callClaude({
    system: `You are a legal research assistant comparing legal authorities. Analyze how these sources relate to the issue. Provide: a comparison analysis, strengths of the position, weaknesses/counterarguments, and your strategic recommendation. Return ONLY valid JSON with: comparison (HTML), strengths (HTML), weaknesses (HTML), recommendation (HTML).`,
    userMessage: `Issue: ${params.issue}\n\nSources:\n${sourcesText.slice(0, 10000)}`,
    model: params.model,
    maxTokens: 3000,
  });

  return parseJson(result, {
    comparison: "<p>Unable to compare authorities.</p>",
    strengths: "<p>N/A</p>",
    weaknesses: "<p>N/A</p>",
    recommendation: "<p>N/A</p>",
  });
}

export async function generateMemo(params: {
  matterContext: any;
  researchNotes: string[];
  question: string;
  model?: string;
}): Promise<{ memo: string }> {
  const notesText = params.researchNotes.length > 0
    ? params.researchNotes.map((n, i) => `Note ${i + 1}: ${n}`).join("\n\n")
    : "No research notes provided.";

  const matterText = params.matterContext
    ? `Matter: ${params.matterContext.name || "N/A"}\nClient: ${params.matterContext.clientName || "N/A"}\nPractice Area: ${params.matterContext.practiceArea || "General"}\nDescription: ${params.matterContext.description || "N/A"}`
    : "No matter context provided.";

  const result = await callClaude({
    system: `You are a senior attorney drafting a legal research memorandum. Based on the matter context, research notes, and question presented, draft a professional legal memo with: Question Presented, Brief Answer, Statement of Facts (from matter context), Discussion (thorough analysis with citations to the research notes), and Conclusion. Format as professional HTML. Return ONLY valid JSON with: memo (HTML string).`,
    userMessage: `Question Presented: ${params.question}\n\nMatter Context:\n${matterText}\n\nResearch Notes:\n${notesText}`,
    model: params.model,
    maxTokens: 4000,
  });

  return parseJson(result, { memo: "<p>Unable to generate memo.</p>" });
}

export async function suggestSearchQueries(params: {
  issue: string;
  jurisdiction: string;
  model?: string;
}): Promise<Array<{ query: string; database: string; explanation: string }>> {
  const result = await callClaude({
    system: `You are a legal research strategist. Suggest effective search queries for researching this legal issue. For each, specify which database would be best (Westlaw, LexisNexis, vLex, Google Scholar, state court records) and explain why. Return ONLY a valid JSON array of {query, database, explanation}.`,
    userMessage: `Legal issue: ${params.issue}\nJurisdiction: ${params.jurisdiction}`,
    model: params.model,
    maxTokens: 2000,
  });

  return parseJsonArray(result, []);
}
