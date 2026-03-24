import axios, { AxiosInstance } from "axios";
import { db } from "@/lib/db";

const BASE_URL = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v18.0"}`;

export async function getClient(firmId: string): Promise<{ api: AxiosInstance; connection: any }> {
  const connection = await db.whatsAppConnection.findUnique({ where: { firmId } });
  if (!connection || !connection.isActive) throw new Error("WhatsApp not connected");
  return {
    connection,
    api: axios.create({ baseURL: BASE_URL, headers: { Authorization: `Bearer ${connection.accessToken}` } }),
  };
}

export async function sendTextMessage(firmId: string, toPhone: string, text: string, replyToWaMessageId?: string) {
  const { api, connection } = await getClient(firmId);
  const body: any = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: toPhone,
    type: "text",
    text: { preview_url: false, body: text },
  };
  if (replyToWaMessageId) body.context = { message_id: replyToWaMessageId };
  const res = await api.post(`/${connection.phoneNumberId}/messages`, body);
  return { waMessageId: res.data.messages?.[0]?.id, status: "sent" };
}

export async function sendTemplateMessage(firmId: string, toPhone: string, templateName: string, languageCode: string, components?: any[]) {
  const { api, connection } = await getClient(firmId);
  const res = await api.post(`/${connection.phoneNumberId}/messages`, {
    messaging_product: "whatsapp",
    to: toPhone,
    type: "template",
    template: { name: templateName, language: { code: languageCode }, components },
  });
  return { waMessageId: res.data.messages?.[0]?.id, status: "sent" };
}

export async function sendMediaMessage(firmId: string, toPhone: string, type: string, mediaIdOrUrl: string, caption?: string, filename?: string) {
  const { api, connection } = await getClient(firmId);
  const mediaPayload = mediaIdOrUrl.startsWith("http")
    ? { link: mediaIdOrUrl, caption, filename }
    : { id: mediaIdOrUrl, caption, filename };
  const res = await api.post(`/${connection.phoneNumberId}/messages`, {
    messaging_product: "whatsapp", to: toPhone, type, [type]: mediaPayload,
  });
  return { waMessageId: res.data.messages?.[0]?.id, status: "sent" };
}

export async function uploadMedia(firmId: string, fileBuffer: Buffer, mimeType: string, filename: string) {
  const { api, connection } = await getClient(firmId);
  const FormData = (await import("form-data")).default;
  const form = new FormData();
  form.append("file", fileBuffer, { filename, contentType: mimeType });
  form.append("type", mimeType);
  form.append("messaging_product", "whatsapp");
  const res = await api.post(`/${connection.phoneNumberId}/media`, form, { headers: form.getHeaders() });
  return { mediaId: res.data.id };
}

export async function downloadMedia(firmId: string, mediaId: string) {
  const { api } = await getClient(firmId);
  const metaRes = await api.get(`/${mediaId}`);
  const url = metaRes.data.url;
  const mimeType = metaRes.data.mime_type;
  const dataRes = await api.get(url, { responseType: "arraybuffer" });
  return { buffer: Buffer.from(dataRes.data), mimeType, fileSize: dataRes.data.byteLength };
}

export async function markMessageRead(firmId: string, waMessageId: string) {
  const { api, connection } = await getClient(firmId);
  await api.post(`/${connection.phoneNumberId}/messages`, {
    messaging_product: "whatsapp", status: "read", message_id: waMessageId,
  });
}

export async function getTemplates(firmId: string) {
  const { api, connection } = await getClient(firmId);
  const res = await api.get(`/${connection.wabaId}/message_templates`);
  return res.data.data || [];
}

export async function getPhoneNumberQuality(firmId: string) {
  const { api, connection } = await getClient(firmId);
  const res = await api.get(`/${connection.phoneNumberId}?fields=quality_rating,display_phone_number,verified_name`);
  return res.data;
}
