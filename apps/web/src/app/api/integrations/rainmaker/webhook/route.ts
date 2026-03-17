import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/integrations/rainmaker";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const event = await processWebhook(payload);
    return NextResponse.json({ received: true, eventType: event.type });
  } catch (err: any) {
    console.error("[Rainmaker Webhook] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
