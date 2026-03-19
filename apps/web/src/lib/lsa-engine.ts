import { db } from "@/lib/db";
import * as googleLsa from "@/lib/integrations/google-lsa";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const API_URL = "https://api.anthropic.com/v1/messages";

async function callAI(systemPrompt: string, userMessage: string, maxTokens = 1500): Promise<string> {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: maxTokens, system: systemPrompt, messages: [{ role: "user", content: userMessage }] }),
  });
  if (!res.ok) throw new Error(`AI API error: ${await res.text()}`);
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

function parseJson(text: string): any {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in AI response");
  return JSON.parse(match[0]);
}

// ─── Lead Processing ────────────────────────────────────────────

export async function processNewLead(externalLead: any) {
  const lead = await db.lSALead.create({
    data: {
      externalLeadId: externalLead.externalLeadId || externalLead.id || "",
      leadType: (externalLead.leadType || "PHONE_CALL") as any,
      status: "NEW" as any,
      chargeStatus: "PENDING" as any,
      consumerName: externalLead.consumerName,
      consumerPhone: externalLead.consumerPhone,
      consumerEmail: externalLead.consumerEmail,
      consumerCity: externalLead.consumerCity,
      consumerZip: externalLead.consumerZip,
      categoryName: externalLead.categoryName,
      serviceName: externalLead.serviceName,
      callDuration: externalLead.callDuration,
      messageText: externalLead.messageText,
      leadCost: externalLead.leadCost,
      leadCreatedAt: externalLead.leadCreatedAt ? new Date(externalLead.leadCreatedAt) : new Date(),
      rawPayload: JSON.stringify(externalLead),
    },
  });
  const analysis = await analyzeLeadQuality(lead.id);
  const config = await googleLsa.getConfig();
  if (config?.autoCreateLead) {
    await db.lead.create({
      data: {
        name: externalLead.consumerName || "LSA Lead",
        email: externalLead.consumerEmail,
        phone: externalLead.consumerPhone,
        source: "OTHER" as any,
        status: "NEW" as any,
        practiceArea: externalLead.categoryName,
        notes: `LSA Lead (${externalLead.leadType}). AI Score: ${analysis?.score || "N/A"}`,
      },
    });
  }
  return lead;
}

export async function processCallRecording(leadId: string) {
  const lead = await db.lSALead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  return { leadId, callRecordingUrl: lead.callRecordingUrl, callDuration: lead.callDuration, transcript: lead.callTranscript };
}

export async function analyzeLeadQuality(leadId: string) {
  const lead = await db.lSALead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  const prompt = `Analyze this LSA lead quality. Return JSON: {score (0-100), summary, recommendation}`;
  const msg = `Lead type: ${lead.leadType}, Category: ${lead.categoryName}, Service: ${lead.serviceName}, Consumer: ${lead.consumerName}, City: ${lead.consumerCity}, Call duration: ${lead.callDuration}s, Message: ${lead.messageText || "N/A"}`;
  try {
    const result = parseJson(await callAI(prompt, msg));
    await db.lSALead.update({ where: { id: leadId }, data: { aiQualityScore: result.score, aiSummary: result.summary, aiRecommendation: result.recommendation } });
    return result;
  } catch { return null; }
}

export async function suggestAutoReply(leadId: string) {
  const lead = await db.lSALead.findUnique({ where: { id: leadId } });
  if (!lead || lead.leadType !== "MESSAGE") return null;
  const prompt = `You are a law firm assistant. Generate a professional, brief reply to this potential client message. Return JSON: {reply, tone}`;
  const msg = `Client: ${lead.consumerName}, Category: ${lead.categoryName}, Message: ${lead.messageText}`;
  try { return parseJson(await callAI(prompt, msg)); } catch { return null; }
}

// ─── Dispute Management ─────────────────────────────────────────

export async function disputeInvalidLead(leadId: string, reason: string) {
  const lead = await db.lSALead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  await googleLsa.disputeLead(lead.externalLeadId, reason);
  return db.lSALead.update({
    where: { id: leadId },
    data: { chargeStatus: "DISPUTED" as any, disputeReason: reason, disputeDate: new Date() },
  });
}

