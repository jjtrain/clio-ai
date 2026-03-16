const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

async function callClaude(params: { system: string; userMessage: string; maxTokens?: number }): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: params.maxTokens || 4000,
      system: params.system,
      messages: [{ role: "user", content: params.userMessage }],
    }),
  });

  if (!response.ok) {
    console.error("[AI Reconciliation] API error:", response.status);
    throw new Error(`Anthropic API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || "";
}

function parseJsonArray<T>(raw: string, fallback: T[]): T[] {
  try {
    const match = raw.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : fallback;
  } catch { return fallback; }
}

function parseJson<T>(raw: string, fallback: T): T {
  try {
    const match = raw.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : fallback;
  } catch { return fallback; }
}

export async function autoMatchTransactions(
  bankTransactions: Array<{ id: string; date: string; amount: number; description: string; payee?: string }>,
  firmRecords: {
    invoices: Array<{ id: string; number: string; total: number; date: string; clientName?: string }>;
    payments: Array<{ id: string; amount: number; date: string; method?: string; reference?: string }>;
    expenses: Array<{ id: string; amount: number; date: string; vendorName: string; description?: string }>;
    trustTransactions: Array<{ id: string; amount: number; date: string; description?: string }>;
  }
): Promise<Array<{ bankTransactionId: string; matchedType: string | null; matchedId: string | null; confidence: number; reasoning: string }>> {
  const result = await callClaude({
    system: "You are a bank reconciliation specialist for a law firm. Match each bank transaction to the most likely firm record (invoice payment, recorded expense, trust transaction, or payment record). Consider: date proximity (within 3 days), amount match (exact or close), description keywords matching client names or vendor names, reference numbers. For each match, provide confidence 0-100. Return JSON array of {bankTransactionId, matchedType ('INVOICE'|'PAYMENT'|'EXPENSE'|'TRUST_TRANSACTION'|null), matchedId (id or null), confidence (0-100), reasoning (brief explanation)}. If no good match, set matchedType to null.",
    userMessage: `Bank Transactions:\n${JSON.stringify(bankTransactions.slice(0, 30), null, 2)}\n\nFirm Records:\n${JSON.stringify(firmRecords, null, 2)}`,
    maxTokens: 4000,
  });

  return parseJsonArray(result, bankTransactions.map((t) => ({ bankTransactionId: t.id, matchedType: null, matchedId: null, confidence: 0, reasoning: "No match found" })));
}

export async function categorizeTransaction(
  description: string, amount: number, existingCategories: string[]
): Promise<{ category: string; accountNumber: string; confidence: number }> {
  const result = await callClaude({
    system: "Based on this bank transaction description and amount, categorize it for a law firm's books. Suggest the most appropriate expense category and chart of accounts number. Return JSON: {category, accountNumber, confidence}.",
    userMessage: `Description: ${description}\nAmount: $${amount}\nExisting categories: ${existingCategories.join(", ")}`,
    maxTokens: 500,
  });

  return parseJson(result, { category: "OTHER", accountNumber: "6900", confidence: 50 });
}

export async function detectAnomalies(
  transactions: Array<{ date: string; amount: number; description: string }>,
  historicalPatterns: { avgMonthlySpend: number; commonVendors: string[]; typicalAmounts: { min: number; max: number; avg: number } }
): Promise<Array<{ transactionIndex: number; anomalyType: string; description: string; severity: string }>> {
  const result = await callClaude({
    system: "Analyze these bank transactions for anomalies. Flag: unusually large amounts, duplicate transactions, unknown vendors, transactions outside normal patterns. Return JSON array of {transactionIndex, anomalyType ('LARGE_AMOUNT'|'DUPLICATE'|'UNKNOWN_VENDOR'|'UNUSUAL_PATTERN'), description, severity ('LOW'|'MEDIUM'|'HIGH')}.",
    userMessage: `Transactions:\n${JSON.stringify(transactions.slice(0, 50), null, 2)}\n\nHistorical Patterns:\n${JSON.stringify(historicalPatterns, null, 2)}`,
    maxTokens: 2000,
  });

  return parseJsonArray(result, []);
}
