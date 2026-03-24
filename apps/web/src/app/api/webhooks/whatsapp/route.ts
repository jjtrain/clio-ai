import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { processInboundMessage } from "@/lib/whatsapp/inbound-processor";

export const dynamic = "force-dynamic";

const APP_SECRET = process.env.WHATSAPP_APP_SECRET || "";

// GET — Webhook verification
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token) {
    const connection = await db.whatsAppConnection.findFirst({ where: { webhookVerifyToken: token } });
    if (connection && challenge) {
      return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
  }

  return new NextResponse("Forbidden", { status: 403 });
}

// POST — Inbound events
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Validate signature
    if (APP_SECRET) {
      const signature = req.headers.get("x-hub-signature-256");
      if (signature) {
        const expected = "sha256=" + crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
        if (signature !== expected) {
          console.error("[WhatsApp Webhook] Invalid signature");
          return NextResponse.json({ ok: false }, { status: 401 });
        }
      }
    }

    const body = JSON.parse(rawBody);
    const entries = body.entry || [];

    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const value = change.value;
        if (!value) continue;

        const wabaId = value.metadata?.phone_number_id ? undefined : entry.id;

        // Handle inbound messages
        if (value.messages) {
          for (const message of value.messages) {
            processInboundMessage(
              value.metadata?.phone_number_id || entry.id,
              message,
              value.contacts || []
            ).catch((err) => console.error("[WhatsApp] Process error:", err.message));
          }
        }

        // Handle status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            const waMsg = await db.whatsAppMessage.findUnique({ where: { waMessageId: status.id } });
            if (!waMsg) continue;

            const updates: any = {};
            switch (status.status) {
              case "delivered": updates.status = "DELIVERED"; updates.deliveredAt = new Date(); break;
              case "read": updates.status = "READ"; updates.readAt = new Date(); break;
              case "failed": updates.status = "FAILED"; updates.failureReason = status.errors?.[0]?.message; break;
            }
            if (Object.keys(updates).length > 0) {
              await db.whatsAppMessage.update({ where: { id: waMsg.id }, data: updates });
            }
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[WhatsApp Webhook] Error:", err);
    return NextResponse.json({ ok: true }); // Always 200 to prevent retries
  }
}
