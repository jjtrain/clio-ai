import { db } from "@/lib/db";

const API_BASE = "https://localservices.googleapis.com/v1";
const PROVIDER = "GOOGLE_LSA" as any;

// ─── Config ─────────────────────────────────────────────────────

export async function getConfig() {
  const config = await db.lSAIntegration.findUnique({ where: { provider: PROVIDER } });
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
  const config = await db.lSAIntegration.findUnique({ where: { provider: PROVIDER } });
  if (!config?.refreshToken || !config?.clientId || !config?.clientSecret) return null;
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
  await db.lSAIntegration.update({
    where: { provider: PROVIDER },
    data: { accessToken: data.access_token, tokenExpiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000) },
  });
  return data.access_token;
}

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
  try {
    const token = await getValidToken();
    if (!token) return { ok: false, error: "No valid token" };
    const config = await getConfig();
    const res = await fetch(`${API_BASE}/accounts/${config!.googleAdsCustomerId}`, { headers: authHeaders(token) });
    return res.ok ? { ok: true } : { ok: false, error: `HTTP ${res.status}` };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

// ─── Account ────────────────────────────────────────────────────

export async function getAccount() {
  const token = await getValidToken();
  if (!token) return null;
  const config = await getConfig();
  const res = await fetch(`${API_BASE}/accounts/${config!.googleAdsCustomerId}`, { headers: authHeaders(token) });
  return res.ok ? res.json() : null;
}

// ─── Leads ──────────────────────────────────────────────────────

export async function getLeads(params: { startDate?: string; endDate?: string; pageSize?: number; pageToken?: string } = {}) {
  const token = await getValidToken();
  if (!token) return null;
  const config = await getConfig();
  const qs = new URLSearchParams();
  if (params.startDate) qs.set("startDate", params.startDate);
  if (params.endDate) qs.set("endDate", params.endDate);
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.pageToken) qs.set("pageToken", params.pageToken);
  const res = await fetch(`${API_BASE}/accounts/${config!.googleAdsCustomerId}/leads?${qs}`, { headers: authHeaders(token) });
  return res.ok ? res.json() : null;
}

export async function getLead(leadId: string) {
  const token = await getValidToken();
  if (!token) return null;
  const config = await getConfig();
  const res = await fetch(`${API_BASE}/accounts/${config!.googleAdsCustomerId}/leads/${leadId}`, { headers: authHeaders(token) });
  return res.ok ? res.json() : null;
}

export async function getLeadCallRecording(leadId: string) {
  const lead = await getLead(leadId);
  if (!lead?.callDetails?.callRecordingUrl) return null;
  return { url: lead.callDetails.callRecordingUrl, duration: lead.callDetails.callDurationSeconds };
}

export async function disputeLead(leadId: string, reason: string) {
  const token = await getValidToken();
  if (!token) return null;
  const config = await getConfig();
  const res = await fetch(`${API_BASE}/accounts/${config!.googleAdsCustomerId}/leads/${leadId}:dispute`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ disputeReason: reason }),
  });
  return res.ok ? res.json() : null;
}

export async function archiveLead(leadId: string) {
  const token = await getValidToken();
  if (!token) return null;
  const config = await getConfig();
  const res = await fetch(`${API_BASE}/accounts/${config!.googleAdsCustomerId}/leads/${leadId}`, {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({ leadStatus: "ARCHIVED" }),
  });
  return res.ok ? res.json() : null;
}

export async function replyToMessage(leadId: string, message: string) {
  const token = await getValidToken();
  if (!token) return null;
  const config = await getConfig();
  const res = await fetch(`${API_BASE}/accounts/${config!.googleAdsCustomerId}/leads/${leadId}:reply`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ message }),
  });
  return res.ok ? res.json() : null;
}

// ─── Reviews ────────────────────────────────────────────────────

export async function getReviews(params: { pageSize?: number; pageToken?: string } = {}) {
  const token = await getValidToken();
  if (!token) return null;
  const config = await getConfig();
  const qs = new URLSearchParams();
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.pageToken) qs.set("pageToken", params.pageToken);
  const res = await fetch(`${API_BASE}/accounts/${config!.googleAdsCustomerId}/reviews?${qs}`, { headers: authHeaders(token) });
  return res.ok ? res.json() : null;
}

export async function replyToReview(reviewId: string, reply: string) {
  const token = await getValidToken();
  if (!token) return null;
  const config = await getConfig();
  const res = await fetch(`${API_BASE}/accounts/${config!.googleAdsCustomerId}/reviews/${reviewId}:reply`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ comment: reply }),
  });
  return res.ok ? res.json() : null;
}

