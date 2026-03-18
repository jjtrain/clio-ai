import { NextRequest, NextResponse } from "next/server";
import { casemailProcessWebhook } from "@/lib/integrations/casemail";
import { handleDeliveryConfirmed, handleReturnToSender } from "@/lib/mail-engine";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const event = await casemailProcessWebhook(payload);
    if (event.eventType === "mailing.delivered" && event.jobId) {
      handleDeliveryConfirmed(event.jobId).catch(err => console.error("[CaseMail] Delivery handling error:", err.message));
    }
    if (event.eventType === "mailing.returned" && event.jobId) {
      handleReturnToSender(event.jobId).catch(err => console.error("[CaseMail] Return handling error:", err.message));
    }
    return NextResponse.json(event);
  } catch (err: any) {
    console.error("[CaseMail Webhook] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
