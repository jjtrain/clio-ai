import { db } from "@/lib/db";
import { downloadMedia } from "./meta-client";
import { fireWebhook } from "@/lib/webhooks/dispatcher";

export async function processInboundMessage(wabaId: string, message: any, contacts: any[]) {
  // 1. Find connection
  const connection = await db.whatsAppConnection.findFirst({ where: { wabaId } });
  if (!connection) return;

  const fromPhone = message.from;
  const messageId = message.id;
  const timestamp = new Date(parseInt(message.timestamp) * 1000);
  const contactName = contacts?.[0]?.profile?.name || null;

  // 2. Determine message type + content
  const type = message.type?.toUpperCase() || "TEXT";
  let bodyText: string | null = null;
  let mediaId: string | null = null;
  let mediaMimeType: string | null = null;
  let mediaFilename: string | null = null;

  switch (message.type) {
    case "text": bodyText = message.text?.body; break;
    case "image": mediaId = message.image?.id; mediaMimeType = message.image?.mime_type; bodyText = message.image?.caption; break;
    case "document": mediaId = message.document?.id; mediaMimeType = message.document?.mime_type; mediaFilename = message.document?.filename; bodyText = message.document?.caption; break;
    case "audio": mediaId = message.audio?.id; mediaMimeType = message.audio?.mime_type; break;
    case "video": mediaId = message.video?.id; mediaMimeType = message.video?.mime_type; bodyText = message.video?.caption; break;
    case "reaction": bodyText = message.reaction?.emoji; break;
    case "location": bodyText = `Location: ${message.location?.latitude}, ${message.location?.longitude}`; break;
  }

  const snippet = (bodyText || `[${type}]`).slice(0, 200);

  // 3. Find or create conversation
  let conversation = await db.whatsAppConversation.findFirst({
    where: { connectionId: connection.id, clientPhone: fromPhone },
  });

  if (!conversation) {
    // Auto-file by phone match
    const matterId = await autoFileByPhone(fromPhone);

    conversation = await db.whatsAppConversation.create({
      data: {
        firmId: connection.firmId,
        connectionId: connection.id,
        clientPhone: fromPhone,
        clientName: contactName,
        matterId,
        autoFiled: !!matterId,
        status: matterId ? "OPEN" : "PENDING",
        windowExpiresAt: new Date(Date.now() + 24 * 3600000),
        lastMessageAt: timestamp,
        lastMessageSnippet: snippet,
        unreadCount: 1,
      },
    });
  } else {
    await db.whatsAppConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: timestamp,
        lastMessageSnippet: snippet,
        unreadCount: { increment: 1 },
        windowExpiresAt: new Date(Date.now() + 24 * 3600000),
        clientName: contactName || conversation.clientName,
      },
    });
  }

  // 4. Skip duplicate
  const existing = await db.whatsAppMessage.findUnique({ where: { waMessageId: messageId } });
  if (existing) return existing;

  // 5. Create message
  const waMessage = await db.whatsAppMessage.create({
    data: {
      conversationId: conversation.id,
      matterId: conversation.matterId,
      waMessageId: messageId,
      direction: "INBOUND",
      messageType: (["TEXT", "IMAGE", "DOCUMENT", "AUDIO", "VIDEO", "TEMPLATE", "REACTION", "LOCATION"].includes(type) ? type : "UNSUPPORTED") as any,
      bodyText,
      mediaId,
      mediaMimeType,
      mediaFilename,
      sentAt: timestamp,
      status: "DELIVERED",
      deliveredAt: new Date(),
      senderName: contactName,
    },
  });

  // 6. Download media async
  if (mediaId) {
    downloadAndStoreMedia(connection.firmId, waMessage.id, mediaId).catch((err) =>
      console.error(`[WhatsApp] Media download failed for ${mediaId}:`, err.message)
    );
  }

  // 7. Fire webhook
  await fireWebhook("WHATSAPP_MESSAGE_RECEIVED" as any, connection.firmId, {
    conversationId: conversation.id,
    clientPhone: fromPhone,
    clientName: contactName,
    matterId: conversation.matterId,
    messageType: type,
    snippet,
    timestamp: timestamp.toISOString(),
  }).catch(() => {});

  return waMessage;
}

async function downloadAndStoreMedia(firmId: string, messageId: string, mediaId: string) {
  try {
    const { buffer, mimeType, fileSize } = await downloadMedia(firmId, mediaId);
    // In production: upload to Vercel Blob or S3
    // For now: store as base64 data URL (limited to small files)
    const dataUrl = `data:${mimeType};base64,${buffer.toString("base64").slice(0, 100)}...`;
    await db.whatsAppMessage.update({
      where: { id: messageId },
      data: { mediaUrl: `stored://${firmId}/whatsapp/${messageId}`, mediaSize: fileSize },
    });
  } catch (err: any) {
    console.error(`[WhatsApp] Media storage error:`, err.message);
  }
}

async function autoFileByPhone(phone: string): Promise<string | null> {
  // Normalize phone variants
  const variants = [phone, phone.replace("+", ""), phone.replace("+1", "")];

  for (const variant of variants) {
    const client = await db.client.findFirst({
      where: { phone: { contains: variant.slice(-10) } },
      include: { matters: { where: { status: "OPEN" }, select: { id: true }, take: 2 } },
    });
    if (client && client.matters.length === 1) return client.matters[0].id;
  }

  return null;
}
