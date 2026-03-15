const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

async function callClaude(system: string, userMessage: string, maxTokens = 3000): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system, messages: [{ role: "user", content: userMessage }] }),
  });
  if (!res.ok) { console.error("[AI Risk]", res.status, await res.text()); throw new Error(`API error: ${res.status}`); }
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

function parseJSON(text: string): any {
  const m = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (m) try { return JSON.parse(m[0]); } catch {}
  try { return JSON.parse(text); } catch {}
  return null;
}

export async function analyzeAnomalies(data: {
  timeEntries: any[]; invoices: any[]; trustTransactions: any[]; matterActivity: any[];
}): Promise<Array<{ category: string; severity: string; title: string; description: string; entityType?: string; entityId?: string; recommendation: string }>> {
  const system = `You are a legal practice risk analyst. Analyze the provided firm data for anomalies, risks, and compliance concerns. Look for: 1) Billing anomalies: unusually large/small time entries, duplicate entries, billing spikes. 2) Trust account issues: negative balances, unusual transactions. 3) Productivity concerns: matters with no activity, declining trends. 4) Compliance risks: missed deadlines, incomplete checks. Return ONLY a valid JSON array of risk alerts: [{category: "BILLING"|"TRUST"|"PRODUCTIVITY"|"COMPLIANCE"|"FINANCIAL", severity: "CRITICAL"|"HIGH"|"MEDIUM"|"LOW"|"INFO", title: "concise title", description: "detailed description", entityType: "optional", entityId: "optional", recommendation: "actionable advice"}].`;
  const msg = `Time Entries (last 30 days, ${data.timeEntries.length} total):\n${JSON.stringify(data.timeEntries.slice(0, 50))}\n\nInvoices (recent):\n${JSON.stringify(data.invoices.slice(0, 30))}\n\nTrust Transactions (recent):\n${JSON.stringify(data.trustTransactions.slice(0, 20))}\n\nMatter Activity Summary:\n${JSON.stringify(data.matterActivity.slice(0, 30))}`;
  try {
    const res = await callClaude(system, msg);
    const parsed = parseJSON(res);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) { console.error("[AI Risk] analyzeAnomalies:", e); }
  return [];
}

export async function assessMatterRisk(matterData: {
  name: string; practiceArea?: string; daysOpen: number; lastActivity: string; billing: number; valuation: number; deadlines: number; parties: number;
}): Promise<{ riskLevel: string; factors: string[]; recommendations: string[] }> {
  const system = `Assess the risk profile of this legal matter. Consider: financial risk (over/under budget), timeline risk (approaching deadlines, inactivity), client risk. Return ONLY valid JSON: {riskLevel: "LOW"|"MEDIUM"|"HIGH"|"CRITICAL", factors: ["string"], recommendations: ["string"]}.`;
  const msg = JSON.stringify(matterData);
  try {
    const res = await callClaude(system, msg, 1500);
    const parsed = parseJSON(res);
    if (parsed) return parsed;
  } catch (e) { console.error("[AI Risk] assessMatterRisk:", e); }
  const isRisky = matterData.billing > matterData.valuation * 1.1 || matterData.daysOpen > 365;
  return { riskLevel: isRisky ? "HIGH" : "LOW", factors: isRisky ? ["Financial or timeline concerns"] : ["No major risks identified"], recommendations: ["Continue monitoring"] };
}

export async function detectBillingAnomalies(timeEntries: Array<{ id?: string; description: string; duration: number; date: string; rate: number; userId: string; matterId: string }>): Promise<Array<{ entryId?: string; type: string; description: string; severity: string }>> {
  const system = `Analyze these time entries for billing anomalies. Detect: duplicate entries (same description+date+duration), unusually long entries (>8 hours), billing spikes, vague descriptions. Return ONLY a valid JSON array: [{entryId: "optional", type: "DUPLICATE"|"EXCESSIVE_HOURS"|"UNUSUAL_PATTERN"|"VAGUE_DESCRIPTION"|"SPIKE", description: "string", severity: "HIGH"|"MEDIUM"|"LOW"}].`;
  try {
    const res = await callClaude(system, JSON.stringify(timeEntries.slice(0, 100)), 2000);
    const parsed = parseJSON(res);
    if (Array.isArray(parsed)) return parsed;
  } catch (e) { console.error("[AI Risk] detectBillingAnomalies:", e); }
  return [];
}
