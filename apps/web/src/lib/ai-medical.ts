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
    console.error("[AI Medical] API error:", response.status, text);
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

export async function summarizeMedicalRecords(
  records: Array<{
    provider: string;
    type: string;
    date: string;
    description?: string;
    diagnosis?: string;
    charges?: number;
  }>
): Promise<{
  chronology: string;
  totalCharges: number;
  keyInjuries: string[];
  treatmentSummary: string;
  gaps: string[];
}> {
  const result = await callClaude({
    system:
      "You are a legal nurse consultant summarizing medical records for a personal injury case. Create: 1) A chronological narrative of treatment (HTML), 2) Total medical specials, 3) Key injuries/diagnoses list, 4) Treatment summary paragraph, 5) Gaps in treatment that opposing counsel might exploit. Return JSON with keys: chronology (HTML string), totalCharges (number), keyInjuries (string array), treatmentSummary (string), gaps (string array).",
    userMessage: `Summarize these medical records:\n${JSON.stringify(records, null, 2)}`,
    maxTokens: 4000,
  });

  return parseJson(result, {
    chronology: "<p>Unable to generate summary.</p>",
    totalCharges: 0,
    keyInjuries: [],
    treatmentSummary: "",
    gaps: [],
  });
}

export async function analyzeLienPositions(
  liens: Array<{ type: string; holder: string; amount: number; priority: number }>,
  settlementAmount: number,
  attorneyFee: number,
  costs: number
): Promise<{
  analysis: string;
  negotiationStrategy: string[];
  projectedReductions: Array<{
    holder: string;
    originalAmount: number;
    suggestedReduction: number;
    reasoning: string;
  }>;
  estimatedNetToClient: number;
}> {
  const result = await callClaude({
    system:
      "You are a personal injury lien negotiation specialist. Analyze the liens against the settlement amount. For each lien, suggest a reduction strategy based on lien type (Medicare/Medicaid have specific rules, hospital liens are often negotiable, ERISA plans require specific analysis). Calculate projected net to client. Return JSON with keys: analysis (string), negotiationStrategy (string array), projectedReductions (array of {holder, originalAmount, suggestedReduction, reasoning}), estimatedNetToClient (number).",
    userMessage: `Settlement: $${settlementAmount}\nAttorney Fee: $${attorneyFee}\nCosts: $${costs}\n\nLiens:\n${JSON.stringify(liens, null, 2)}`,
    maxTokens: 4000,
  });

  return parseJson(result, {
    analysis: "Unable to analyze liens.",
    negotiationStrategy: [],
    projectedReductions: [],
    estimatedNetToClient: 0,
  });
}

export async function generateDemandLetter(
  caseDetails: {
    incidentType?: string;
    dateOfIncident?: string;
    incidentDescription?: string;
    injuryDescription?: string;
    liabilityAssessment?: string;
    insuranceCompany?: string;
    claimNumber?: string;
    policyLimits?: number;
    clientName?: string;
    matterName?: string;
  },
  medicalRecords: Array<{
    provider: string;
    type: string;
    date: string;
    description?: string;
    diagnosis?: string;
    charges?: number;
  }>,
  totalSpecials: number
): Promise<{ letter: string }> {
  const result = await callClaude({
    system:
      "You are a personal injury attorney drafting a demand letter. Based on the case details and medical records, draft a professional demand letter. Include: incident description, liability analysis, medical treatment chronology, pain and suffering description, special damages itemization, general damages argument, demand amount with justification. Format as professional HTML letter.",
    userMessage: `Case Details:\n${JSON.stringify(caseDetails, null, 2)}\n\nMedical Records:\n${JSON.stringify(medicalRecords, null, 2)}\n\nTotal Medical Specials: $${totalSpecials}`,
    maxTokens: 6000,
  });

  return parseJson(result, { letter: "<p>Unable to generate demand letter.</p>" });
}

export async function calculateSettlementDistribution(
  settlementAmount: number,
  attorneyFeePercentage: number,
  costs: number,
  liens: Array<{ holder: string; amount: number; negotiatedAmount?: number }>
): Promise<{
  distribution: Array<{ description: string; type: string; amount: number; payee?: string }>;
  netToClient: number;
}> {
  const result = await callClaude({
    system:
      "Calculate the settlement distribution. Order: 1) Attorney fees (percentage of gross), 2) Case costs/expenses, 3) Liens (in priority order, using negotiated amounts where available), 4) Remaining to client. Return JSON with keys: distribution (array of {description, type: 'attorney_fee'|'cost'|'lien'|'medical'|'client_distribution', amount (number), payee (string)}), netToClient (number).",
    userMessage: `Settlement Amount: $${settlementAmount}\nAttorney Fee: ${attorneyFeePercentage}%\nCase Costs: $${costs}\n\nLiens:\n${JSON.stringify(liens, null, 2)}`,
    maxTokens: 2000,
  });

  return parseJson(result, { distribution: [], netToClient: 0 });
}
