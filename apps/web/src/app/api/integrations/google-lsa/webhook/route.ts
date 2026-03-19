import { NextRequest, NextResponse } from "next/server";
import * as googleLsa from "@/lib/integrations/google-lsa";
import * as engine from "@/lib/lsa-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body) {
      return NextResponse.json({ error: "No body" }, { status: 400 });
    }

    const result = await googleLsa.processWebhook(body.event || body.type || "unknown", body);

    if (result?.leadId && result?.eventType?.startsWith("lead.")) {
      engine.processNewLead(result.leadId).catch(err => console.error("[LSA] Process error:", err.message));
    }

    return NextResponse.json({ ok: true, result }, { status: 200 });
  } catch (err: any) {
    console.error("[Google LSA Webhook]", err);
    return NextResponse.json({ error: err.message }, { status: 200 });
  }
}
