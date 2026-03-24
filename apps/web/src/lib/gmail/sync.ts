import { db } from "@/lib/db";
import { getAuthorizedClient } from "./oauth";
import { autoFileMessage } from "./autofiler";

// ─── Incremental Sync via History ───────────────────────────────

export async function syncGmailHistory(userId: string, startHistoryId?: string): Promise<{ processed: number }> {
  const { gmail, connection } = await getAuthorizedClient(userId);
  const historyId = startHistoryId || connection.historyId;
  if (!historyId) return fullSync(userId);

  let processed = 0;
  let pageToken: string | undefined;

  try {
    do {
      const res = await gmail.users.history.list({
        userId: "me",
        startHistoryId: historyId,
        historyTypes: ["messageAdded"],
        pageToken,
      });

      const histories = res.data.history || [];
      for (const h of histories) {
        const messages = h.messagesAdded || [];
        for (const m of messages) {
          if (m.message?.id) {
            await fetchAndStoreMessage(userId, m.message.id);
            processed++;
          }
        }
      }

      pageToken = res.data.nextPageToken || undefined;

      // Update history ID
      if (res.data.historyId) {
        await db.gmailConnection.update({
          where: { userId },
          data: { historyId: res.data.historyId, lastSyncAt: new Date() },
        });
      }
    } while (pageToken);
  } catch (err: any) {
    // If history ID is invalid/expired, fall back to full sync
    if (err.code === 404 || err.message?.includes("historyId")) {
      return fullSync(userId);
    }
    throw err;
  }

  return { processed };
}

// ─── Fetch and Store Single Message ─────────────────────────────

export async function fetchAndStoreMessage(userId: string, gmailMessageId: string) {
  // Skip if already stored
  const existing = await db.emailMessage.findFirst({
    where: { provider: "GMAIL", externalMessageId: gmailMessageId },
  });
  if (existing) return existing;

  const { gmail, connection } = await getAuthorizedClient(userId);

  const res = await gmail.users.messages.get({
    userId: "me",
    id: gmailMessageId,
    format: "full",
  });

  const msg = res.data;
  const headers = msg.payload?.headers || [];
  const getHeader = (name: string) => headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

  const from = getHeader("From");
  const to = getHeader("To");
  const cc = getHeader("Cc");
  const bcc = getHeader("Bcc");
  const subject = getHeader("Subject") || "(no subject)";
  const dateStr = getHeader("Date");
  const date = dateStr ? new Date(dateStr) : new Date();
  const threadId = msg.threadId || "";

  // Determine direction
  const fromEmail = extractEmail(from);
  const isOutbound = fromEmail.toLowerCase() === connection.email.toLowerCase();

  // Extract body parts
  const { html, text } = extractBody(msg.payload);

  // Extract attachment metadata
  const attachments = extractAttachments(msg.payload);

  // Upsert thread
  let thread = await db.emailThread.findFirst({
    where: { provider: "GMAIL", externalThreadId: threadId },
  });

  if (!thread) {
    thread = await db.emailThread.create({
      data: {
        provider: "GMAIL",
        externalThreadId: threadId,
        subject,
        participants: [from, to, cc].filter(Boolean).join(", "),
        messageCount: 1,
        lastMessageDate: date,
        lastMessageSnippet: msg.snippet || "",
        lastMessageFrom: from,
      },
    });
  } else {
    await db.emailThread.update({
      where: { id: thread.id },
      data: {
        messageCount: { increment: 1 },
        lastMessageDate: date > thread.lastMessageDate ? date : thread.lastMessageDate,
        lastMessageSnippet: msg.snippet || thread.lastMessageSnippet,
        lastMessageFrom: from,
      },
    });
  }

  // Create message
  const emailMessage = await db.emailMessage.create({
    data: {
      provider: "GMAIL",
      externalMessageId: gmailMessageId,
      externalThreadId: threadId,
      from,
      fromName: extractName(from),
      to,
      cc: cc || null,
      bcc: bcc || null,
      subject,
      bodyHtml: html || null,
      bodyText: text || null,
      snippet: msg.snippet || null,
      date,
      isRead: !(msg.labelIds || []).includes("UNREAD"),
      isSent: isOutbound,
      isInbound: !isOutbound,
      isDraft: (msg.labelIds || []).includes("DRAFT"),
      hasAttachments: attachments.length > 0,
      attachmentCount: attachments.length,
      labels: (msg.labelIds || []).join(","),
      folder: isOutbound ? "SENT" : "INBOX",
    },
  });

  // Store attachment metadata
  for (const att of attachments) {
    await db.emailAttachment.create({
      data: {
        messageId: emailMessage.id,
        externalAttachmentId: att.attachmentId,
        fileName: att.filename,
        mimeType: att.mimeType,
        size: att.size,
      },
    });
  }

  // Auto-file
  await autoFileMessage(emailMessage.id);

  return emailMessage;
}

// ─── Full Sync (first connect or manual resync) ─────────────────

export async function fullSync(userId: string): Promise<{ processed: number }> {
  const { gmail } = await getAuthorizedClient(userId);

  let processed = 0;
  let pageToken: string | undefined;

  const res = await gmail.users.messages.list({
    userId: "me",
    maxResults: 500,
    labelIds: ["INBOX", "SENT"],
    q: "newer_than:90d",
  });

  const messages = res.data.messages || [];
  for (const m of messages) {
    if (m.id) {
      try {
        await fetchAndStoreMessage(userId, m.id);
        processed++;
      } catch (err: any) {
        console.error(`[Gmail Sync] Error processing message ${m.id}:`, err.message);
      }
    }
  }

  // Get current history ID
  const profile = await gmail.users.getProfile({ userId: "me" });
  await db.gmailConnection.update({
    where: { userId },
    data: {
      historyId: profile.data.historyId || null,
      lastSyncAt: new Date(),
    },
  });

  return { processed };
}

// ─── MIME Parsing Helpers ────────────────────────────────────────

function extractBody(payload: any): { html: string | null; text: string | null } {
  let html: string | null = null;
  let text: string | null = null;

  function walk(part: any) {
    if (!part) return;
    if (part.mimeType === "text/html" && part.body?.data) {
      html = Buffer.from(part.body.data, "base64url").toString("utf-8");
    }
    if (part.mimeType === "text/plain" && part.body?.data) {
      text = Buffer.from(part.body.data, "base64url").toString("utf-8");
    }
    if (part.parts) {
      for (const p of part.parts) walk(p);
    }
  }

  walk(payload);
  return { html, text };
}

function extractAttachments(payload: any): Array<{ filename: string; mimeType: string; size: number; attachmentId: string }> {
  const attachments: Array<{ filename: string; mimeType: string; size: number; attachmentId: string }> = [];

  function walk(part: any) {
    if (!part) return;
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        filename: part.filename,
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body.size || 0,
        attachmentId: part.body.attachmentId,
      });
    }
    if (part.parts) {
      for (const p of part.parts) walk(p);
    }
  }

  walk(payload);
  return attachments;
}

function extractEmail(addr: string): string {
  const match = addr.match(/<([^>]+)>/);
  return match ? match[1] : addr.trim();
}

function extractName(addr: string): string {
  const match = addr.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : extractEmail(addr);
}
