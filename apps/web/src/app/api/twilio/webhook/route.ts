import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getTwilioConfig, sendSms, formatPhoneNumber, isOutsideBusinessHours } from "@/lib/twilio";

// Twilio incoming SMS webhook
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const body = formData.get("Body") as string;
    const messageSid = formData.get("MessageSid") as string;
    const numMedia = parseInt(formData.get("NumMedia") as string || "0");
    const mediaUrl = numMedia > 0 ? (formData.get("MediaUrl0") as string) : null;

    if (!from || !to || !body) {
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    const fromNumber = formatPhoneNumber(from);
    const toNumber = formatPhoneNumber(to);

    // Check for STOP opt-out
    const upperBody = body.trim().toUpperCase();
    if (upperBody === "STOP" || upperBody === "UNSUBSCRIBE") {
      await db.textConversation.updateMany({
        where: { clientPhone: fromNumber, firmPhone: toNumber },
        data: { isOptedOut: true },
      });
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Check for START opt-in
    if (upperBody === "START" || upperBody === "YES") {
      await db.textConversation.updateMany({
        where: { clientPhone: fromNumber, firmPhone: toNumber },
        data: { isOptedOut: false },
      });
    }

    // Find or create conversation
    let conversation = await db.textConversation.findUnique({
      where: { clientPhone_firmPhone: { clientPhone: fromNumber, firmPhone: toNumber } },
    });

    // Try to match client by phone number
    let clientId: string | null = null;
    const client = await db.client.findFirst({
      where: {
        OR: [
          { phone: { contains: from.replace(/\D/g, "").slice(-10) } },
        ],
      },
    });
    if (client) clientId = client.id;

    if (!conversation) {
      if (!clientId) {
        // Create without client link — will appear as unknown number
        // We still need a clientId for the relation, so skip if no match
        // Actually, create a TextMessage without conversation for now
      }
      if (clientId) {
        conversation = await db.textConversation.create({
          data: {
            clientId,
            clientPhone: fromNumber,
            firmPhone: toNumber,
          },
        });
      }
    }

    // Create message
    await db.textMessage.create({
      data: {
        conversationId: conversation?.id || null,
        clientId,
        direction: "INBOUND" as any,
        fromNumber,
        toNumber,
        body,
        status: "RECEIVED" as any,
        externalId: messageSid,
        mediaUrl,
        isRead: false,
        createdAt: new Date(),
      },
    });

    // Update conversation
    if (conversation) {
      await db.textConversation.update({
        where: { id: conversation.id },
        data: {
          lastMessageAt: new Date(),
          lastMessagePreview: body.substring(0, 100),
          unreadCount: { increment: 1 },
        },
      });
    }

    // Auto-reply
    const config = await getTwilioConfig();
    if (config?.autoReplyEnabled && config.autoReplyMessage && conversation && !conversation.isOptedOut) {
      const shouldReply = !config.autoReplyOutsideHours || isOutsideBusinessHours(config.businessHours);
      if (shouldReply) {
        await sendSms(config, fromNumber, config.autoReplyMessage);
      }
    }

    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("[Twilio Webhook] Error:", error);
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  }
}
