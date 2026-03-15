// AI-powered intake screening and follow-up generation

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const API_URL = "https://api.anthropic.com/v1/messages";

async function callAI(systemPrompt: string, userMessage: string, maxTokens = 2000): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`AI API error: ${body}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text || "";
}

function parseJson(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in AI response");
  return JSON.parse(match[0]);
}

export async function screenLead(
  leadData: { name: string; email?: string | null; phone?: string | null; source: string; practiceArea?: string | null; description?: string | null },
  firmCriteria?: { preferredAreas?: string[]; geoRestrictions?: string[]; conflictKeywords?: string[] }
): Promise<{
  score: number;
  grade: string;
  analysis: string;
  urgency: string;
  estimatedValue?: number;
  redFlags: string[];
  strengths: string[];
  recommendedAction: string;
  practiceAreaMatch: boolean;
}> {
  const systemPrompt = `You are an expert legal intake specialist screening potential clients for a law firm. Evaluate this lead and provide:
1) A qualification score 0-100 (80+ is A grade, 60-79 B, 40-59 C, 20-39 D, below 20 F)
2) Detailed analysis of why this lead is or isn't a good fit (HTML format)
3) Urgency level (CRITICAL if time-sensitive legal matter like arrest/restraining order/imminent deadline, HIGH if active legal situation, MEDIUM if planning stage, LOW if just exploring)
4) Estimated case value if determinable
5) Red flags (array of concerns)
6) Strengths (array of positive indicators)
7) Recommended next action
8) Whether the practice area matches the firm's areas

Consider: clarity of legal issue, ability to pay (inferred), time sensitivity, practice area fit, geographic relevance.

Return JSON with: score (number), grade (A/B/C/D/F), analysis (HTML string), urgency (CRITICAL/HIGH/MEDIUM/LOW), estimatedValue (number or null), redFlags (string array), strengths (string array), recommendedAction (string), practiceAreaMatch (boolean).`;

  let userMsg = `Lead Information:
- Name: ${leadData.name}
- Email: ${leadData.email || "Not provided"}
- Phone: ${leadData.phone || "Not provided"}
- Source: ${leadData.source}
- Practice Area: ${leadData.practiceArea || "Not specified"}
- Description: ${leadData.description || "No description provided"}`;

  if (firmCriteria) {
    userMsg += `\n\nFirm Criteria:`;
    if (firmCriteria.preferredAreas?.length) userMsg += `\n- Preferred Practice Areas: ${firmCriteria.preferredAreas.join(", ")}`;
    if (firmCriteria.geoRestrictions?.length) userMsg += `\n- Geographic Restrictions: ${firmCriteria.geoRestrictions.join(", ")}`;
    if (firmCriteria.conflictKeywords?.length) userMsg += `\n- Conflict Keywords: ${firmCriteria.conflictKeywords.join(", ")}`;
  }

  const result = parseJson(await callAI(systemPrompt, userMsg));
  return {
    score: Math.min(100, Math.max(0, result.score || 50)),
    grade: ["A", "B", "C", "D", "F"].includes(result.grade) ? result.grade : "C",
    analysis: result.analysis || "<p>Analysis unavailable</p>",
    urgency: ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(result.urgency) ? result.urgency : "MEDIUM",
    estimatedValue: result.estimatedValue || undefined,
    redFlags: Array.isArray(result.redFlags) ? result.redFlags : [],
    strengths: Array.isArray(result.strengths) ? result.strengths : [],
    recommendedAction: result.recommendedAction || "Review manually",
    practiceAreaMatch: result.practiceAreaMatch ?? false,
  };
}

export async function screenIntakeSubmission(
  submissionData: Record<string, any>,
  templateName: string,
  firmCriteria?: any
): Promise<{
  score: number;
  grade: string;
  analysis: string;
  urgency: string;
  estimatedValue?: number;
  redFlags: string[];
  strengths: string[];
  recommendedAction: string;
  practiceAreaMatch: boolean;
}> {
  const systemPrompt = `You are an expert legal intake specialist screening an intake form submission for a law firm. The form is "${templateName}". Evaluate this submission and provide:
