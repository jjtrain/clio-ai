import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * POST /api/ai/command — SSE stream for AI command processing.
 * Receives a natural language command, streams back structured responses.
 */
export async function POST(req: NextRequest) {
  const { input, intent } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: any) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        send({ type: "thinking", message: "Processing your request..." });

        // Route by intent
        if (intent === "log_time") {
          send({ type: "action", action: "navigate", href: "/time", message: "Opening time tracking..." });
        } else if (intent === "open_matter") {
          send({ type: "action", action: "navigate", href: "/matters", message: `Searching for matter: "${input}"` });
        } else if (intent === "create_matter") {
          send({ type: "action", action: "navigate", href: "/matters", message: "Opening new matter form..." });
        } else if (intent === "create_invoice") {
          send({ type: "action", action: "navigate", href: "/invoicing", message: "Opening invoice creation..." });
        } else {
          // General AI response
          send({ type: "answer", message: `I'll help with that. Let me search for "${input}"...` });
          send({ type: "action", action: "navigate", href: `/search?q=${encodeURIComponent(input)}`, message: "Showing search results" });
        }

        send({ type: "done" });
      } catch (err: any) {
        send({ type: "error", message: err.message });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
