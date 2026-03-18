import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

const API_BASE = "https://api.casemail.com/v1";

async function getConfig() {
  const s = await db.mailIntegration.findUnique({ where: { provider: "CASEMAIL" } });
  if (!s?.isEnabled || !s?.apiKey) return null;
  return { baseUrl: s.baseUrl || API_BASE, apiKey: s.apiKey, settings: s };
}
function headers(apiKey: string) { return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }; }

export async function casemailTestConnection() {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail is not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/account`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `CaseMail returned ${res.status}` };
    const data = await res.json();
    return { success: true, data: { accountName: data.name || data.account_name, accountId: data.id } };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailCreateMailJob(params: { recipientName: string; recipientAddress: string; recipientCity?: string; recipientState?: string; recipientZip?: string; documentUrls: string[]; mailClass?: string; isColor?: boolean; isDuplex?: boolean; returnAddress?: string; returnName?: string; certifiedMail?: boolean; returnReceipt?: boolean; }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/mailings`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ recipient_name: params.recipientName, recipient_address: params.recipientAddress, recipient_city: params.recipientCity, recipient_state: params.recipientState, recipient_zip: params.recipientZip, document_urls: params.documentUrls, mail_class: params.mailClass || config.settings.defaultMailClass || "first_class", is_color: params.isColor ?? false, is_duplex: params.isDuplex ?? false, return_address: params.returnAddress || config.settings.defaultReturnAddress, return_name: params.returnName || config.settings.defaultReturnName, certified_mail: params.certifiedMail ?? false, return_receipt: params.returnReceipt ?? false }) });
    if (!res.ok) return { success: false, error: `Create mailing failed: ${res.status}` };
    const data = await res.json();
    return { success: true, data: { jobId: data.id || data.job_id, status: data.status || "submitted", trackingNumber: data.tracking_number, estimatedCost: data.estimated_cost, estimatedDelivery: data.estimated_delivery } };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailGetMailJob(jobId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/mailings/${jobId}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailGetMailJobs(params?: { status?: string; page?: number; limit?: number }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const url = `${config.baseUrl}/mailings${qs.toString() ? `?${qs}` : ""}`;
    const res = await makeApiCall(url, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailCancelMailJob(jobId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/mailings/${jobId}/cancel`, { method: "POST", headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Cancel failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailGetTrackingStatus(jobId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/mailings/${jobId}/tracking`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailGetTrackingByNumber(trackingNumber: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/tracking/${trackingNumber}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailGetProofOfMailing(jobId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/mailings/${jobId}/proof-of-mailing`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailGetProofOfDelivery(jobId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/mailings/${jobId}/proof-of-delivery`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailGetReturnReceipt(jobId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/mailings/${jobId}/return-receipt`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailCreateBatch(params: { mailings: Array<{ recipientName: string; recipientAddress: string; recipientCity?: string; recipientState?: string; recipientZip?: string; documentUrls: string[]; mailClass?: string }>; name?: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/mailings/batch`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ name: params.name, mailings: params.mailings.map(m => ({ recipient_name: m.recipientName, recipient_address: m.recipientAddress, recipient_city: m.recipientCity, recipient_state: m.recipientState, recipient_zip: m.recipientZip, document_urls: m.documentUrls, mail_class: m.mailClass || config.settings.defaultMailClass || "first_class" })) }) });
    if (!res.ok) return { success: false, error: `Batch create failed: ${res.status}` };
    const data = await res.json();
    return { success: true, data: { batchId: data.id || data.batch_id, jobCount: data.job_count, status: data.status || "submitted" } };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailGetBatch(batchId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/mailings/batch/${batchId}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailCancelBatch(batchId: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/mailings/batch/${batchId}/cancel`, { method: "POST", headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Cancel batch failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailValidateAddress(params: { name?: string; addressLine1: string; addressLine2?: string; city: string; state: string; zip: string; country?: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/address/validate`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ name: params.name, address_line_1: params.addressLine1, address_line_2: params.addressLine2, city: params.city, state: params.state, zip: params.zip, country: params.country || "US" }) });
    if (!res.ok) return { success: false, error: `Validation failed: ${res.status}` };
    const data = await res.json();
    return { success: true, data: { isValid: data.is_valid ?? data.valid, standardized: data.standardized_address || data.standardized, deliverability: data.deliverability, corrections: data.corrections } };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailValidateAddressBulk(addresses: Array<{ name?: string; addressLine1: string; addressLine2?: string; city: string; state: string; zip: string; country?: string }>) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/address/validate/bulk`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ addresses: addresses.map(a => ({ name: a.name, address_line_1: a.addressLine1, address_line_2: a.addressLine2, city: a.city, state: a.state, zip: a.zip, country: a.country || "US" })) }) });
    if (!res.ok) return { success: false, error: `Bulk validation failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailGetCostEstimate(params: { mailClass: string; pageCount: number; isColor?: boolean; isDuplex?: boolean; certifiedMail?: boolean; returnReceipt?: boolean; quantity?: number }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/estimate`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ mail_class: params.mailClass, page_count: params.pageCount, is_color: params.isColor ?? false, is_duplex: params.isDuplex ?? false, certified_mail: params.certifiedMail ?? false, return_receipt: params.returnReceipt ?? false, quantity: params.quantity ?? 1 }) });
    if (!res.ok) return { success: false, error: `Estimate failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailGetMailClassOptions() {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/mail-classes`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailGetAccountBalance() {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const res = await makeApiCall(`${config.baseUrl}/account/balance`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailGetBillingHistory(params?: { startDate?: string; endDate?: string; page?: number }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set("start_date", params.startDate);
    if (params?.endDate) qs.set("end_date", params.endDate);
    if (params?.page) qs.set("page", String(params.page));
    const url = `${config.baseUrl}/billing${qs.toString() ? `?${qs}` : ""}`;
    const res = await makeApiCall(url, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function casemailGetStats(params?: { startDate?: string; endDate?: string }) {
  const config = await getConfig();
  if (!config) return { success: false, error: "CaseMail not configured." };
  try {
    const qs = new URLSearchParams();
    if (params?.startDate) qs.set("start_date", params.startDate);
    if (params?.endDate) qs.set("end_date", params.endDate);
    const url = `${config.baseUrl}/reports/stats${qs.toString() ? `?${qs}` : ""}`;
    const res = await makeApiCall(url, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
    return { success: true, data: await res.json() };
  } catch (err: any) { return { success: false, error: err.message }; }
}

const EVENT_STATUS_MAP: Record<string, string> = {
  "mailing.submitted": "SUBMITTED",
  "mailing.processing": "PROCESSING",
  "mailing.printed": "PRINTED",
  "mailing.mailed": "MAILED",
  "mailing.in_transit": "IN_TRANSIT",
  "mailing.delivered": "DELIVERED",
  "mailing.returned": "RETURNED",
  "mailing.return_receipt_ready": "DELIVERED",
  "mailing.failed": "FAILED",
};

const EVENT_TRACKING_MAP: Record<string, string> = {
  "mailing.submitted": "SUBMITTED",
  "mailing.processing": "PROCESSING",
  "mailing.printed": "PRINTED",
  "mailing.mailed": "MAILED",
  "mailing.in_transit": "IN_TRANSIT",
  "mailing.delivered": "DELIVERED",
  "mailing.returned": "RETURNED_TO_SENDER",
  "mailing.return_receipt_ready": "DELIVERED",
  "mailing.failed": "SUBMITTED",
};

export async function casemailProcessWebhook(payload: { event: string; data: { job_id?: string; mailing_id?: string; tracking_number?: string; delivered_to?: string; delivered_date?: string; returned_date?: string; return_reason?: string; location?: string; details?: string; [key: string]: any } }) {
  const eventType = payload.event;
  const externalJobId = payload.data.job_id || payload.data.mailing_id;

  if (!externalJobId) return { received: true, skipped: true, reason: "No job ID in payload" };

  // Handle batch.completed separately
  if (eventType === "batch.completed") {
    const batchId = externalJobId;
    // Update any MailBatch record if exists
    try {
      await db.mailBatch.updateMany({ where: { id: batchId }, data: { status: "COMPLETED", completedAt: new Date() } });
    } catch { /* batch may not exist locally */ }
    return { received: true, eventType, batchId };
  }

  const job = await db.mailJob.findFirst({ where: { externalJobId } });
  if (!job) return { received: true, skipped: true, reason: `No local job for externalJobId ${externalJobId}` };

  const newStatus = EVENT_STATUS_MAP[eventType];
  const trackingEventType = EVENT_TRACKING_MAP[eventType];

  // Update job status
  const updateData: any = {};
  if (newStatus) updateData.status = newStatus;

  if (eventType === "mailing.delivered") {
    updateData.deliveredDate = payload.data.delivered_date ? new Date(payload.data.delivered_date) : new Date();
    updateData.deliveredTo = payload.data.delivered_to || null;
  }
  if (eventType === "mailing.returned") {
    updateData.returnedDate = payload.data.returned_date ? new Date(payload.data.returned_date) : new Date();
    updateData.returnReason = payload.data.return_reason || "Unknown";
  }
  if (eventType === "mailing.mailed" && payload.data.tracking_number) {
    updateData.trackingNumber = payload.data.tracking_number;
    updateData.mailedDate = new Date();
  }

  if (Object.keys(updateData).length > 0) {
    await db.mailJob.update({ where: { id: job.id }, data: updateData });
  }

  // Create tracking event
  if (trackingEventType) {
    await db.mailTrackingEvent.create({
      data: {
        jobId: job.id,
        eventType: trackingEventType as any,
        eventDate: new Date(),
        location: payload.data.location || null,
        details: payload.data.details || eventType,
        rawData: JSON.stringify(payload),
      },
    });
  }

  return { received: true, jobId: job.id, eventType };
}
