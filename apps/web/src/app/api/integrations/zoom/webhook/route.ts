import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processWebhook, verifyWebhook } from "@/lib/integrations/zoom";
import { handleMeetingEndPostProcessing } from "@/lib/zoom-meeting-engine";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    // Handle Zoom URL validation challenge
    if (payload.event === "endpoint.url_validation") {
      const config = await db.videoIntegration.findUnique({ where: { provider: "ZOOM" } });
      const secret = config?.webhookSecret || "";
      const plainToken = payload.payload?.plainToken;
      const encryptedToken = crypto.createHmac("sha256", secret).update(plainToken).digest("hex");
      return NextResponse.json({ plainToken, encryptedToken });
    }

    // Verify webhook signature
    const signature = req.headers.get("x-zm-signature") || "";
    const timestamp = req.headers.get("x-zm-request-timestamp") || "";
    const config = await db.videoIntegration.findUnique({ where: { provider: "ZOOM" } });

    if (config?.webhookSecret && signature) {
      const valid = verifyWebhook(rawBody, signature, timestamp, config.webhookSecret);
      if (!valid) {
        console.error("[Zoom Webhook] Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
      }
    }

    // Process event
    const event = await processWebhook(payload);

    // Post-processing for meeting ended
    if (event.type === "meeting.ended") {
      const meeting = await db.zoomMeeting.findFirst({ where: { zoomMeetingId: String(event.data.id) } });
      if (meeting) {
        // Process in background — don't block the webhook response
        handleMeetingEndPostProcessing(meeting.id).catch((err) =>
          console.error("[Zoom Webhook] Post-processing error:", err.message)
        );
      }
    }

    // Process recording completed
    if (event.type === "recording.completed") {
      const meeting = await db.zoomMeeting.findFirst({ where: { zoomMeetingId: String(event.data.id) } });
      if (meeting) {
        const { processRecordingReady } = await import("@/lib/zoom-meeting-engine");
        processRecordingReady(meeting.id).catch((err) =>
          console.error("[Zoom Webhook] Recording processing error:", err.message)
        );
      }
    }

    return NextResponse.json({ received: true, eventType: event.type });
  } catch (err: any) {
    console.error("[Zoom Webhook] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
