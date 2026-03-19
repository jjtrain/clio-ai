import * as aiRouter from "@/lib/ai-router";

async function callClaude(params: {
  system: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const result = await aiRouter.complete({
    feature: "ai_assistant",
    systemPrompt: params.system,
    userPrompt: params.userMessage,
    maxTokens: params.maxTokens || 2000,
  });
  return result.content;
}

export async function extractDeadlinesFromText(params: {
  documentName: string;
  documentText: string;
  matterName: string;
  model?: string;
}): Promise<{
  deadlines: Array<{
    title: string;
    date: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  }>;
}> {
  const result = await callClaude({
    system: `You are a legal assistant that extracts deadlines, filing dates, court dates, and important dates from legal documents. Return ONLY valid JSON with no extra text.`,
    userMessage: `Extract all deadlines and important dates from this document for the matter "${params.matterName}".

Document: "${params.documentName}"
Content:
${params.documentText.slice(0, 8000)}

Return JSON in this exact format:
{"deadlines": [{"title": "string", "date": "YYYY-MM-DD", "description": "string", "priority": "LOW|MEDIUM|HIGH|URGENT"}]}

If no deadlines are found, return {"deadlines": []}`,
    model: params.model,
  });

  try {
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { deadlines: [] };
  } catch {
    return { deadlines: [] };
  }
}

export async function draftClientUpdate(params: {
  matterName: string;
  clientName: string;
  recentActivities: string[];
  practiceArea?: string;
  model?: string;
}): Promise<{ subject: string; body: string }> {
  const result = await callClaude({
    system: `You are a professional legal assistant drafting client update emails. Write in a professional but warm tone. Return ONLY valid JSON.`,
    userMessage: `Draft a client update email for:
- Client: ${params.clientName}
- Matter: ${params.matterName}
- Practice Area: ${params.practiceArea || "General"}
- Recent activities:
${params.recentActivities.map((a) => `  - ${a}`).join("\n")}

Return JSON: {"subject": "string", "body": "string (plain text with line breaks)"}`,
    model: params.model,
  });

  try {
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { subject: "Matter Update", body: "No content generated." };
  } catch {
    return { subject: "Matter Update", body: "No content generated." };
  }
}

export async function generateInvoiceFromTimeEntries(params: {
  matterName: string;
  clientName: string;
  timeEntries: Array<{ description: string; duration: number; date: string; rate?: number }>;
  model?: string;
}): Promise<{
  lineItems: Array<{ description: string; hours: number; rate: number; amount: number }>;
  notes: string;
  total: number;
}> {
  const result = await callClaude({
    system: `You are a legal billing assistant. Group and summarize time entries into clear invoice line items. Return ONLY valid JSON.`,
    userMessage: `Generate invoice line items from these time entries for matter "${params.matterName}" (Client: ${params.clientName}):

${params.timeEntries.map((e) => `- ${e.date}: ${e.description} (${e.duration} min, $${e.rate || 450}/hr)`).join("\n")}

Group related entries where sensible. Return JSON:
{"lineItems": [{"description": "string", "hours": number, "rate": number, "amount": number}], "notes": "string", "total": number}`,
    model: params.model,
  });

  try {
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { lineItems: [], notes: "", total: 0 };
  } catch {
    return { lineItems: [], notes: "", total: 0 };
  }
}

export async function summarizeMatter(params: {
  matterName: string;
  clientName: string;
  practiceArea?: string;
  description?: string;
  activities: string[];
  tasks: string[];
  documents: string[];
  model?: string;
}): Promise<{ summary: string; keyIssues: string[]; nextSteps: string[] }> {
  const result = await callClaude({
    system: `You are a legal assistant providing concise matter summaries for attorneys. Return ONLY valid JSON.`,
    userMessage: `Summarize this matter:
- Name: ${params.matterName}
- Client: ${params.clientName}
- Practice Area: ${params.practiceArea || "General"}
- Description: ${params.description || "N/A"}
- Recent Activities: ${params.activities.length > 0 ? params.activities.join("; ") : "None"}
- Open Tasks: ${params.tasks.length > 0 ? params.tasks.join("; ") : "None"}
- Documents: ${params.documents.length > 0 ? params.documents.join("; ") : "None"}

Return JSON: {"summary": "2-3 paragraph summary", "keyIssues": ["string"], "nextSteps": ["string"]}`,
    model: params.model,
  });

  try {
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { summary: "Unable to generate summary.", keyIssues: [], nextSteps: [] };
  } catch {
    return { summary: "Unable to generate summary.", keyIssues: [], nextSteps: [] };
  }
}

export async function suggestTasksFromActivity(params: {
  matterName: string;
  practiceArea?: string;
  recentActivities: string[];
  existingTasks: string[];
  model?: string;
}): Promise<{
  tasks: Array<{
    title: string;
    description: string;
    priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
    suggestedDueInDays: number;
  }>;
}> {
  const result = await callClaude({
    system: `You are a legal assistant that suggests follow-up tasks based on matter activity. Suggest only actionable, specific tasks. Return ONLY valid JSON.`,
    userMessage: `Suggest follow-up tasks for this matter:
- Matter: ${params.matterName}
- Practice Area: ${params.practiceArea || "General"}
- Recent Activities: ${params.recentActivities.join("; ")}
- Existing Tasks: ${params.existingTasks.length > 0 ? params.existingTasks.join("; ") : "None"}

Do not duplicate existing tasks. Return JSON:
{"tasks": [{"title": "string", "description": "string", "priority": "LOW|MEDIUM|HIGH|URGENT", "suggestedDueInDays": number}]}`,
    model: params.model,
  });

  try {
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { tasks: [] };
  } catch {
    return { tasks: [] };
  }
}
