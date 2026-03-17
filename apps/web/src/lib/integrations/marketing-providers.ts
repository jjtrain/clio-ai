import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";
import crypto from "crypto";

async function getMktConfig(provider: string) {
  const c = await db.marketingIntegration.findUnique({ where: { provider } });
  if (!c?.isEnabled || !c?.apiKey) return null;
  return c;
}
function notConfigured(p: string) { return { success: false, error: `${p} is not configured.`, provider: p }; }

// ─── Mailchimp ───────────────────────────────────────────────────
export async function mailchimpTestConnection() {
  const c = await getMktConfig("MAILCHIMP");
  if (!c) return notConfigured("Mailchimp");
  const dc = c.dataCenter || "us21";
  const auth = Buffer.from(`anystring:${c.apiKey}`).toString("base64");
  try {
    const res = await makeApiCall(`https://${dc}.api.mailchimp.com/3.0/ping`, { headers: { Authorization: `Basic ${auth}` } });
    return res.ok ? { success: true, provider: "MAILCHIMP" } : { success: false, error: `Mailchimp returned ${res.status}`, provider: "MAILCHIMP" };
  } catch (err: any) { return { success: false, error: err.message, provider: "MAILCHIMP" }; }
}
export async function mailchimpGetLists() {
  const c = await getMktConfig("MAILCHIMP");
  if (!c) return notConfigured("Mailchimp");
  const dc = c.dataCenter || "us21";
  const auth = Buffer.from(`anystring:${c.apiKey}`).toString("base64");
  try {
    const res = await makeApiCall(`https://${dc}.api.mailchimp.com/3.0/lists?count=50`, { headers: { Authorization: `Basic ${auth}` } });
    return res.ok ? { success: true, data: await res.json(), provider: "MAILCHIMP" } : { success: false, error: `Failed: ${res.status}`, provider: "MAILCHIMP" };
  } catch (err: any) { return { success: false, error: err.message, provider: "MAILCHIMP" }; }
}
export async function mailchimpGetCampaigns() {
  const c = await getMktConfig("MAILCHIMP");
  if (!c) return notConfigured("Mailchimp");
  const dc = c.dataCenter || "us21";
  const auth = Buffer.from(`anystring:${c.apiKey}`).toString("base64");
  try {
    const res = await makeApiCall(`https://${dc}.api.mailchimp.com/3.0/campaigns?count=50&sort_field=send_time&sort_dir=DESC`, { headers: { Authorization: `Basic ${auth}` } });
    return res.ok ? { success: true, data: await res.json(), provider: "MAILCHIMP" } : { success: false, error: `Failed: ${res.status}`, provider: "MAILCHIMP" };
  } catch (err: any) { return { success: false, error: err.message, provider: "MAILCHIMP" }; }
}
export async function mailchimpAddMember(listId: string, params: { email: string; firstName?: string; lastName?: string; status?: string }) {
  const c = await getMktConfig("MAILCHIMP");
  if (!c) return notConfigured("Mailchimp");
  const dc = c.dataCenter || "us21";
  const auth = Buffer.from(`anystring:${c.apiKey}`).toString("base64");
  const hash = crypto.createHash("md5").update(params.email.toLowerCase()).digest("hex");
  try {
    const res = await makeApiCall(`https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members/${hash}`, {
      method: "PUT", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email_address: params.email, status_if_new: params.status || "subscribed", merge_fields: { FNAME: params.firstName || "", LNAME: params.lastName || "" } }),
    });
    return { success: res.ok, provider: "MAILCHIMP" };
  } catch (err: any) { return { success: false, error: err.message, provider: "MAILCHIMP" }; }
}

// ─── Constant Contact ────────────────────────────────────────────
export async function constantContactTestConnection() {
  const c = await getMktConfig("CONSTANT_CONTACT");
  if (!c) return notConfigured("Constant Contact");
  const token = c.accessToken || c.apiKey;
  try {
    const res = await makeApiCall("https://api.cc.email/v3/account/summary", { headers: { Authorization: `Bearer ${token}` } });
    return res.ok ? { success: true, provider: "CONSTANT_CONTACT" } : { success: false, error: `Failed: ${res.status}`, provider: "CONSTANT_CONTACT" };
  } catch (err: any) { return { success: false, error: err.message, provider: "CONSTANT_CONTACT" }; }
}

