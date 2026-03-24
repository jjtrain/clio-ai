import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";
import crypto from "crypto";

// ==========================================
// TYPES
// ==========================================

const SCORE_LABELS: Record<string, Record<number, string>> = {
  scale_1_5: { 1: "Very Dissatisfied", 2: "Dissatisfied", 3: "Neutral", 4: "Satisfied", 5: "Very Satisfied" },
  nps_0_10: { 0: "Detractor", 1: "Detractor", 2: "Detractor", 3: "Detractor", 4: "Detractor", 5: "Detractor", 6: "Detractor", 7: "Passive", 8: "Passive", 9: "Promoter", 10: "Promoter" },
  thumbs: { 0: "Thumbs Down", 1: "Thumbs Up" },
  emoji_5: { 1: "Very Unhappy", 2: "Unhappy", 3: "Neutral", 4: "Happy", 5: "Very Happy" },
};

// ==========================================
// SURVEY GENERATION FROM TRIGGER
// ==========================================

export async function triggerPulseSurvey(params: {
  matterId: string;
  portalAccountId?: string;
  triggerMilestone: string;
  firmId: string;
  userId: string;
}): Promise<void> {
  const { matterId, portalAccountId, triggerMilestone, firmId, userId } = params;

  // Find matching triggers
  const triggers = await db.pulseTrigger.findMany({
    where: { isActive: true, OR: [{ firmId }, { firmId: null }] },
  });

  const matter = await db.matter.findUnique({
    where: { id: matterId },
    include: { client: { select: { name: true, email: true } } },
  });
  if (!matter) return;

  for (const trigger of triggers) {
    const condition = trigger.triggerCondition as any;
    if (condition.milestone && condition.milestone !== triggerMilestone) continue;
    if (trigger.practiceArea && matter.practiceArea?.toLowerCase() !== trigger.practiceArea.toLowerCase()) continue;

    // Check cooldown - don't send surveys too frequently
    const recentSurvey = await db.pulseSurvey.findFirst({
      where: { matterId, firmId, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    });
    if (recentSurvey) continue;

    // Find template
    const template = trigger.templateId
      ? await db.pulseTemplate.findUnique({ where: { id: trigger.templateId } })
      : await db.pulseTemplate.findFirst({
          where: { triggerMilestone, isActive: true, OR: [{ firmId }, { firmId: null }] },
        });

    if (!template) continue;

    // Get portal account if not provided
    let accountId = portalAccountId;
    if (!accountId) {
      const access = await db.portalMatterAccess.findFirst({
        where: { matterId, isActive: true },
      });
      accountId = access?.portalUserId;
    }

    let clientEmail = matter.client?.email;
    let clientName = matter.client?.name;

    if (accountId) {
      const portalUser = await db.clientPortalUser.findUnique({ where: { id: accountId } });
      if (portalUser) {
        clientEmail = portalUser.email;
        clientName = portalUser.name;
      }
    }

    // Create survey
    const tokenExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
    const deliverAt = template.deliveryDelay > 0
      ? new Date(Date.now() + template.deliveryDelay * 60 * 60 * 1000)
      : new Date();

    const question = template.question
      .replace(/\{\{firstName\}\}/g, clientName?.split(" ")[0] || "there")
      .replace(/\{\{milestone\}\}/g, triggerMilestone.replace(/_/g, " "));

    await db.pulseSurvey.create({
      data: {
        templateId: template.id,
        triggerId: trigger.id,
        matterId,
        portalAccountId: accountId,
        clientName,
        clientEmail,
        practiceArea: matter.practiceArea,
        triggerMilestone,
        question,
        questionType: template.questionType,
        followUpQuestion: template.followUpQuestion,
        responseToken: crypto.randomBytes(32).toString("hex"),
        tokenExpiry,
        deliveryChannels: ["portal", "email"],
        status: template.deliveryDelay > 0 ? "pending" : "delivered",
        deliveredAt: template.deliveryDelay > 0 ? null : new Date(),
        userId,
        firmId,
      },
    });
  }
}

// ==========================================
// RESPONSE PROCESSING
// ==========================================

export async function recordResponse(
  token: string,
  score: number,
  followUpResponse?: string
): Promise<{ success: boolean; survey?: any }> {
  const survey = await db.pulseSurvey.findUnique({ where: { responseToken: token } });
  if (!survey) return { success: false };
  if (survey.tokenExpiry < new Date()) return { success: false };
  if (survey.respondedAt) return { success: false }; // already responded

  const labels = SCORE_LABELS[survey.questionType] || {};
  const responseLabel = labels[score] || String(score);

  const updated = await db.pulseSurvey.update({
    where: { id: survey.id },
    data: {
      score,
      responseLabel,
      followUpResponse,
      respondedAt: new Date(),
      status: "responded",
    },
  });

  // Process response actions
  await processResponseActions(updated);

  return { success: true, survey: updated };
}

async function processResponseActions(survey: any): Promise<void> {
  const isLowScore =
    (survey.questionType === "scale_1_5" && survey.score <= 2) ||
    (survey.questionType === "nps_0_10" && survey.score <= 4) ||
    (survey.questionType === "emoji_5" && survey.score <= 2) ||
    (survey.questionType === "thumbs" && survey.score === 0);

  const isHighScore =
    (survey.questionType === "scale_1_5" && survey.score >= 4) ||
    (survey.questionType === "nps_0_10" && survey.score >= 9) ||
    (survey.questionType === "emoji_5" && survey.score >= 4) ||
    (survey.questionType === "thumbs" && survey.score === 1);

  if (isLowScore && survey.matterId) {
    // Create urgent action for attorney
    try {
      await db.matterAction.create({
        data: {
          matterId: survey.matterId,
          title: `Address low satisfaction — client rated ${survey.score}/${survey.questionType === "nps_0_10" ? 10 : 5}`,
          description: `${survey.clientName || "Client"} gave a low satisfaction score after ${survey.triggerMilestone?.replace(/_/g, " ") || "recent milestone"}. ${survey.followUpResponse ? `Their feedback: "${survey.followUpResponse}"` : "No additional feedback provided."} Follow up immediately to address concerns.`,
          actionType: "client_communication",
          urgency: "immediate",
          priority: 9,
          source: "rule",
          triggerEvent: "low_pulse_score",
          suggestedFeature: "correspondence",
          estimatedTime: "15-30 minutes",
          userId: survey.userId,
          firmId: survey.firmId,
        },
      });
    } catch {}
  }

  if (isHighScore && survey.followUpResponse && survey.followUpResponse.length > 50) {
    // Flag potential testimonial
    try {
      await db.matterActivityLog.create({
        data: {
          matterId: survey.matterId || "unknown",
          activityType: "note_added",
          description: `Positive pulse feedback (${survey.score}/${survey.questionType === "nps_0_10" ? 10 : 5}): "${survey.followUpResponse}" — potential testimonial candidate`,
          firmId: survey.firmId,
        },
      });
    } catch {}
  }
}

// ==========================================
// NPS CALCULATION
// ==========================================

export function calculateNPS(responses: Array<{ score: number; questionType: string }>): {
  npsScore: number;
  promoters: number;
  passives: number;
  detractors: number;
  total: number;
} {
  const npsResponses = responses.filter((r) => r.questionType === "nps_0_10");
  if (npsResponses.length === 0) return { npsScore: 0, promoters: 0, passives: 0, detractors: 0, total: 0 };

  let promoters = 0, passives = 0, detractors = 0;
  for (const r of npsResponses) {
    if (r.score >= 9) promoters++;
    else if (r.score >= 7) passives++;
    else detractors++;
  }

  const total = npsResponses.length;
  const npsScore = Math.round(((promoters / total) - (detractors / total)) * 100);

  return { npsScore, promoters, passives, detractors, total };
}

// ==========================================
// THEME EXTRACTION
// ==========================================

export async function extractThemes(responses: Array<{ followUpResponse: string }>): Promise<Array<{ theme: string; count: number; sentiment: string; sampleQuotes: string[] }>> {
  const texts = responses.filter((r) => r.followUpResponse && r.followUpResponse.length > 10).map((r) => r.followUpResponse);
  if (texts.length < 3) return [];

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: "Analyze these client feedback responses from a law firm. Extract 3-5 recurring themes with sentiment (positive/negative/mixed) and sample quotes. Return JSON array: [{ theme, count, sentiment, sampleQuotes: string[] }]",
      messages: [{ role: "user", content: texts.join("\n---\n") }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "[]";
    return JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || "[]");
  } catch {
    return [];
  }
}

