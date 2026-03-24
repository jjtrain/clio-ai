import { db } from "@/lib/db";
import { sendTextMessage, sendTemplateMessage, sendMediaMessage, uploadMedia } from "./meta-client";

export class WindowExpiredError extends Error {
  constructor() {
    super("24-hour messaging window has closed. Use a Message Template to restart the conversation.");
    this.name = "WindowExpiredError";
  }
}

export async function sendMessage(params: {
  firmId: string;
  conversationId: string;
  senderId: string;
  type: "text" | "template" | "media";
  text?: string;
  templateName?: string;
  templateParams?: any;
  mediaBuffer?: Buffer;
  mediaMimeType?: string;
  mediaFilename?: string;
  replyToWaMessageId?: string;
}) {
  const conversation = await db.whatsAppConversation.findUniqueOrThrow({
    where: { id: params.conversationId },
    include: { connection: true },
  });

  // Window check for non-template messages
  if (params.type !== "template") {
    if (!conversation.windowExpiresAt || conversation.windowExpiresAt < new Date()) {
      throw new WindowExpiredError();
    }
  }

  let waResult: { waMessageId: string; status: string };
  let messageType: string = "TEXT";
  let bodyText = params.text || null;
  let templateName: string | null = null;
  let mediaUrl: string | null = null;

  if (params.type === "text") {
    waResult = await sendTextMessage(params.firmId, conversation.clientPhone, params.text!, params.replyToWaMessageId);
  } else if (params.type === "template") {
    const template = await db.whatsAppTemplate.findFirst({
      where: { connectionId: conversation.connectionId, name: params.templateName, status: "APPROVED" },
    });
    if (!template) throw new Error(`Template "${params.templateName}" not found or not approved`);
    waResult = await sendTemplateMessage(params.firmId, conversation.clientPhone, template.name, template.language, params.templateParams);
    messageType = "TEMPLATE";
    templateName = template.name;
    bodyText = `[Template: ${template.name}]`;
  } else {
    // Media
    if (!params.mediaBuffer) throw new Error("Media buffer required");
    const { mediaId } = await uploadMedia(params.firmId, params.mediaBuffer, params.mediaMimeType || "application/octet-stream", params.mediaFilename || "file");
    const mediaType = params.mediaMimeType?.startsWith("image") ? "image"
      : params.mediaMimeType?.startsWith("video") ? "video"
      : params.mediaMimeType?.startsWith("audio") ? "audio"
      : "document";
    waResult = await sendMediaMessage(params.firmId, conversation.clientPhone, mediaType, mediaId, params.text, params.mediaFilename);
    messageType = mediaType.toUpperCase();
  }

  // Get sender name
  const sender = await db.user.findUnique({ where: { id: params.senderId }, select: { name: true } });
  const snippet = (bodyText || `[${messageType}]`).slice(0, 200);

  // Create message record
  const message = await db.whatsAppMessage.create({
    data: {
      conversationId: params.conversationId,
      matterId: conversation.matterId,
      waMessageId: waResult.waMessageId,
      direction: "OUTBOUND",
      messageType: messageType as any,
      bodyText,
      templateName,
      templateParams: params.templateParams || undefined,
      mediaUrl,
      mediaMimeType: params.mediaMimeType,
      mediaFilename: params.mediaFilename,
      sentAt: new Date(),
      status: "SENT",
      senderName: sender?.name || null,
    },
  });

  // Update conversation
  await db.whatsAppConversation.update({
    where: { id: params.conversationId },
    data: { lastMessageAt: new Date(), lastMessageSnippet: snippet },
  });

  return message;
}

export async function getWindowStatus(conversationId: string) {
  const conversation = await db.whatsAppConversation.findUniqueOrThrow({ where: { id: conversationId } });
  const now = new Date();
  const isOpen = !!conversation.windowExpiresAt && conversation.windowExpiresAt > now;
  const minutesRemaining = isOpen ? Math.round((conversation.windowExpiresAt!.getTime() - now.getTime()) / 60000) : null;

  const templates = await db.whatsAppTemplate.findMany({
    where: { connectionId: conversation.connectionId, status: "APPROVED", isActive: true },
    select: { id: true, name: true, category: true, components: true },
    take: 10,
  });

  return {
    isOpen,
    expiresAt: conversation.windowExpiresAt,
    minutesRemaining,
    canSendFreeForm: isOpen,
    suggestedTemplates: templates,
  };
}