// ─── Robly ───────────────────────────────────────────────────────
export async function roblyTestConnection() {
  const c = await getMktConfig("ROBLY");
  if (!c) return notConfigured("Robly");
  try {
    const res = await makeApiCall(`https://api.robly.com/api/v1/lists?api_id=${c.accountId}&api_key=${c.apiKey}`);
    return res.ok ? { success: true, provider: "ROBLY" } : { success: false, error: `Failed: ${res.status}`, provider: "ROBLY" };
  } catch (err: any) { return { success: false, error: err.message, provider: "ROBLY" }; }
}

// ─── BirdEye ─────────────────────────────────────────────────────
export async function birdeyeTestConnection() {
  const c = await getMktConfig("BIRDEYE");
  if (!c) return notConfigured("BirdEye");
  try {
    const res = await makeApiCall(`https://api.birdeye.com/resources/v1/business/${c.businessId}`, { headers: { Authorization: `Bearer ${c.apiKey}` } });
    return res.ok ? { success: true, data: await res.json(), provider: "BIRDEYE" } : { success: false, error: `Failed: ${res.status}`, provider: "BIRDEYE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "BIRDEYE" }; }
}
export async function birdeyeGetReviews(params?: { page?: number }) {
  const c = await getMktConfig("BIRDEYE");
  if (!c) return notConfigured("BirdEye");
  try {
    const res = await makeApiCall(`https://api.birdeye.com/resources/v1/review/businessId/${c.businessId}?count=20&page=${params?.page || 1}`, { headers: { Authorization: `Bearer ${c.apiKey}` } });
    return res.ok ? { success: true, data: await res.json(), provider: "BIRDEYE" } : { success: false, error: `Failed: ${res.status}`, provider: "BIRDEYE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "BIRDEYE" }; }
}
export async function birdeyeSendReviewRequest(params: { customerName: string; email?: string; phone?: string; platform: string }) {
  const c = await getMktConfig("BIRDEYE");
  if (!c) return notConfigured("BirdEye");
  try {
    const res = await makeApiCall(`https://api.birdeye.com/resources/v1/review/request`, { method: "POST", headers: { Authorization: `Bearer ${c.apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...params, businessId: c.businessId }) });
    return { success: res.ok, provider: "BIRDEYE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "BIRDEYE" }; }
}

// ─── Repsight ────────────────────────────────────────────────────
export async function repsightTestConnection() {
  const c = await getMktConfig("REPSIGHT");
  if (!c) return notConfigured("Repsight");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.repsight.com/v1"}/account`, { headers: { Authorization: `Bearer ${c.apiKey}` } });
    return res.ok ? { success: true, provider: "REPSIGHT" } : { success: false, error: `Failed: ${res.status}`, provider: "REPSIGHT" };
  } catch (err: any) { return { success: false, error: err.message, provider: "REPSIGHT" }; }
}

// ─── Scorpion ────────────────────────────────────────────────────
export async function scorpionTestConnection() {
  const c = await getMktConfig("SCORPION");
  if (!c) return notConfigured("Scorpion");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.scorpion.co/v1"}/account`, { headers: { Authorization: `Bearer ${c.apiKey}` } });
    return res.ok ? { success: true, data: await res.json(), provider: "SCORPION" } : { success: false, error: `Failed: ${res.status}`, provider: "SCORPION" };
  } catch (err: any) { return { success: false, error: err.message, provider: "SCORPION" }; }
}
export async function scorpionGetROI(dateRange?: { from: string; to: string }) {
  const c = await getMktConfig("SCORPION");
  if (!c) return notConfigured("Scorpion");
  try {
    const qs = dateRange ? `?from=${dateRange.from}&to=${dateRange.to}` : "";
    const res = await makeApiCall(`${c.baseUrl || "https://api.scorpion.co/v1"}/dashboard/roi${qs}`, { headers: { Authorization: `Bearer ${c.apiKey}` } });
    return res.ok ? { success: true, data: await res.json(), provider: "SCORPION" } : { success: false, error: `Failed: ${res.status}`, provider: "SCORPION" };
  } catch (err: any) { return { success: false, error: err.message, provider: "SCORPION" }; }
}
