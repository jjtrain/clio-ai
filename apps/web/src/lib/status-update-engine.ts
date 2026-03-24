import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

// ==========================================
// TYPES
// ==========================================

export interface GeneratedUpdate {
  title: string;
  body: string;
  milestone?: string;
  phase?: string;
  phasePercentage?: number;
  clientActionRequired?: boolean;
  clientActionText?: string;
  tone?: string;
}

export interface TriggerEvent {
  eventType: string;
  matterId: string;
  eventData: Record<string, any>;
}

// ==========================================
// MAIN EVENT HANDLER
// ==========================================

export async function onMatterEvent(event: TriggerEvent, firmId: string, userId: string): Promise<void> {
  // Find matching triggers
  const triggers = await db.statusUpdateTrigger.findMany({
    where: {
      isActive: true,
      triggerSource: event.eventType,
      OR: [{ firmId }, { firmId: null }],
    },
  });

  const matter = await db.matter.findUnique({
    where: { id: event.matterId },
    include: { client: { select: { name: true } } },
  });
  if (!matter) return;

  for (const trigger of triggers) {
    // Check practice area filter
    if (trigger.practiceArea && matter.practiceArea?.toLowerCase() !== trigger.practiceArea.toLowerCase()) continue;

    // Check cooldown
    const cooldownCutoff = new Date(Date.now() - trigger.cooldownHours * 60 * 60 * 1000);
    const recentUpdate = await db.statusUpdateQueue.findFirst({
      where: {
        matterId: event.matterId,
        triggerSource: event.eventType,
        createdAt: { gte: cooldownCutoff },
        status: { not: "rejected" },
      },
    });
    if (recentUpdate) continue;

    // Check trigger condition match
    if (!matchesTriggerCondition(trigger.triggerCondition as any, event)) continue;

    // Generate the update
    const update = await generateUpdate(event, matter, trigger, firmId);

    // Queue it
    await db.statusUpdateQueue.create({
      data: {
        matterId: event.matterId,
        triggerId: trigger.id,
        templateId: trigger.templateId,
        triggerSource: event.eventType,
        triggerData: event.eventData as any,
        title: update.title,
        body: update.body,
        milestone: update.milestone,
        phase: update.phase,
        phasePercentage: update.phasePercentage,
        clientActionRequired: update.clientActionRequired || false,
        clientActionText: update.clientActionText,
        practiceArea: matter.practiceArea,
        tone: update.tone || "professional",
        priority: trigger.priority,
        status: trigger.autoPublish ? "auto_published" : "pending_approval",
        autoPublish: trigger.autoPublish,
        approvalRequired: trigger.approvalRequired,
        deliveryChannels: ["portal", "email"],
        deliveredAt: trigger.autoPublish ? new Date() : null,
        aiModelUsed: "claude-sonnet-4-20250514",
        userId,
        firmId,
      },
    });

    // Auto-publish: deliver immediately
    if (trigger.autoPublish) {
      await deliverUpdate(event.matterId, update, firmId, userId);
    }
  }
}

function matchesTriggerCondition(condition: any, event: TriggerEvent): boolean {
  if (!condition || !condition.type) return true;

  switch (condition.type) {
    case "phase_entered":
      return condition.phase === "any" || event.eventData.toPhase === condition.phase;
    case "deadline_completed":
      return !condition.category || event.eventData.deadline?.category === condition.category;
    case "court_event_completed":
      return !condition.eventType || event.eventData.event?.eventType === condition.eventType;
    case "correspondence_sent":
      return !condition.correspondenceType || event.eventData.correspondence?.correspondenceType === condition.correspondenceType;
    case "invoice_paid":
    case "intake_converted":
    case "checklist_complete":
      return true;
    case "checklist_milestone":
      return event.eventData.percentage >= (condition.percentage || 50);
    case "days_since_update":
      return event.eventData.daysSinceUpdate >= (condition.threshold || 30);
    default:
      return true;
  }
}

// ==========================================
// UPDATE GENERATION
// ==========================================

async function generateUpdate(
  event: TriggerEvent,
  matter: any,
  trigger: any,
  firmId: string
): Promise<GeneratedUpdate> {
  // Try template first
  if (trigger.templateId) {
    const template = await db.statusUpdateTemplate.findUnique({ where: { id: trigger.templateId } });
    if (template) {
      return renderTemplate(template, matter, event);
    }
  }

  // Fall back to AI generation
  return generateAIUpdate(event, matter);
}