1) A qualification score 0-100 (80+ is A grade, 60-79 B, 40-59 C, 20-39 D, below 20 F)
2) Detailed analysis (HTML format)
3) Urgency level (CRITICAL/HIGH/MEDIUM/LOW)
4) Estimated case value if determinable
5) Red flags and strengths
6) Recommended next action
7) Practice area match

Return JSON with: score, grade, analysis (HTML), urgency, estimatedValue (number or null), redFlags (string array), strengths (string array), recommendedAction (string), practiceAreaMatch (boolean).`;

  let userMsg = `Intake Form: ${templateName}\nSubmission Data:\n${JSON.stringify(submissionData, null, 2)}`;
  if (firmCriteria) userMsg += `\n\nFirm Criteria: ${JSON.stringify(firmCriteria)}`;

  const result = parseJson(await callAI(systemPrompt, userMsg));
  return {
    score: Math.min(100, Math.max(0, result.score || 50)),
    grade: ["A", "B", "C", "D", "F"].includes(result.grade) ? result.grade : "C",
    analysis: result.analysis || "<p>Analysis unavailable</p>",
    urgency: ["CRITICAL", "HIGH", "MEDIUM", "LOW"].includes(result.urgency) ? result.urgency : "MEDIUM",
    estimatedValue: result.estimatedValue || undefined,
    redFlags: Array.isArray(result.redFlags) ? result.redFlags : [],
    strengths: Array.isArray(result.strengths) ? result.strengths : [],
    recommendedAction: result.recommendedAction || "Review manually",
    practiceAreaMatch: result.practiceAreaMatch ?? false,
  };
}

export async function generateFollowUpEmail(context: {
  leadName: string;
  leadEmail: string;
  practiceArea?: string;
  firmName: string;
  stepPurpose: string;
  previousInteractions?: string[];
}): Promise<{ subject: string; body: string }> {
  const systemPrompt = `You are drafting a follow-up email for a law firm's intake process. The email should be warm, professional, and appropriate for the follow-up stage. Do NOT provide legal advice. Keep it concise. Return JSON with 'subject' and 'body' (HTML).`;

  const userMsg = `Lead: ${context.leadName} (${context.leadEmail})
Practice Area: ${context.practiceArea || "General"}
Firm: ${context.firmName}
Purpose of this follow-up: ${context.stepPurpose}
${context.previousInteractions?.length ? `Previous interactions: ${context.previousInteractions.join("; ")}` : ""}`;

  const result = parseJson(await callAI(systemPrompt, userMsg, 1000));
  return {
    subject: result.subject || `Follow-up from ${context.firmName}`,
    body: result.body || `<p>Dear ${context.leadName},</p><p>Thank you for your interest. We would love to discuss your legal needs further.</p><p>Best regards,<br/>${context.firmName}</p>`,
  };
}

export async function analyzeNoResponse(
  leadData: { name: string; practiceArea?: string | null; description?: string | null },
  daysSinceLastContact: number
): Promise<{ recommendation: string; suggestedMessage: string }> {
  const systemPrompt = `A potential client has not responded in ${daysSinceLastContact} days. Based on their initial inquiry, suggest: 1) Whether to continue follow-up or close the lead, 2) A suggested re-engagement message. Return JSON with 'recommendation' and 'suggestedMessage'.`;

  const userMsg = `Lead: ${leadData.name}
Practice Area: ${leadData.practiceArea || "Unknown"}
Original Inquiry: ${leadData.description || "No description"}
Days since last contact: ${daysSinceLastContact}`;

  const result = parseJson(await callAI(systemPrompt, userMsg, 800));
  return {
    recommendation: result.recommendation || "Continue follow-up",
    suggestedMessage: result.suggestedMessage || `Hi ${leadData.name}, I wanted to follow up on your inquiry. Are you still looking for legal assistance?`,
  };
}
