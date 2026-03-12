const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

export async function generateAiChatResponse(params: {
  messages: { role: string; content: string }[];
  systemPrompt: string;
  model?: string;
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return "I'm sorry, the AI assistant is not configured at the moment. Please leave your contact information and an attorney will reach out to you.";
  }

  // Convert messages to Anthropic format
  const anthropicMessages = params.messages.map((m) => ({
    role: m.role === "VISITOR" ? "user" as const : "assistant" as const,
    content: m.content,
  }));

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: params.model || "claude-sonnet-4-20250514",
        max_tokens: 300,
        system: params.systemPrompt,
        messages: anthropicMessages,
      }),
    });

    if (!response.ok) {
      console.error("[AI Chat] API error:", response.status, await response.text());
      return "I'm having trouble connecting right now. Please leave your name and contact information, and an attorney will follow up with you.";
    }

    const data = await response.json();
    return data.content?.[0]?.text || "I'm here to help. Could you tell me more about your legal matter?";
  } catch (error) {
    console.error("[AI Chat] Error:", error);
    return "I'm having trouble connecting right now. Please leave your name and contact information, and an attorney will follow up with you.";
  }
}