function renderTemplate(template: any, matter: any, event: TriggerEvent): GeneratedUpdate {
  const clientFirstName = matter.client?.name?.split(" ")[0] || "there";

  let title = template.titleTemplate
    .replace(/\{\{clientFirstName\}\}/g, clientFirstName)
    .replace(/\{\{matterName\}\}/g, matter.name)
    .replace(/\{\{eventTitle\}\}/g, event.eventData.event?.title || "")
    .replace(/\{\{matterTypeFriendly\}\}/g, matter.practiceArea?.replace(/_/g, " ") || "case");

  let body = template.bodyTemplate
    .replace(/\{\{clientFirstName\}\}/g, clientFirstName)
    .replace(/\{\{matterName\}\}/g, matter.name)
    .replace(/\{\{attorneyName\}\}/g, "your attorney")
    .replace(/\{\{firmName\}\}/g, "our firm")
    .replace(/\{\{currentPhaseFriendly\}\}/g, matter.currentStage || "active")
    .replace(/\{\{matterTypeFriendly\}\}/g, matter.practiceArea?.replace(/_/g, " ") || "case")
    .replace(/\{\{opposingParty\}\}/g, matter.party2Name || "the other party")
    // Remove unresolved conditional blocks
    .replace(/\{\{#if.*?\}\}.*?\{\{\/if\}\}/gs, "");

  return {
    title,
    body,
    milestone: template.milestoneTag,
    tone: template.tone,
    clientActionRequired: !!template.clientActionText,
    clientActionText: template.clientActionText,
  };
}

const AI_UPDATE_PROMPT = `You are a legal assistant generating a client-facing status update. The client is NOT a lawyer.

Rules:
- Write in clear, plain English — no legal jargon without explanation
- Be reassuring but honest
- Use "we" for the firm and "you/your" for the client
- 2-4 paragraphs maximum
- NEVER share strategy, prediction scores, or internal assessments
- NEVER include specific dollar amounts unless explicitly provided
- End with what happens next
- Match the tone to the practice area

Return JSON: { "title": "...", "body": "...", "milestone": "string or null", "phase": "string or null", "clientActionRequired": false, "clientActionText": "string or null" }
Only return the JSON.`;

async function generateAIUpdate(event: TriggerEvent, matter: any): Promise<GeneratedUpdate> {
  try {
    const anthropic = new Anthropic();

    const context = {
      practiceArea: matter.practiceArea,
      matterName: matter.name,
      clientName: matter.client?.name,
      eventType: event.eventType,
      eventData: event.eventData,
    };

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: AI_UPDATE_PROMPT,
      messages: [{ role: "user", content: `Generate a status update for this event:\n${JSON.stringify(context, null, 2)}` }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "{}";
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}");

    return {
      title: json.title || "Case Update",
      body: json.body || "Your attorney will provide an update soon.",
      milestone: json.milestone,
      phase: json.phase,
      clientActionRequired: json.clientActionRequired || false,
      clientActionText: json.clientActionText,
    };
  } catch {
    return {
      title: "Case Update",
      body: "Your legal team is continuing to work on your case. We'll share detailed updates as developments occur.",
    };
  }
}

// ==========================================
// PERIODIC CHECK-IN GENERATOR
// ==========================================

export async function generatePeriodicCheckin(
  matterId: string,
  practiceArea: string,
  daysSinceLastUpdate: number
): Promise<GeneratedUpdate> {
  const matter = await db.matter.findUnique({
    where: { id: matterId },
    include: { client: { select: { name: true } } },
  });

  const clientFirstName = matter?.client?.name?.split(" ")[0] || "there";
  const pa = practiceArea.toLowerCase();

  let body = "";
  if (pa.includes("personal_injury") || pa.includes("pi")) {
    body = `Hello ${clientFirstName},\n\nWe wanted to touch base with you. Your case is progressing and your legal team is actively working on it. Even though there may not be a major milestone to report this week, rest assured we're moving things forward.\n\nPlease continue following your doctor's treatment plan and keep all medical appointments. If anything changes with your condition or if you have questions, don't hesitate to reach out through your portal.`;
  } else if (pa.includes("family")) {
    body = `Hello ${clientFirstName},\n\nWe wanted to check in and let you know we're continuing to work on your family matter. We understand this is a difficult time, and we want you to know your attorney is here for you.\n\nIf you have any questions or concerns — even small ones — please reach out anytime through your portal. We're always just a message away.`;
  } else if (pa.includes("immigration")) {
    body = `Hello ${clientFirstName},\n\nYour application remains under review. We're monitoring for any updates and will notify you immediately if anything changes.\n\nIn the meantime, please make sure all your documents are up to date and that we have copies of any recent correspondence from USCIS or other agencies.`;
  } else if (pa.includes("corporate")) {
    body = `Hello ${clientFirstName},\n\nQuick update on your engagement: we're continuing to make progress. Your legal team is on track and we'll have more to share soon.\n\nIf you have any questions or need to discuss anything, please reach out through your portal.`;
  } else {
    body = `Hello ${clientFirstName},\n\nWe wanted to check in and let you know your case is progressing. Your legal team is actively working on your behalf.\n\nIf you have any questions or concerns, please don't hesitate to reach out through your portal.`;
  }

  return {
    title: `Checking In On Your ${practiceArea.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Case`,
    body,
    tone: pa.includes("family") ? "warm" : "professional",
  };
}

// ==========================================
// DIGEST GENERATOR
// ==========================================

export async function generateDigest(
  matterId: string,
  portalAccountId: string,
  period: "weekly" | "biweekly" | "monthly"
): Promise<GeneratedUpdate> {
  const days = period === "weekly" ? 7 : period === "biweekly" ? 14 : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const suppressedUpdates = await db.statusUpdateQueue.findMany({
    where: {
      matterId,
      createdAt: { gte: since },
      status: { in: ["auto_published", "delivered", "approved"] },
    },
    orderBy: { createdAt: "asc" },
  });

  const matter = await db.matter.findUnique({
    where: { id: matterId },
    include: { client: { select: { name: true } } },
  });

  const clientFirstName = matter?.client?.name?.split(" ")[0] || "there";
  const periodLabel = period === "weekly" ? "week" : period === "biweekly" ? "two weeks" : "month";

  if (suppressedUpdates.length === 0) {
    return {
      title: `Your ${periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}ly Case Digest`,
      body: `Hello ${clientFirstName},\n\nHere's your ${periodLabel}ly update: there were no major developments this period, but your legal team continues to work on your case. We'll keep you posted as things progress.`,
    };
  }

  const bullets = suppressedUpdates.map((u) => `- ${u.title}`).join("\n");

  return {
    title: `Your ${periodLabel.charAt(0).toUpperCase() + periodLabel.slice(1)}ly Case Digest`,
    body: `Hello ${clientFirstName},\n\nHere's what happened on your case this ${periodLabel}:\n\n${bullets}\n\nIf you have any questions about any of these updates, please reach out through your portal.`,
  };
}

// ==========================================
// DELIVERY ENGINE
// ==========================================

async function deliverUpdate(
  matterId: string,
  update: GeneratedUpdate,
  firmId: string,
  userId: string
): Promise<void> {
  // Publish to portal as PortalStatusUpdate
  await db.portalStatusUpdate.create({
    data: {
      matterId,
      title: update.title,
      body: update.body,
      milestone: update.milestone,
      phase: update.phase,
      phasePercentage: update.phasePercentage,
      isPublished: true,
      isDraft: false,
      publishedAt: new Date(),
      notifyClient: true,
      aiGenerated: true,
      userId,
      firmId,
    },
  });

  // Create notifications for linked portal accounts
  const access = await db.portalMatterAccess.findMany({
    where: { matterId, isActive: true },
  });

  for (const a of access) {
    await db.portalNotification.create({
      data: {
        portalUserId: a.portalUserId,
        matterId,
        type: "status_update",
        title: update.title,
        body: update.body.slice(0, 200),
        linkTo: `/portal/matter/${matterId}`,
      },
    }).catch(() => {});
  }
}

// ==========================================
// SCHEDULED UPDATE PROCESSOR
// ==========================================

export async function processScheduledUpdates(firmId: string, userId: string): Promise<number> {
  const now = new Date();
  let processed = 0;

  const dueSchedules = await db.statusUpdateSchedule.findMany({
    where: {
      firmId,
      isPaused: false,
      nextRunAt: { lte: now },
    },
  });

  for (const schedule of dueSchedules) {
    // Check max occurrences
    if (schedule.maxOccurrences && schedule.currentOccurrence >= schedule.maxOccurrences) {
      await db.statusUpdateSchedule.update({
        where: { id: schedule.id },
        data: { isPaused: true },
      });
      continue;
    }

    const matter = await db.matter.findUnique({ where: { id: schedule.matterId } });
    if (!matter || matter.status === "CLOSED") continue;

    // Generate check-in update
    const lastUpdate = await db.statusUpdateQueue.findFirst({
      where: { matterId: schedule.matterId },
      orderBy: { createdAt: "desc" },
    });
    const daysSince = lastUpdate
      ? Math.ceil((now.getTime() - lastUpdate.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : schedule.frequencyDays;

    const update = await generatePeriodicCheckin(
      schedule.matterId,
      matter.practiceArea || "general",
      daysSince
    );

    // Queue the update
    await db.statusUpdateQueue.create({
      data: {
        matterId: schedule.matterId,
        triggerSource: "inactivity",
        title: update.title,
        body: update.body,
        practiceArea: matter.practiceArea,
        tone: update.tone || "professional",
        priority: 5,
        status: schedule.autoPublish ? "auto_published" : "pending_approval",
        autoPublish: schedule.autoPublish,
        approvalRequired: !schedule.autoPublish,
        deliveryChannels: ["portal", "email"],
        deliveredAt: schedule.autoPublish ? now : null,
        userId,
        firmId,
      },
    });

    if (schedule.autoPublish) {
      await deliverUpdate(schedule.matterId, update, firmId, userId);
    }

    // Update schedule
    const nextRun = new Date(now);
    nextRun.setDate(nextRun.getDate() + schedule.frequencyDays);
    await db.statusUpdateSchedule.update({
      where: { id: schedule.id },
      data: {
        lastRunAt: now,
        nextRunAt: nextRun,
        currentOccurrence: { increment: 1 },
      },
    });

    processed++;
  }

  return processed;
}
