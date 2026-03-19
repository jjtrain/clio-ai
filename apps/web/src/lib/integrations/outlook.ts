import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

const API_BASE = "https://graph.microsoft.com/v1.0";
const PROVIDER = "OUTLOOK" as any;

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
  if (!config?.refreshToken || !config?.clientId || !config?.clientSecret || !config?.tenantId) return null;
  try {
    const res = await fetch(`https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: config.refreshToken,
        grant_type: "refresh_token",
        scope: "https://graph.microsoft.com/.default",
      }),
    });
    const data = await res.json();
    if (!data.access_token) return null;
    await db.emailIntegration.update({
      where: { provider: PROVIDER },
      data: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || config.refreshToken,
        tokenExpiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      },
    });
    return data.access_token;
  } catch { return null; }
}

export async function testConnection() {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Outlook not configured", provider: "OUTLOOK" };
  try {
    const res = await makeApiCall(`${API_BASE}/me?$select=mail,displayName`, { headers: authHeaders(token) });
    if (!res.ok) return { success: false, error: `Outlook returned ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: await res.json(), provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

// ─── Messages ───────────────────────────────────────────────────

export async function listMessages(opts?: { top?: number; skip?: number; filter?: string; orderBy?: string; select?: string }) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  const params = new URLSearchParams();
  if (opts?.top) params.set("$top", String(opts.top));
  if (opts?.skip) params.set("$skip", String(opts.skip));
  if (opts?.filter) params.set("$filter", opts.filter);
  if (opts?.orderBy) params.set("$orderby", opts.orderBy);
  if (opts?.select) params.set("$select", opts.select);
  try {
    const res = await makeApiCall(`${API_BASE}/me/messages?${params}`, { headers: authHeaders(token) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: await res.json(), provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

export async function getMessage(messageId: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  try {
    const res = await makeApiCall(`${API_BASE}/me/messages/${messageId}`, { headers: authHeaders(token) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: await res.json(), provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

export async function getConversationMessages(conversationId: string) {
  return listMessages({ filter: `conversationId eq '${conversationId}'` });
}

export async function sendMessage(params: { to: string[]; cc?: string[]; subject: string; body: string; importance?: string }) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  const toRecipients = params.to.map(e => ({ emailAddress: { address: e } }));
  const ccRecipients = (params.cc || []).map(e => ({ emailAddress: { address: e } }));
  try {
    const res = await makeApiCall(`${API_BASE}/me/sendMail`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        message: {
          subject: params.subject,
          body: { contentType: "HTML", content: params.body },
          toRecipients,
          ccRecipients: ccRecipients.length ? ccRecipients : undefined,
          importance: params.importance || "normal",
        },
      }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: { sent: true }, provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

export async function replyToMessage(messageId: string, comment: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  try {
    const res = await makeApiCall(`${API_BASE}/me/messages/${messageId}/reply`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ comment }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: { replied: true }, provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

export async function forwardMessage(messageId: string, to: string[], comment?: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  try {
    const res = await makeApiCall(`${API_BASE}/me/messages/${messageId}/forward`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        comment: comment || "",
        toRecipients: to.map(e => ({ emailAddress: { address: e } })),
      }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: { forwarded: true }, provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

export async function createDraft(params: { to: string[]; cc?: string[]; subject: string; body: string }) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  try {
    const res = await makeApiCall(`${API_BASE}/me/messages`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        subject: params.subject,
        body: { contentType: "HTML", content: params.body },
        toRecipients: params.to.map(e => ({ emailAddress: { address: e } })),
        ccRecipients: (params.cc || []).map(e => ({ emailAddress: { address: e } })),
      }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: await res.json(), provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

export async function sendDraft(messageId: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  try {
    const res = await makeApiCall(`${API_BASE}/me/messages/${messageId}/send`, {
      method: "POST",
      headers: authHeaders(token),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: { sent: true }, provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

export async function updateMessage(messageId: string, updates: { isRead?: boolean; categories?: string[]; flag?: any }) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  try {
    const res = await makeApiCall(`${API_BASE}/me/messages/${messageId}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify(updates),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: await res.json(), provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

export async function moveMessage(messageId: string, destinationFolderId: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  try {
    const res = await makeApiCall(`${API_BASE}/me/messages/${messageId}/move`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ destinationId: destinationFolderId }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: await res.json(), provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

export async function deleteMessage(messageId: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  try {
    const res = await makeApiCall(`${API_BASE}/me/messages/${messageId}`, {
      method: "DELETE",
      headers: authHeaders(token),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: { deleted: true }, provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

export async function getAttachment(messageId: string, attachmentId: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  try {
    const res = await makeApiCall(`${API_BASE}/me/messages/${messageId}/attachments/${attachmentId}`, {
      headers: authHeaders(token),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: await res.json(), provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

// ─── Folders ────────────────────────────────────────────────────

export async function listFolders() {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  try {
    const res = await makeApiCall(`${API_BASE}/me/mailFolders`, { headers: authHeaders(token) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: await res.json(), provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

export async function createFolder(displayName: string, parentFolderId?: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  const url = parentFolderId
    ? `${API_BASE}/me/mailFolders/${parentFolderId}/childFolders`
    : `${API_BASE}/me/mailFolders`;
  try {
    const res = await makeApiCall(url, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ displayName }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: await res.json(), provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

// ─── Search ─────────────────────────────────────────────────────

export async function searchMessages(query: string, top = 50) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  const params = new URLSearchParams({ $search: `"${query}"`, $top: String(top) });
  try {
    const res = await makeApiCall(`${API_BASE}/me/messages?${params}`, { headers: authHeaders(token) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: await res.json(), provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

// ─── Categories ─────────────────────────────────────────────────

export async function listCategories() {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  try {
    const res = await makeApiCall(`${API_BASE}/me/outlook/masterCategories`, { headers: authHeaders(token) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: await res.json(), provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

// ─── Subscriptions ──────────────────────────────────────────────

export async function createSubscription(notificationUrl: string, clientState: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  try {
    const res = await makeApiCall(`${API_BASE}/subscriptions`, {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({
        changeType: "created,updated",
        notificationUrl,
        resource: "me/messages",
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        clientState,
      }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: await res.json(), provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

export async function renewSubscription(subscriptionId: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  try {
    const res = await makeApiCall(`${API_BASE}/subscriptions/${subscriptionId}`, {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({
        expirationDateTime: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      }),
    });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: await res.json(), provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

// ─── Delta ──────────────────────────────────────────────────────

export async function getDelta(deltaLink?: string) {
  const token = await getValidToken();
  if (!token) return { success: false, error: "Not configured", provider: "OUTLOOK" };
  const url = deltaLink || `${API_BASE}/me/messages/delta`;
  try {
    const res = await makeApiCall(url, { headers: authHeaders(token) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "OUTLOOK" };
    return { success: true, data: await res.json(), provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}

// ─── Parse ──────────────────────────────────────────────────────

export function parseMessage(msg: any) {
  const toAddrs = (msg.toRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean).join(", ");
  const ccAddrs = (msg.ccRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean).join(", ");
  const bccAddrs = (msg.bccRecipients || []).map((r: any) => r.emailAddress?.address).filter(Boolean).join(", ");
  const attachments = (msg.attachments || []).map((a: any) => ({
    attachmentId: a.id,
    fileName: a.name,
    mimeType: a.contentType,
    size: a.size || 0,
  }));
  return {
    externalMessageId: msg.id,
    externalThreadId: msg.conversationId || null,
    from: msg.from?.emailAddress?.address || "",
    fromName: msg.from?.emailAddress?.name || null,
    to: toAddrs,
    cc: ccAddrs || null,
    bcc: bccAddrs || null,
    subject: msg.subject || "",
    bodyText: msg.body?.contentType === "text" ? msg.body.content : null,
    bodyHtml: msg.body?.contentType === "html" ? msg.body.content : msg.body?.content || null,
    snippet: msg.bodyPreview || null,
    date: new Date(msg.receivedDateTime || msg.sentDateTime || Date.now()),
    isRead: msg.isRead || false,
    isInbound: !msg.sentDateTime || msg.isDraft === false,
    isSent: !!msg.sentDateTime && !msg.isDraft,
    isDraft: msg.isDraft || false,
    hasAttachments: msg.hasAttachments || false,
    attachmentCount: attachments.length,
    attachments: attachments.length ? JSON.stringify(attachments) : null,
    labels: null,
    folder: msg.parentFolderId || null,
    importance: msg.importance || "normal",
    categories: msg.categories?.length ? JSON.stringify(msg.categories) : null,
  };
}

// ─── Webhook ────────────────────────────────────────────────────

export async function processWebhook(body: any) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Outlook not configured", provider: "OUTLOOK" };
  try {
    const notifications = body.value || [];
    const messages: any[] = [];
    for (const notification of notifications) {
      // Validate clientState
      if (config.webhookSecret && notification.clientState !== config.webhookSecret) continue;
      const resourceId = notification.resourceData?.id;
      if (!resourceId) continue;

      const msgResult = await getMessage(resourceId);
      if (!msgResult.success) continue;
      const parsed = parseMessage(msgResult.data);
      const record = await db.emailMessage.upsert({
        where: { provider_externalMessageId: { provider: PROVIDER, externalMessageId: parsed.externalMessageId } },
        create: { provider: PROVIDER, ...parsed },
        update: { ...parsed },
      });
      messages.push(record);
    }

    await db.emailIntegration.update({
      where: { provider: PROVIDER },
      data: { lastSyncAt: new Date(), lastSyncStatus: "success" },
    });

    return { success: true, data: { processed: messages.length, messages }, provider: "OUTLOOK" };
  } catch (err: any) { return { success: false, error: err.message, provider: "OUTLOOK" }; }
}
