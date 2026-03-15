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
      max_tokens: params.maxTokens || 2000,
      system: params.system,
      messages: [{ role: "user", content: params.userMessage }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error("[AI Forecasting] API error:", response.status, text);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

function parseJSON(text: string): any {
  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }
  try { return JSON.parse(text); } catch {}
  return null;
}

export async function estimateMatterValue(
  matterData: {
    name: string;
    practiceArea?: string;
    description?: string;
    feeType: string;
    hourlyRate?: number;
    estimatedHours?: number;
    retainerAmount?: number;
    contingencyPercentage?: number;
  },
  historicalData: {
    avgHours: number;
    avgFees: number;
    avgDuration: number;
    similarMatters: Array<{ name: string; totalBilled: number; hours: number; duration: number }>;
  }
): Promise<{
  estimatedValue: number;
  estimatedHours: number;
  estimatedFees: number;
  estimatedCosts: number;
  estimatedDurationMonths: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  reasoning: string;
}> {
  const system = `You are a legal financial analyst estimating the value of a legal matter. Based on the matter details and historical data from similar matters at this firm, estimate: total expected value, billable hours, fees, costs, and duration. Consider the fee type and rate structure. Provide a confidence level (HIGH if good historical data, MEDIUM if some data, LOW if minimal). Explain your reasoning. Return ONLY valid JSON: {"estimatedValue": number, "estimatedHours": number, "estimatedFees": number, "estimatedCosts": number, "estimatedDurationMonths": number, "confidence": "HIGH"|"MEDIUM"|"LOW", "reasoning": "string"}.`;

  const userMessage = `Matter: ${matterData.name}
Practice Area: ${matterData.practiceArea || "Unknown"}
Description: ${matterData.description || "None"}
Fee Type: ${matterData.feeType}
Hourly Rate: ${matterData.hourlyRate ? `$${matterData.hourlyRate}/hr` : "Not set"}
Estimated Hours: ${matterData.estimatedHours || "Unknown"}
Retainer: ${matterData.retainerAmount ? `$${matterData.retainerAmount}` : "N/A"}
Contingency: ${matterData.contingencyPercentage ? `${matterData.contingencyPercentage}%` : "N/A"}

Historical Data for ${matterData.practiceArea || "this practice area"}:
- Average Hours: ${historicalData.avgHours}
- Average Fees: $${historicalData.avgFees}
- Average Duration: ${historicalData.avgDuration} months
- Similar Matters (${historicalData.similarMatters.length}):
${historicalData.similarMatters.slice(0, 5).map((m) => `  - ${m.name}: $${m.totalBilled} billed, ${m.hours}h, ${m.duration} months`).join("\n")}`;

  try {
    const response = await callClaude({ system, userMessage });
    const parsed = parseJSON(response);
    if (parsed) return parsed;
  } catch (err) {
    console.error("[AI Forecasting] estimateMatterValue error:", err);
  }

  // Fallback: rule-based estimate
  const hours = matterData.estimatedHours || historicalData.avgHours || 40;
  const rate = matterData.hourlyRate || 250;
  const fees = matterData.feeType === "CONTINGENCY"
    ? (matterData.contingencyPercentage || 33) * 100
    : hours * rate;
  return {
    estimatedValue: Math.round(fees * 1.1),
    estimatedHours: Math.round(hours),
    estimatedFees: Math.round(fees),
    estimatedCosts: Math.round(fees * 0.1),
    estimatedDurationMonths: Math.round(historicalData.avgDuration || 6),
    confidence: historicalData.similarMatters.length > 3 ? "MEDIUM" : "LOW",
    reasoning: "Estimated based on historical averages (AI unavailable).",
  };
}

