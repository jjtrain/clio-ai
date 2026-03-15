import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyWebhookHash, computeEventHash } from "@/lib/hellosign";

// HelloSign webhook callback handler
// HelloSign sends events when signature requests change status
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const jsonStr = formData.get("json");
    if (!jsonStr || typeof jsonStr !== "string") {
      return NextResponse.json({ error: "Missing json field" }, { status: 400 });
    }

    const payload = JSON.parse(jsonStr);
    const event = payload.event;
    const sigReq = payload.signature_request;

    if (!event || !sigReq) {
      // HelloSign sends a test callback with just event_type: "callback_test"
      return new NextResponse("Hello API Event Received", { status: 200 });
    }

    // Verify webhook signature if we have a secret configured
    const settings = await db.helloSignSettings.findUnique({ where: { id: "default" } });
    if (settings?.apiKey && event.event_hash && event.event_time && event.event_type) {
      const isValid = verifyWebhookHash(
        event.event_hash,
        settings.apiKey,
        event.event_time,
        event.event_type
      );
      if (!isValid) {
        console.warn("[HelloSign Webhook] Invalid event hash");
        // Still return 200 to prevent retries, but log the issue
      }
    }

    const helloSignRequestId = sigReq.signature_request_id;
    if (!helloSignRequestId) {
      return new NextResponse("Hello API Event Received", { status: 200 });
    }

    // Find our local record
    const request = await db.signatureRequest.findFirst({
      where: { helloSignRequestId },
    });

    if (!request) {
      console.warn("[HelloSign Webhook] No local record for request:", helloSignRequestId);
      return new NextResponse("Hello API Event Received", { status: 200 });
    }

    const eventType = event.event_type;
    console.log("[HelloSign Webhook] Event:", eventType, "for request:", helloSignRequestId);

    switch (eventType) {
      case "signature_request_signed": {
        // A signer has signed
        const signedSig = sigReq.signatures?.find(
          (s: any) => s.status_code === "signed" && s.signer_email_address === request.clientEmail
        );
        if (signedSig) {
          await db.signatureRequest.update({
            where: { id: request.id },
            data: {
              clientSignedAt: new Date(),
              hellosignStatus: "partially_signed",
              status: request.attorneyName ? "PENDING_ATTORNEY" : "COMPLETED",
              completedAt: request.attorneyName ? undefined : new Date(),
            },
          });
        }
        break;
      }

      case "signature_request_all_signed": {
        // All signers have signed - request is complete
        await db.signatureRequest.update({
          where: { id: request.id },
          data: {
            status: "COMPLETED",
            hellosignStatus: "all_signed",
            completedAt: new Date(),
            clientSignedAt: request.clientSignedAt || new Date(),
            attorneySignedAt: request.attorneyName ? new Date() : undefined,
            helloSignStatusData: JSON.stringify(sigReq),
          },
        });
        break;
      }

      case "signature_request_declined": {
        await db.signatureRequest.update({
          where: { id: request.id },
          data: { status: "CANCELLED", hellosignStatus: "declined" },
        });
        break;
      }

      case "signature_request_canceled": {
        await db.signatureRequest.update({
          where: { id: request.id },
          data: { status: "CANCELLED", hellosignStatus: "canceled" },
        });
        break;
      }

      case "signature_request_expired": {
        await db.signatureRequest.update({
          where: { id: request.id },
          data: { status: "EXPIRED", hellosignStatus: "expired" },
        });
        break;
      }

      default:
        console.log("[HelloSign Webhook] Unhandled event type:", eventType);
    }

    // Return with event hash for verification
    if (settings?.apiKey && event.event_time && event.event_type) {
      const hash = computeEventHash(settings.apiKey, event.event_time, event.event_type);
      return NextResponse.json({ event_hash: hash }, { status: 200 });
    }

    return new NextResponse("Hello API Event Received", { status: 200 });
  } catch (error) {
    console.error("[HelloSign Webhook] Error:", error);
    return new NextResponse("Hello API Event Received", { status: 200 });
  }
}

// HelloSign also sends a GET request to verify the callback URL
export async function GET() {
  return new NextResponse("Hello API Event Received", { status: 200 });
}
