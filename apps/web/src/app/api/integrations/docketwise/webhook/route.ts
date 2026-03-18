import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/integrations/docketwise";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await processWebhook(body);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[Docketwise Webhook]", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
