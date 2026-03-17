const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

async function callClaude(system: string, userMessage: string, maxTokens = 6000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system, messages: [{ role: "user", content: userMessage }] }),
  });
  if (!res.ok) throw new Error(`AI API error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

const DOC_PROMPTS: Record<string, string> = {
  Motion: "You are a senior litigation attorney drafting a motion. Draft a complete, properly formatted motion including caption, preliminary statement, statement of facts, legal argument with citations, and conclusion with prayer for relief.",
  Brief: "You are a senior attorney drafting a legal memorandum. Include: Question Presented, Short Answer, Statement of Facts, Discussion (IRAC structure with citations), and Conclusion.",
  Letter: "You are an attorney drafting a professional legal letter. Use formal letterhead format with date, recipient address, re line, body, and closing.",
  Contract: "You are a transactional attorney drafting a contract. Include parties, recitals, definitions, operative clauses, representations and warranties, indemnification, termination, governing law, and signature blocks.",
  Agreement: "You are a transactional attorney drafting an agreement. Include parties, recitals, definitions, operative clauses, representations, indemnification, termination, governing law, and signature blocks.",
  Affidavit: "You are an attorney drafting an affidavit. Include proper caption, venue, affiant identification, numbered paragraphs of sworn statements, jurat, and notary block.",
  Petition: "You are a family law attorney drafting a petition. Include proper caption, verified allegations in numbered paragraphs, prayer for relief, and verification.",
  Stipulation: "You are an attorney drafting a stipulation. Include caption, recitals (WHEREAS clauses), agreement terms (NOW THEREFORE), and signature blocks.",
  Memo: "You are a senior attorney drafting an internal legal memorandum. Include: Question Presented, Brief Answer, Facts, Discussion, and Conclusion.",
  Order: "You are drafting a proposed court order. Include proper caption, recitals, ordered provisions in numbered paragraphs, and signature line for the judge.",
};

export async function generateFromTemplate(templateContent: string, fieldValues: Record<string, any>, aiPrompt?: string, customInstructions?: string): Promise<string> {
  let content = templateContent;
  for (const [key, value] of Object.entries(fieldValues)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), String(value || ""));
  }

  if (aiPrompt || content.includes("{{AI_GENERATE}}")) {
    const system = aiPrompt || "You are a legal document drafting assistant. Complete and refine this legal document. Fill in any {{AI_GENERATE}} sections with appropriate professional legal content.";
    content = await callClaude(system, `${customInstructions ? `Instructions: ${customInstructions}\n\n` : ""}Complete and refine this document:\n\n${content}`);
  }

  return content;
}

export async function draftFreeform(params: { documentType: string; practiceArea: string; jurisdiction: string; instructions: string; matterContext?: string; clientContext?: string }): Promise<string> {
  const basePrompt = DOC_PROMPTS[params.documentType] || `You are a senior attorney drafting a ${params.documentType}.`;
  const system = `${basePrompt} Jurisdiction: ${params.jurisdiction}. Practice area: ${params.practiceArea}. Format as clean professional HTML with proper legal formatting.`;
  const userMsg = `${params.instructions}${params.matterContext ? `\n\nMatter Context: ${params.matterContext}` : ""}${params.clientContext ? `\n\nClient Context: ${params.clientContext}` : ""}`;
  return callClaude(system, userMsg, 8000);
}

export async function refineDocument(existingContent: string, instructions: string): Promise<string> {
  return callClaude(
    "You are a legal editor. Revise the document according to the instructions. Maintain professional legal formatting. Return the complete revised document in HTML.",
    `Instructions: ${instructions}\n\nDocument:\n${existingContent.slice(0, 15000)}`,
    8000
  );
}

export async function suggestImprovements(content: string, documentType: string): Promise<Array<{ suggestion: string; section?: string; priority: string }>> {
  const raw = await callClaude(
    "You are a legal writing expert. Review this legal document and suggest specific improvements. Return JSON array of {suggestion, section (optional), priority ('high'|'medium'|'low')}.",
    `Document type: ${documentType}\n\nDocument:\n${content.slice(0, 12000)}`
  );
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch { return []; }
}

export async function generateFromOutline(outline: string, documentType: string, context: string): Promise<string> {
  const system = DOC_PROMPTS[documentType] || `You are a senior attorney expanding an outline into a complete ${documentType}.`;
  return callClaude(`${system} Expand this outline into a complete, professionally formatted legal document in HTML.`, `Outline:\n${outline}\n\nContext: ${context}`, 8000);
}