// ==========================================
// AGGREGATION
// ==========================================

export async function calculateAggregations(firmId: string, period: string, periodType: string): Promise<void> {
  const responses = await db.pulseSurvey.findMany({
    where: { firmId, status: "responded" },
  });

  if (responses.length === 0) return;

  const totalSurveys = await db.pulseSurvey.count({ where: { firmId } });
  const totalResponses = responses.length;
  const responseRate = totalSurveys > 0 ? totalResponses / totalSurveys : 0;

  const scores = responses.filter((r) => r.score !== null).map((r) => r.score!);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const sorted = [...scores].sort((a, b) => a - b);
  const medianScore = sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0;

  const nps = calculateNPS(responses.filter((r) => r.score !== null).map((r) => ({ score: r.score!, questionType: r.questionType })));

  const distribution: Record<string, number> = {};
  for (const s of scores) { distribution[String(s)] = (distribution[String(s)] || 0) + 1; }

  await db.pulseAggregation.upsert({
    where: { period_periodType_scope_scopeValue_firmId: { period, periodType, scope: "firm", scopeValue: "", firmId } },
    create: {
      period, periodType, scope: "firm", scopeValue: "",
      totalSurveys, totalResponses, responseRate, avgScore, medianScore,
      npsScore: nps.npsScore, promoters: nps.promoters, passives: nps.passives, detractors: nps.detractors,
      scoreDistribution: distribution,
      firmId,
    },
    update: {
      totalSurveys, totalResponses, responseRate, avgScore, medianScore,
      npsScore: nps.npsScore, promoters: nps.promoters, passives: nps.passives, detractors: nps.detractors,
      scoreDistribution: distribution,
    },
  });
}

