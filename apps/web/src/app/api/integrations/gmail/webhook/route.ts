import { NextRequest, NextResponse } from "next/server";
import { processWebhook } from "@/lib/integrations/gmail";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body?.message;
    if (!message?.data) {
      return NextResponse.json({ error: "No message data" }, { status: 400 });
    }

    const decoded = JSON.parse(
      Buffer.from(message.data, "base64").toString("utf-8")
    );

    await processWebhook(decoded);

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (err: any) {
    console.error("[Gmail Webhook]", err);
    return NextResponse.json({ error: err.message }, { status: 200 });
  }
}
