import { NextResponse } from "next/server";
import { db } from "@/lib/db";

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
      // Respond with "Hello API Event Received" as required by HelloSign
      return new NextResponse("Hello API Event Received", { status: 200 });
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
          data: { status: "CANCELLED" },
        });
        break;
      }

      case "signature_request_canceled": {
        await db.signatureRequest.update({
          where: { id: request.id },
          data: { status: "CANCELLED" },
        });
        break;
      }

      case "signature_request_expired": {
        await db.signatureRequest.update({
          where: { id: request.id },
          data: { status: "EXPIRED" },
        });
        break;
      }

      default:
        // Other events: signature_request_sent, signature_request_viewed, etc.
        console.log("[HelloSign Webhook] Unhandled event type:", eventType);
    }

    // HelloSign requires this exact response
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