// ─── Performance & Budget ───────────────────────────────────────

export async function getPerformanceReport(startDate: string, endDate: string) {
  const leads = await getLeads({ startDate, endDate, pageSize: 1000 });
  if (!leads?.leads) return { totalLeads: 0, totalSpend: 0, charged: 0, disputed: 0 };
  const items = leads.leads as any[];
  return {
    totalLeads: items.length,
    totalSpend: items.reduce((s: number, l: any) => s + (l.chargeCost?.amount || 0), 0),
    charged: items.filter((l: any) => l.chargeStatus === "CHARGED").length,
    disputed: items.filter((l: any) => l.chargeStatus === "DISPUTED").length,
  };
}

export async function getBudget() {
  const config = await getConfig();
  if (!config) return null;
  return { weeklyBudget: config.weeklyBudget, monthlyBudgetCap: config.monthlyBudgetCap };
}

export async function updateBudget(weeklyBudget?: number, monthlyBudgetCap?: number) {
  const data: any = {};
  if (weeklyBudget !== undefined) data.weeklyBudget = weeklyBudget;
  if (monthlyBudgetCap !== undefined) data.monthlyBudgetCap = monthlyBudgetCap;
  return db.lSAIntegration.update({ where: { provider: PROVIDER }, data });
}

// ─── Categories ─────────────────────────────────────────────────

export async function getCategories() {
  const config = await getConfig();
  if (!config?.businessCategories) return [];
  try { return JSON.parse(config.businessCategories); } catch { return []; }
}

export async function toggleCategory(_categoryId: string, _enabled: boolean) {
  // Stub: category toggling requires Google Ads API
  return { success: true, message: "Category toggle not yet implemented via API" };
}

// ─── Competitor Insights ────────────────────────────────────────

export async function getCompetitorInsights() {
  // Stub: competitor data not available through LSA API directly
  return { available: false, message: "Competitor insights require manual configuration" };
}

// ─── Webhook Processing ─────────────────────────────────────────

export async function processWebhook(eventType: string, payload: any) {
  if (eventType === "lead.created" || eventType === "lead.updated" || eventType === "lead.charged" || eventType === "lead.disputed") {
    const lead = await db.lSALead.upsert({
      where: { id: payload.id || payload.externalLeadId || "unknown" },
      create: {
        externalLeadId: payload.externalLeadId || payload.leadId || "",
        leadType: (payload.leadType || "PHONE") as any,
        status: (payload.status || "NEW") as any,
        chargeStatus: (payload.chargeStatus || "PENDING") as any,
        consumerName: payload.consumerName,
        consumerPhone: payload.consumerPhone,
        consumerEmail: payload.consumerEmail,
        consumerCity: payload.consumerCity,
        consumerZip: payload.consumerZip,
        categoryName: payload.categoryName,
        serviceName: payload.serviceName,
        callDuration: payload.callDuration,
        callRecordingUrl: payload.callRecordingUrl,
        messageText: payload.messageText,
        bookingDate: payload.bookingDate ? new Date(payload.bookingDate) : null,
        bookingNotes: payload.bookingNotes,
        leadCost: payload.leadCost,
        geoLocation: payload.geoLocation,
        leadCreatedAt: payload.leadCreatedAt ? new Date(payload.leadCreatedAt) : new Date(),
        rawPayload: JSON.stringify(payload),
      },
      update: {
        status: payload.status ? (payload.status as any) : undefined,
        chargeStatus: payload.chargeStatus ? (payload.chargeStatus as any) : undefined,
        leadCost: payload.leadCost,
        disputeReason: payload.disputeReason,
        disputeDate: payload.disputeDate ? new Date(payload.disputeDate) : undefined,
        disputeResolution: payload.disputeResolution,
        rawPayload: JSON.stringify(payload),
      },
    });
    return { received: true, leadId: lead.id, eventType };
  }

  if (eventType === "review.created") {
    const review = await db.lSAReview.create({
      data: {
        externalReviewId: payload.externalReviewId || payload.reviewId,
        reviewerName: payload.reviewerName,
        rating: payload.rating || 0,
        reviewText: payload.reviewText,
        reviewDate: payload.reviewDate ? new Date(payload.reviewDate) : new Date(),
        source: "google_lsa",
      },
    });
    return { received: true, reviewId: review.id, eventType };
  }

  return { received: true, eventType, handled: false };
}
