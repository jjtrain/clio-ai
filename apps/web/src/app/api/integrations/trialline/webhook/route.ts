import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/integrations/trialline";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const event = await processWebhook(payload);
    return NextResponse.json(event);
  } catch (err: any) {
    console.error("[TrialLine Webhook] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
