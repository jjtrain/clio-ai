import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/integrations/agilelaw";
import { analyzeDeposition } from "@/lib/timelines-engine";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const event = await processWebhook(payload);
    if (event.action === "session_ended" && event.sessionId) {
      analyzeDeposition(event.sessionId).catch(err => console.error("[AgileLaw] Analysis error:", err.message));
    }
    return NextResponse.json(event);
  } catch (err: any) {
    console.error("[AgileLaw Webhook] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