// ==========================================
// SCHEDULED PROCESSING
// ==========================================

export async function processScheduledSurveys(firmId: string): Promise<{ delivered: number; reminded: number; expired: number }> {
  const now = new Date();
  let delivered = 0, reminded = 0, expired = 0;

  // Deliver pending surveys whose delay has passed
  const pending = await db.pulseSurvey.findMany({
    where: { firmId, status: "pending", createdAt: { lte: now } },
  });
  for (const survey of pending) {
    await db.pulseSurvey.update({
      where: { id: survey.id },
      data: { status: "delivered", deliveredAt: now },
    });
    delivered++;
  }

  // Expire old surveys
  const expiredSurveys = await db.pulseSurvey.updateMany({
    where: { firmId, status: { in: ["pending", "delivered"] }, tokenExpiry: { lt: now } },
    data: { status: "expired" },
  });
  expired = expiredSurveys.count;

  // Send reminders
  const templates = await db.pulseTemplate.findMany({
    where: { reminderAfterHours: { not: null }, OR: [{ firmId }, { firmId: null }] },
  });

  for (const template of templates) {
    if (!template.reminderAfterHours) continue;

    const reminderCutoff = new Date(now.getTime() - template.reminderAfterHours * 60 * 60 * 1000);
    const needReminder = await db.pulseSurvey.findMany({
      where: {
        templateId: template.id,
        status: "delivered",
        respondedAt: null,
        deliveredAt: { lte: reminderCutoff },
        reminderCount: { lt: template.maxReminders },
      },
    });

    for (const survey of needReminder) {
      await db.pulseSurvey.update({
        where: { id: survey.id },
        data: { reminderCount: { increment: 1 }, lastReminderAt: now },
      });
      reminded++;
    }
  }

  return { delivered, reminded, expired };
}
