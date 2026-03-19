import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/integrations/lcs";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const result = await processWebhook(payload);

    return NextResponse.json({ received: true, event: result });
  } catch (err: any) {
    console.error("[LCS Webhook] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