export async function generateBillingForecast(firmData: {
  monthlyRevenue: Array<{ month: string; revenue: number }>;
  activeMatters: Array<{ practiceArea: string; feeType: string; estimatedValue: number; remainingValue: number; avgMonthlyBilling: number }>;
  pendingLeads: number;
  avgConversionRate: number;
  avgNewMatterValue: number;
}): Promise<Array<{ period: string; projectedRevenue: number; projectedHours: number; projectedExpenses: number; methodology: string }>> {
  const system = `You are a legal financial forecasting assistant. Based on the firm's historical revenue data, active matter pipeline, and lead conversion metrics, project revenue for the next 6 months. Use trend analysis, seasonal patterns if visible, and the active matter pipeline to create realistic projections. Return ONLY a valid JSON array: [{"period": "YYYY-MM", "projectedRevenue": number, "projectedHours": number, "projectedExpenses": number, "methodology": "brief explanation"}].`;

  const userMessage = `Historical Monthly Revenue (last 12 months):
${firmData.monthlyRevenue.map((m) => `${m.month}: $${m.revenue}`).join("\n")}

Active Matter Pipeline:
- ${firmData.activeMatters.length} active matters
- Total remaining value: $${firmData.activeMatters.reduce((s, m) => s + m.remainingValue, 0)}
- Avg monthly billing across matters: $${firmData.activeMatters.reduce((s, m) => s + m.avgMonthlyBilling, 0)}

Lead Pipeline:
- ${firmData.pendingLeads} pending leads
- Average conversion rate: ${firmData.avgConversionRate}%
- Average new matter value: $${firmData.avgNewMatterValue}

Project revenue for the next 6 months starting from ${new Date().getFullYear()}-${String(new Date().getMonth() + 2).padStart(2, "0")}.`;

  try {
    const response = await callClaude({ system, userMessage, maxTokens: 3000 });
    const parsed = parseJSON(response);
    if (Array.isArray(parsed)) return parsed;
  } catch (err) {
    console.error("[AI Forecasting] generateBillingForecast error:", err);
  }

  // Fallback: trend-based projection
  const recent = firmData.monthlyRevenue.slice(-3);
  const avg = recent.length > 0 ? recent.reduce((s, m) => s + m.revenue, 0) / recent.length : 10000;
  const now = new Date();
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
    return {
      period: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      projectedRevenue: Math.round(avg * (1 + i * 0.02) * 100) / 100,
      projectedHours: Math.round(avg / 250),
      projectedExpenses: Math.round(avg * 0.1),
      methodology: "Based on 3-month moving average with growth trend (AI unavailable).",
    };
  });
}

export async function analyzeMatterProfitability(matterData: {
  name: string;
  feeType: string;
  estimatedValue: number;
  actualBilled: number;
  hoursLogged: number;
  rate: number;
  expenses: number;
  durationMonths: number;
}): Promise<{
  profitMargin: number;
  effectiveRate: number;
  isOnTrack: boolean;
  recommendations: string[];
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
}> {
  const system = `Analyze this legal matter's financial performance. Compare estimated vs actual. Calculate profit margin, effective hourly rate, and whether the matter is on track financially. Provide recommendations if off track. Return ONLY valid JSON: {"profitMargin": number, "effectiveRate": number, "isOnTrack": boolean, "recommendations": ["string"], "riskLevel": "LOW"|"MEDIUM"|"HIGH"}.`;

  const userMessage = `Matter: ${matterData.name}
Fee Type: ${matterData.feeType}
Estimated Value: $${matterData.estimatedValue}
Actual Billed: $${matterData.actualBilled}
Hours Logged: ${matterData.hoursLogged}
Hourly Rate: $${matterData.rate}
Expenses: $${matterData.expenses}
Duration: ${matterData.durationMonths} months
Budget Consumed: ${matterData.estimatedValue > 0 ? Math.round((matterData.actualBilled / matterData.estimatedValue) * 100) : 0}%`;

  try {
    const response = await callClaude({ system, userMessage });
    const parsed = parseJSON(response);
    if (parsed) return parsed;
  } catch (err) {
    console.error("[AI Forecasting] analyzeMatterProfitability error:", err);
  }

  const effectiveRate = matterData.hoursLogged > 0 ? matterData.actualBilled / matterData.hoursLogged : 0;
  const profitMargin = matterData.actualBilled > 0 ? ((matterData.actualBilled - matterData.expenses) / matterData.actualBilled) * 100 : 0;
  const isOver = matterData.actualBilled > matterData.estimatedValue;
  return {
    profitMargin: Math.round(profitMargin),
    effectiveRate: Math.round(effectiveRate * 100) / 100,
    isOnTrack: !isOver,
    recommendations: isOver ? ["Matter is over budget. Review scope and billing."] : ["Matter is within budget."],
    riskLevel: isOver ? "HIGH" : matterData.actualBilled > matterData.estimatedValue * 0.8 ? "MEDIUM" : "LOW",
  };
}
