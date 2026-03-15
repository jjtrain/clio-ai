const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

async function callClaude(params: {
  system: string;
  userMessage: string;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: params.maxTokens || 4000,
      system: params.system,
      messages: [{ role: "user", content: params.userMessage }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[AI E-Filing] API error:", response.status, text);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

function parseJSON(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (!arrMatch) throw new Error("No JSON found in response");
    return JSON.parse(arrMatch[0]);
  }
  return JSON.parse(match[0]);
}

export async function validateFiling(
  documents: Array<{ filename: string; type: string; size?: number }>,
  courtRules: any,
  filingType: string
): Promise<{ isValid: boolean; errors: string[]; warnings: string[]; suggestions: string[] }> {
  const text = await callClaude({
    system: "You are a court e-filing compliance specialist. Validate the following documents against the court's filing rules. Check: file format compliance (PDF required for most courts), file naming conventions, file size limits, required document types for this filing type, proper ordering. Return JSON with: isValid (boolean), errors (array of blocking issues), warnings (array of non-blocking concerns), suggestions (array of improvement recommendations).",
    userMessage: JSON.stringify({ documents, courtRules, filingType }),
  });
  try {
    return parseJSON(text);
  } catch {
    return { isValid: true, errors: [], warnings: ["Could not parse AI validation response"], suggestions: [] };
  }
}

export async function suggestServiceList(
  matterContext: { parties: any[]; opposingCounsel?: any }
): Promise<Array<{ name: string; email?: string; address?: string; type: "email" | "mail" }>> {
  const text = await callClaude({
    system: "Based on the matter parties and opposing counsel, suggest the service list for this filing. Return a JSON array of {name, email (if available), address (if mail service needed), type ('email' or 'mail')}.",
    userMessage: JSON.stringify(matterContext),
  });
  try {
    const result = parseJSON(text);
    return Array.isArray(result) ? result : [];
  } catch {
    return [];
  }
}

export async function generateCoverSheet(
  filingData: { court: string; caseNumber?: string; title: string; filingType: string; filerName: string; documents: any[] }
): Promise<{ html: string }> {
  const text = await callClaude({
    system: "Generate a professional court filing cover sheet / transmittal letter with the filing details. Include: court name, case number/caption, filing description, list of documents being filed, filer information. Format as clean HTML suitable for PDF conversion. Return JSON with: html (string).",
    userMessage: JSON.stringify(filingData),
    maxTokens: 6000,
  });
  try {
    return parseJSON(text);
  } catch {
    return { html: `<h1>Filing Cover Sheet</h1><p>Court: ${filingData.court}</p><p>Filing: ${filingData.title}</p>` };
  }
}

export async function checkFilingRequirements(
  courtName: string,
  filingType: string
): Promise<{ requirements: string[]; commonErrors: string[]; estimatedFee?: string }> {
  const text = await callClaude({
    system: `You are an expert on court e-filing procedures. For the given court, list: 1) Requirements for the specified filing type (document formats, naming, required attachments), 2) Common rejection reasons to avoid, 3) Estimated filing fee if known. Return JSON with: requirements (string array), commonErrors (string array), estimatedFee (string or null).`,
    userMessage: `Court: ${courtName}\nFiling Type: ${filingType}`,
  });
  try {
    return parseJSON(text);
  } catch {
    return { requirements: ["PDF format required", "Documents must be text-searchable"], commonErrors: ["Incorrect document format"], estimatedFee: undefined };
  }
}