export async function assessDisputeEligibility(leadId: string) {
  const lead = await db.lSALead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  const shortCall = lead.leadType === "PHONE_CALL" && (lead.callDuration || 0) < 30;
  const existingClient = lead.consumerPhone
    ? await db.client.findFirst({ where: { phone: lead.consumerPhone } })
    : null;
  return {
    eligible: shortCall || !!existingClient,
    reasons: [
      ...(shortCall ? ["Call duration under 30 seconds"] : []),
      ...(existingClient ? [`Already existing client: ${existingClient.name}`] : []),
    ],
  };
}

// ─── Conversion ─────────────────────────────────────────────────

export async function convertLeadToClient(leadId: string, params: { practiceArea?: string; matterName?: string; value?: number }) {
  const lead = await db.lSALead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  const client = await db.client.create({
    data: { name: lead.consumerName || "LSA Client", email: lead.consumerEmail, phone: lead.consumerPhone },
  });
  const lastMatter = await db.matter.findFirst({ orderBy: { matterNumber: "desc" } });
  const mNum = lastMatter ? parseInt(lastMatter.matterNumber.replace("M-", "")) + 1 : 1;
  const matter = await db.matter.create({
    data: {
      name: params.matterName || `${lead.categoryName || "LSA"} - ${client.name}`,
      matterNumber: `M-${mNum.toString().padStart(4, "0")}`,
      clientId: client.id,
      practiceArea: params.practiceArea || lead.categoryName,
      status: "OPEN" as any,
    },
  });
  await db.lSALead.update({
    where: { id: leadId },
    data: { status: "CONVERTED" as any, conversionDate: new Date(), conversionValue: params.value, matterId: matter.id, clientId: client.id },
  });
  return { client, matter, lead };
}

// ─── Analytics ──────────────────────────────────────────────────

export async function calculateROI(dateRange: { start: Date; end: Date }) {
  const leads = await db.lSALead.findMany({ where: { leadCreatedAt: { gte: dateRange.start, lte: dateRange.end } } });
  const totalSpend = leads.reduce((s, l) => s + Number(l.leadCost || 0), 0);
  const conversions = leads.filter(l => l.conversionDate);
  const totalValue = conversions.reduce((s, l) => s + Number(l.conversionValue || 0), 0);
  return { totalLeads: leads.length, totalSpend, conversions: conversions.length, totalValue, roi: totalSpend > 0 ? ((totalValue - totalSpend) / totalSpend) * 100 : 0 };
}

export async function getResponseTimeAnalysis(dateRange: { start: Date; end: Date }) {
  const leads = await db.lSALead.findMany({
    where: { leadCreatedAt: { gte: dateRange.start, lte: dateRange.end }, responseTimeSeconds: { not: null } },
  });
  if (!leads.length) return { count: 0, avgSeconds: 0, medianSeconds: 0, under5Min: 0 };
  const times = leads.map(l => l.responseTimeSeconds!).sort((a, b) => a - b);
  return {
    count: times.length,
    avgSeconds: Math.round(times.reduce((a, b) => a + b, 0) / times.length),
    medianSeconds: times[Math.floor(times.length / 2)],
    under5Min: times.filter(t => t < 300).length,
  };
}

export async function optimizeBudget(dateRange: { start: Date; end: Date }) {
  const roi = await calculateROI(dateRange);
  const budget = await googleLsa.getBudget();
  const prompt = `You are an LSA budget optimizer. Return JSON: {recommendedWeeklyBudget, reasoning, expectedROI}`;
  const msg = `Current weekly budget: $${budget?.weeklyBudget || 0}, Total spend: $${roi.totalSpend}, Leads: ${roi.totalLeads}, Conversions: ${roi.conversions}, ROI: ${roi.roi.toFixed(1)}%`;
  try { return parseJson(await callAI(prompt, msg)); } catch { return null; }
}

