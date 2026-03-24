import { db } from "@/lib/db";
import { getAuthorizedClient } from "./oauth";

interface SendEmailParams {
  userId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  matterId?: string;
  replyToGmailThreadId?: string;
}

export async function sendEmail(params: SendEmailParams): Promise<{ gmailMessageId: string; threadId: string }> {
  const { gmail, connection } = await getAuthorizedClient(params.userId);

  // Build RFC 2822 MIME message
  const boundary = `boundary_${Date.now()}`;
  const toHeader = params.to.join(", ");
  const ccHeader = params.cc?.join(", ") || "";
  const bccHeader = params.bcc?.join(", ") || "";

  let mimeMessage = [
    `From: ${connection.email}`,
    `To: ${toHeader}`,
    ccHeader ? `Cc: ${ccHeader}` : null,
    bccHeader ? `Bcc: ${bccHeader}` : null,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ``,
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    ``,
    stripHtml(params.bodyHtml),
    ``,
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    ``,
    params.bodyHtml,
    ``,
    `--${boundary}--`,
  ].filter((l) => l !== null).join("\r\n");

  const encodedMessage = Buffer.from(mimeMessage).toString("base64url");

  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
      threadId: params.replyToGmailThreadId || undefined,
    },
  });

  const gmailMessageId = res.data.id || "";
  const threadId = res.data.threadId || "";

  // Store in our DB
  await db.emailMessage.create({
    data: {
      provider: "GMAIL",
      externalMessageId: gmailMessageId,
      externalThreadId: threadId,
      matterId: params.matterId || null,
      from: connection.email,
      fromName: null,
      to: toHeader,
      cc: ccHeader || null,
      bcc: bccHeader || null,
      subject: params.subject,
      bodyHtml: params.bodyHtml,
      bodyText: stripHtml(params.bodyHtml),
      date: new Date(),
      isSent: true,
      isInbound: false,
      isRead: true,
      folder: "SENT",
    },
  });

  // Update thread
  const existingThread = await db.emailThread.findFirst({
    where: { provider: "GMAIL", externalThreadId: threadId },
  });
  if (existingThread) {
    await db.emailThread.update({
      where: { id: existingThread.id },
      data: {
        messageCount: { increment: 1 },
        lastMessageDate: new Date(),
        lastMessageSnippet: stripHtml(params.bodyHtml).slice(0, 200),
        lastMessageFrom: connection.email,
        matterId: params.matterId || existingThread.matterId,
      },
    });
  } else {
    await db.emailThread.create({
      data: {
        provider: "GMAIL",
        externalThreadId: threadId,
        subject: params.subject,
        participants: [connection.email, ...params.to, ...(params.cc || [])].join(", "),
        messageCount: 1,
        lastMessageDate: new Date(),
        lastMessageSnippet: stripHtml(params.bodyHtml).slice(0, 200),
        lastMessageFrom: connection.email,
        matterId: params.matterId || null,
      },
    });
  }

  return { gmailMessageId, threadId };
}

export async function saveDraft(params: SendEmailParams): Promise<{ draftId: string }> {
  const { gmail, connection } = await getAuthorizedClient(params.userId);

  const mimeMessage = [
    `From: ${connection.email}`,
    `To: ${params.to.join(", ")}`,
    params.cc ? `Cc: ${params.cc.join(", ")}` : null,
    `Subject: ${params.subject}`,
    `Content-Type: text/html; charset="UTF-8"`,
    ``,
    params.bodyHtml,
  ].filter((l) => l !== null).join("\r\n");

  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw: Buffer.from(mimeMessage).toString("base64url"),
        threadId: params.replyToGmailThreadId || undefined,
      },
    },
  });

  const draftId = res.data.id || "";
  const msgId = res.data.message?.id || "";

  await db.emailMessage.create({
    data: {
      provider: "GMAIL",
      externalMessageId: msgId,
      externalThreadId: res.data.message?.threadId || null,
      matterId: params.matterId || null,
      from: connection.email,
      to: params.to.join(", "),
      cc: params.cc?.join(", ") || null,
      subject: params.subject,
      bodyHtml: params.bodyHtml,
      bodyText: stripHtml(params.bodyHtml),
      date: new Date(),
      isDraft: true,
      isSent: false,
      isInbound: false,
      folder: "DRAFTS",
    },
  });

  return { draftId };
}

export async function sendDraft(draftId: string, userId: string) {
  const { gmail } = await getAuthorizedClient(userId);
  const res = await gmail.users.drafts.send({
    userId: "me",
    requestBody: { id: draftId },
  });

  const msgId = res.data.id || "";
  // Update the draft message to sent status
  const existing = await db.emailMessage.findFirst({
    where: { provider: "GMAIL", externalMessageId: msgId },
  });
  if (existing) {
    await db.emailMessage.update({
      where: { id: existing.id },
      data: { isDraft: false, isSent: true, folder: "SENT", date: new Date() },
    });
  }

  return { gmailMessageId: msgId };
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}
