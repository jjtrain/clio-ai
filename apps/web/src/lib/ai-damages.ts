const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

async function callClaude(params: {
  system: string;
  userMessage: string;
  model?: string;
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
      model: params.model || "claude-sonnet-4-20250514",
      max_tokens: params.maxTokens || 4000,
      system: params.system,
      messages: [{ role: "user", content: params.userMessage }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[AI Damages] API error:", response.status, text);
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

export async function assessDamages(caseData: {
  incidentType?: string;
  injuryDescription?: string;
  medicalRecords: Array<{ type: string; charges: number; description?: string }>;
  lostWagesData?: { priorSalary: number; missedDays: number };
  otherLosses?: string;
}): Promise<{
  economicDamages: Array<{ type: string; description: string; amount: number; reasoning: string }>;
  nonEconomicDamages: Array<{ type: string; description: string; estimatedRange: { low: number; mid: number; high: number }; reasoning: string }>;
  suggestedMultiplier: number;
  perDiemSuggestion: { dailyRate: number; days: number; total: number };
  totalEstimate: { low: number; mid: number; high: number };
  analysis: string;
}> {
  const result = await callClaude({
    system:
      "You are a personal injury damages expert. Based on the case data, medical records, and losses, assess the full spectrum of damages. For economic damages, calculate documented amounts. For non-economic damages, provide a range (low/mid/high) based on the severity of injuries, jurisdiction norms, and comparable cases. Suggest a pain & suffering multiplier (typically 1.5x-5x specials depending on severity) and a per diem rate. Provide detailed reasoning for each damage category. Return JSON with keys: economicDamages (array of {type, description, amount, reasoning}), nonEconomicDamages (array of {type, description, estimatedRange: {low, mid, high}, reasoning}), suggestedMultiplier (number), perDiemSuggestion ({dailyRate, days, total}), totalEstimate ({low, mid, high}), analysis (string).",
    userMessage: `Case Data:\n${JSON.stringify(caseData, null, 2)}`,
    maxTokens: 4000,
  });

  return parseJson(result, {
    economicDamages: [],
    nonEconomicDamages: [],
    suggestedMultiplier: 3,
    perDiemSuggestion: { dailyRate: 0, days: 0, total: 0 },
    totalEstimate: { low: 0, mid: 0, high: 0 },
    analysis: "Unable to assess damages.",
  });
}

export async function projectFutureDamages(
  currentDamages: any[],
  injuryDetails: string,
  medicalPrognosis?: string
): Promise<Array<{ type: string; description: string; projectedAmount: number; duration: string; methodology: string }>> {
  const result = await callClaude({
    system:
      "Based on the current damages and injury details, project future damages including: future medical expenses, future lost earnings capacity, ongoing pain and suffering, future care needs. For each, explain the methodology (life expectancy tables, medical cost inflation, vocational analysis concepts). Return JSON array of {type, description, projectedAmount, duration, methodology}.",
    userMessage: `Current Damages:\n${JSON.stringify(currentDamages, null, 2)}\n\nInjury Details: ${injuryDetails}\n\nMedical Prognosis: ${medicalPrognosis || "Not provided"}`,
    maxTokens: 4000,
  });

  return parseJsonArray(result, []);
}

export async function generateDamagesSummaryReport(
  allDamages: any[],
  caseDetails: any
): Promise<{ report: string; demandMultiplier: number }> {
  const result = await callClaude({
    system:
      "Generate a comprehensive damages summary report suitable for inclusion in a demand letter or trial brief. Organize by category, cite supporting evidence, and build a compelling narrative of the client's damages. Include specific dollar amounts and totals. Format as professional HTML. Also suggest an appropriate demand multiplier for the general damages. Return JSON with 'report' (HTML) and 'demandMultiplier' (number).",
    userMessage: `Damages:\n${JSON.stringify(allDamages, null, 2)}\n\nCase Details:\n${JSON.stringify(caseDetails, null, 2)}`,
    maxTokens: 6000,
  });

  return parseJson(result, { report: "<p>Unable to generate report.</p>", demandMultiplier: 3 });
}

export async function comparableVerdicts(
  injuryType: string,
  jurisdiction: string,
  severity: string
): Promise<Array<{ caseName: string; verdict: string; injuries: string; year: string; relevance: string }>> {
  const result = await callClaude({
    system:
      `Based on your knowledge, provide comparable verdicts and settlements for cases involving ${injuryType} injuries of ${severity} severity in ${jurisdiction}. Note these are for reference only and must be independently verified. Return JSON array of {caseName, verdict (dollar string), injuries (brief description), year, relevance (why it's comparable)}. Include a disclaimer.`,
    userMessage: `Find comparable verdicts for: ${injuryType} injuries, ${severity} severity, in ${jurisdiction}.`,
    maxTokens: 3000,
  });

  return parseJsonArray(result, []);
}