export async function generateLeadReport(dateRange: { start: Date; end: Date }) {
  const [roi, response] = await Promise.all([calculateROI(dateRange), getResponseTimeAnalysis(dateRange)]);
  const leads = await db.lSALead.findMany({ where: { leadCreatedAt: { gte: dateRange.start, lte: dateRange.end } } });
  const byType = { phone: leads.filter(l => l.leadType === "PHONE_CALL").length, message: leads.filter(l => l.leadType === "MESSAGE").length, booking: leads.filter(l => l.leadType === "BOOKING").length };
  const prompt = `Summarize this LSA performance report for a law firm. Return JSON: {summary, highlights, concerns, recommendations}`;
  const msg = JSON.stringify({ roi, response, byType, totalLeads: leads.length });
  let aiSummary = null;
  try { aiSummary = parseJson(await callAI(prompt, msg)); } catch {}
  return { roi, responseTime: response, byType, totalLeads: leads.length, aiSummary };
}

// ─── Reviews ────────────────────────────────────────────────────

export async function generateReviewReply(reviewId: string) {
  const review = await db.lSAReview.findUnique({ where: { id: reviewId } });
  if (!review) return null;
  const tone = review.rating >= 4 ? "grateful and professional" : review.rating >= 3 ? "appreciative and constructive" : "empathetic and solution-oriented";
  const prompt = `Generate a ${tone} reply to this review for a law firm. Return JSON: {reply}`;
  const msg = `Rating: ${review.rating}/5, Review: ${review.reviewText || "(no text)"}`;
  try {
    const result = parseJson(await callAI(prompt, msg));
    await db.lSAReview.update({ where: { id: reviewId }, data: { aiSuggestedReply: result.reply } });
    return result;
  } catch { return null; }
}

// ─── Snapshots & Status ─────────────────────────────────────────

export async function snapshotPerformance(period: string) {
  const now = new Date();
  const start = period === "weekly" ? new Date(now.getTime() - 7 * 86400000) : new Date(now.getFullYear(), now.getMonth(), 1);
  const leads = await db.lSALead.findMany({ where: { leadCreatedAt: { gte: start, lte: now } } });
  const totalSpend = leads.reduce((s, l) => s + Number(l.leadCost || 0), 0);
  const conversions = leads.filter(l => l.conversionDate);
  const totalValue = conversions.reduce((s, l) => s + Number(l.conversionValue || 0), 0);
  return db.lSAPerformanceSnapshot.create({
    data: {
      snapshotDate: now,
      period,
      totalLeads: leads.length,
      phoneLeads: leads.filter(l => l.leadType === "PHONE_CALL").length,
      messageLeads: leads.filter(l => l.leadType === "MESSAGE").length,
      bookingLeads: leads.filter(l => l.leadType === "BOOKING").length,
      chargedLeads: leads.filter(l => l.chargeStatus === "CHARGED").length,
      disputedLeads: leads.filter(l => l.chargeStatus === "DISPUTED").length,
      totalSpend: totalSpend,
      averageCostPerLead: leads.length > 0 ? totalSpend / leads.length : null,
      conversionCount: conversions.length,
      conversionRate: leads.length > 0 ? (conversions.length / leads.length) * 100 : null,
      totalConversionValue: totalValue,
      costPerConversion: conversions.length > 0 ? totalSpend / conversions.length : null,
      roi: totalSpend > 0 ? ((totalValue - totalSpend) / totalSpend) * 100 : null,
    },
  });
}

export async function checkBadgeStatus() {
  const config = await googleLsa.getConfig();
  if (!config) return null;
  return { badgeStatus: config.badgeStatus, badgeExpiresAt: config.badgeExpiresAt, businessName: config.businessName };
}

export async function matchLeadToExistingClient(leadId: string) {
  const lead = await db.lSALead.findUnique({ where: { id: leadId } });
  if (!lead) return null;
  const matches = await db.client.findMany({
    where: {
      OR: [
        ...(lead.consumerPhone ? [{ phone: lead.consumerPhone }] : []),
        ...(lead.consumerEmail ? [{ email: lead.consumerEmail }] : []),
      ],
    },
  });
  return { leadId, matches, isExistingClient: matches.length > 0 };
}
