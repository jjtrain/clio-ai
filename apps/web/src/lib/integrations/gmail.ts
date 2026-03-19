import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

const API_BASE = "https://gmail.googleapis.com/gmail/v1";
const PROVIDER = "GMAIL" as any;

// ─── Config ─────────────────────────────────────────────────────

export async function getConfig() {
  const config = await db.emailIntegration.findUnique({ where: { provider: PROVIDER } });
  if (!config?.isEnabled || !config?.accessToken) return null;
  return config;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function getValidToken() {
  const config = await getConfig();
  if (!config) return null;
  if (config.tokenExpiresAt && config.tokenExpiresAt < new Date()) {
    return refreshAccessToken();
  }
  return config.accessToken;
}

// ─── Auth ───────────────────────────────────────────────────────

export async function refreshAccessToken(): Promise<string | null> {
  const config = await db.emailIntegration.findUnique({ where: { provider: PROVIDER } });
  if (!config?.refreshToken || !config?.clientId || !config?.clientSecret) return null;
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = await res.json();
    if (!data.access_token) return null;
    await db.emailIntegration.update({
      where: { provider: PROVIDER },
      data: {
        accessToken: data.access_token,
        tokenExpiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      },
    });
    return data.access_token;
  } catch { return null; }
}

export async function testConnection() {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Gmail not configured", provider: "GMAIL" };
  try {
    const res = await makeApiCall(`${API_BASE}/users/me/profile`, { headers: authHeaders(token) });
    if (!res.ok) return { success: false, error: `Gmail returned ${res.status}`, provider: "GMAIL" };
    return { success: true, data: await res.json(), provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}

// ─── Messages ───────────────────────────────────────────────────

export async function listMessages(query?: string, maxResults = 50, pageToken?: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "GMAIL" };
  const params = new URLSearchParams({ maxResults: String(maxResults) });
  if (query) params.set("q", query);
  if (pageToken) params.set("pageToken", pageToken);
  try {
    const res = await makeApiCall(`${API_BASE}/users/me/messages?${params}`, { headers: authHeaders(token) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "GMAIL" };
    return { success: true, data: await res.json(), provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}

export async function getMessage(messageId: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "GMAIL" };
  try {
    const res = await makeApiCall(`${API_BASE}/users/me/messages/${messageId}?format=full`, { headers: authHeaders(token) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "GMAIL" };
    return { success: true, data: await res.json(), provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}

export async function getThread(threadId: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "GMAIL" };
  try {
    const res = await makeApiCall(`${API_BASE}/users/me/threads/${threadId}`, { headers: authHeaders(token) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "GMAIL" };
    return { success: true, data: await res.json(), provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}

export async function sendMessage(params: { from: string; to: string; cc?: string; subject: string; body: string }) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "GMAIL" };
  const mimeLines = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    params.cc ? `Cc: ${params.cc}` : "",
    `Subject: ${params.subject}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    params.body,
  ].filter(Boolean).join("\r\n");
  const raw = Buffer.from(mimeLines).toString("base64url");
  try {
    const res = await makeApiCall(`${API_BASE}/users/me/messages/send`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ raw }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "GMAIL" };
    return { success: true, data: await res.json(), provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}

export async function createDraft(params: { from: string; to: string; cc?: string; subject: string; body: string }) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "GMAIL" };
  const mimeLines = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    params.cc ? `Cc: ${params.cc}` : "",
    `Subject: ${params.subject}`,
    "Content-Type: text/html; charset=utf-8",
    "",
    params.body,
  ].filter(Boolean).join("\r\n");
  const raw = Buffer.from(mimeLines).toString("base64url");
  try {
    const res = await makeApiCall(`${API_BASE}/users/me/drafts`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ message: { raw } }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "GMAIL" };
    return { success: true, data: await res.json(), provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}

export async function sendDraft(draftId: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "GMAIL" };
  try {
    const res = await makeApiCall(`${API_BASE}/users/me/drafts/send`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ id: draftId }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "GMAIL" };
    return { success: true, data: await res.json(), provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}

export async function modifyMessage(messageId: string, addLabels?: string[], removeLabels?: string[]) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "GMAIL" };
  try {
    const res = await makeApiCall(`${API_BASE}/users/me/messages/${messageId}/modify`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ addLabelIds: addLabels || [], removeLabelIds: removeLabels || [] }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "GMAIL" };
    return { success: true, data: await res.json(), provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}

export async function trashMessage(messageId: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "GMAIL" };
  try {
    const res = await makeApiCall(`${API_BASE}/users/me/messages/${messageId}/trash`, {
      method: "POST",
      headers: authHeaders(token),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "GMAIL" };
    return { success: true, data: await res.json(), provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}

export async function getAttachment(messageId: string, attachmentId: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "GMAIL" };
  try {
    const res = await makeApiCall(`${API_BASE}/users/me/messages/${messageId}/attachments/${attachmentId}`, {
      headers: authHeaders(token),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "GMAIL" };
    return { success: true, data: await res.json(), provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}

// ─── Labels ─────────────────────────────────────────────────────

export async function listLabels() {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "GMAIL" };
  try {
    const res = await makeApiCall(`${API_BASE}/users/me/labels`, { headers: authHeaders(token) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "GMAIL" };
    return { success: true, data: await res.json(), provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}

export async function createLabel(name: string, opts?: { bgColor?: string; textColor?: string }) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "GMAIL" };
  try {
    const res = await makeApiCall(`${API_BASE}/users/me/labels`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        name,
        labelListVisibility: "labelShow",
        messageListVisibility: "show",
        ...(opts?.bgColor ? { color: { backgroundColor: opts.bgColor, textColor: opts.textColor || "#000000" } } : {}),
      }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "GMAIL" };
    return { success: true, data: await res.json(), provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}

export async function deleteLabel(labelId: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "GMAIL" };
  try {
    const res = await makeApiCall(`${API_BASE}/users/me/labels/${labelId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "GMAIL" };
    return { success: true, data: { deleted: true }, provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}

// ─── History & Watch ────────────────────────────────────────────

export async function getHistory(startHistoryId: string, historyTypes?: string[]) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "GMAIL" };
  const params = new URLSearchParams({ startHistoryId });
  if (historyTypes) params.set("historyTypes", historyTypes.join(","));
  try {
    const res = await makeApiCall(`${API_BASE}/users/me/history?${params}`, { headers: authHeaders(token) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "GMAIL" };
    return { success: true, data: await res.json(), provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}

export async function watchMailbox(topicName: string, labelIds?: string[]) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "GMAIL" };
  try {
    const res = await makeApiCall(`${API_BASE}/users/me/watch`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ topicName, labelIds: labelIds || ["INBOX"] }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "GMAIL" };
    return { success: true, data: await res.json(), provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}

// ─── Search (wrapper) ───────────────────────────────────────────

export async function searchMessages(query: string, maxResults = 50) {
  return listMessages(query, maxResults);
}

// ─── Parse ──────────────────────────────────────────────────────

function getHeader(headers: any[], name: string): string {
  return headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";
}

function getBody(payload: any): { text: string; html: string } {
  if (payload.body?.data) {
    const decoded = Buffer.from(payload.body.data, "base64url").toString("utf-8");
    return payload.mimeType === "text/html" ? { text: "", html: decoded } : { text: decoded, html: "" };
  }
  let text = "", html = "";
  for (const part of payload.parts || []) {
    if (part.mimeType === "text/plain" && part.body?.data) {
      text = Buffer.from(part.body.data, "base64url").toString("utf-8");
    } else if (part.mimeType === "text/html" && part.body?.data) {
      html = Buffer.from(part.body.data, "base64url").toString("utf-8");
    } else if (part.parts) {
      const nested = getBody(part);
      if (nested.text) text = nested.text;
      if (nested.html) html = nested.html;
    }
  }
  return { text, html };
}

export function parseMessage(msg: any) {
  const headers = msg.payload?.headers || [];
  const { text, html } = getBody(msg.payload || {});
  const attachments = (msg.payload?.parts || [])
    .filter((p: any) => p.filename && p.body?.attachmentId)
    .map((p: any) => ({
      attachmentId: p.body.attachmentId,
      fileName: p.filename,
      mimeType: p.mimeType,
      size: p.body.size || 0,
    }));
  return {
    externalMessageId: msg.id,
    externalThreadId: msg.threadId,
    from: getHeader(headers, "From"),
    to: getHeader(headers, "To"),
    cc: getHeader(headers, "Cc") || null,
    subject: getHeader(headers, "Subject"),
    bodyText: text || null,
    bodyHtml: html || null,
    snippet: msg.snippet || null,
    date: new Date(parseInt(msg.internalDate) || Date.now()),
    labels: (msg.labelIds || []).join(","),
    hasAttachments: attachments.length > 0,
    attachmentCount: attachments.length,
    attachments: attachments.length ? JSON.stringify(attachments) : null,
    isRead: !(msg.labelIds || []).includes("UNREAD"),
    isInbound: (msg.labelIds || []).includes("INBOX"),
    isSent: (msg.labelIds || []).includes("SENT"),
    isDraft: (msg.labelIds || []).includes("DRAFT"),
  };
}

// ─── Webhook ────────────────────────────────────────────────────

export async function processWebhook(body: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Gmail not configured", provider: "GMAIL" };
  try {
    // Parse Pub/Sub notification
    const data = JSON.parse(Buffer.from(body.message?.data || "", "base64").toString("utf-8"));
    const historyId = data.historyId;
    if (!historyId || !config.historyId) return { success: false, error: "No historyId", provider: "GMAIL" };

    const historyResult = await getHistory(config.historyId, ["messageAdded"]);
    if (!historyResult.success) return historyResult;

    const messages: any[] = [];
    for (const record of historyResult.data?.history || []) {
      for (const added of record.messagesAdded || []) {
        const msgResult = await getMessage(added.message.id);
        if (msgResult.success) {
          const parsed = parseMessage(msgResult.data);
          const record = await db.emailMessage.upsert({
            where: { provider_externalMessageId: { provider: PROVIDER, externalMessageId: parsed.externalMessageId } },
            create: { provider: PROVIDER, ...parsed },
            update: { ...parsed },
          });
          messages.push(record);
        }
      }
    }

    // Update historyId
    await db.emailIntegration.update({
      where: { provider: PROVIDER },
      data: { historyId: String(historyId), lastSyncAt: new Date(), lastSyncStatus: "success" },
    });

    return { success: true, data: { processed: messages.length, messages }, provider: "GMAIL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GMAIL" }; }
}
