import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

// ==========================================
// TYPES
// ==========================================

export interface MatterState {
  matterId: string;
  matterName: string;
  practiceArea: string | null;
  status: string;
  pipelineStage: string;
  openDate: Date;
  clientName: string;
  currentPhase: string;
  daysSinceOpen: number;
  daysSinceLastActivity: number;
  lastClientContact: Date | null;
  daysSinceClientContact: number;
  recentActivities: ActivityEntry[];
  pendingDeadlines: DeadlineEntry[];
  overdueDeadlines: DeadlineEntry[];
  upcomingEvents: EventEntry[];
  unbilledHours: number;
  unbilledAmount: number;
  predictionScore: number | null;
  predictionTrend: string | null; // 'improving', 'declining', 'stable'
  pendingActions: ActionEntry[];
  documentReviewFlags: number;
  correspondenceCount: number;
  discoveryStatus: string | null;
}

interface ActivityEntry {
  type: string;
  description: string;
  date: Date;
}

interface DeadlineEntry {
  id: string;
  name: string;
  date: Date;
  category: string;
  status: string;
  daysRemaining: number;
}

interface EventEntry {
  id: string;
  title: string;
  date: Date;
  type: string;
}

interface ActionEntry {
  id: string;
  title: string;
  actionType: string;
  urgency: string;
  priority: number;
  status: string;
}

export interface GeneratedAction {
  title: string;
  description: string;
  actionType: string;
  urgency: string;
  priority: number;
  source: "rule" | "ai";
  triggerEvent?: string;
  reasoning?: string;
  practiceAreaContext?: string;
  ruleReference?: string;
  suggestedFeature?: string;
  suggestedAction?: any;
  estimatedTime?: string;
  relatedDeadlineId?: string;
  relatedDeadlineDate?: Date;
  expiresAt?: Date;
}

// ==========================================
// STATE GATHERING
// ==========================================

export async function gatherMatterState(matterId: string, firmId: string): Promise<MatterState> {
  const now = new Date();

  const matter = await db.matter.findUnique({
    where: { id: matterId },
    include: {
      client: { select: { name: true } },
      activities: { orderBy: { createdAt: "desc" }, take: 30 },
    },
  });

  if (!matter) throw new Error(`Matter ${matterId} not found`);

  // Fetch deadlines
  const deadlines = await db.calculatedDeadline.findMany({
    where: { matterId, firmId },
    orderBy: { deadlineDate: "asc" },
  });

  const pendingDeadlines = deadlines
    .filter((d) => d.status !== "completed")
    .map((d) => ({
      id: d.id,
      name: d.name,
      date: d.deadlineDate,
      category: d.category,
      status: d.status,
      daysRemaining: Math.ceil((d.deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
    }));

  const overdueDeadlines = pendingDeadlines.filter((d) => d.daysRemaining < 0);

  // Fetch upcoming events
  const events = await db.calendarEvent.findMany({
    where: { matterId, startTime: { gte: now } },
    orderBy: { startTime: "asc" },
    take: 10,
  });

  // Fetch unbilled time
  const timeEntries = await db.timeEntry.findMany({
    where: { matterId, invoiceLineItemId: null, billable: true },
  });
  const unbilledHours = timeEntries.reduce((sum, e) => sum + (e.hours || e.duration / 60), 0);
  const unbilledAmount = timeEntries.reduce((sum, e) => sum + (e.amount ? Number(e.amount) : (e.hours || e.duration / 60) * Number(e.rate || 0)), 0);

  // Fetch prediction
  const prediction = await db.matterPrediction.findFirst({
    where: { matterId },
    orderBy: { lastCalculated: "desc" },
  });

  // Fetch pending actions
  const existingActions = await db.matterAction.findMany({
    where: { matterId, status: { in: ["pending", "acknowledged", "in_progress"] } },
    orderBy: { priority: "desc" },
  });

  // Fetch activity log for last contact
  const activityLogs = await db.matterActivityLog.findMany({
    where: { matterId },
    orderBy: { occurredAt: "desc" },
    take: 50,
  });

  const clientContactTypes = ["client_call", "client_meeting", "client_communication", "correspondence_sent"];
  const lastClientContact = activityLogs.find((a) => clientContactTypes.includes(a.activityType));

  // Fetch unresolved doc review flags
  let docFlags = 0;
  try {
    const reviews = await db.documentReview.findMany({ where: { matterId, firmId } });
    docFlags = reviews.reduce((sum, r) => sum + (r.criticalFlags + r.highFlags), 0);
  } catch {}

  // Count correspondence
  let corrCount = 0;
  try {
    corrCount = await db.correspondenceDraft.count({ where: { matterId, firmId } });
  } catch {}

  const lastActivity = matter.activities[0];
  const daysSinceLastActivity = lastActivity
    ? Math.ceil((now.getTime() - lastActivity.createdAt.getTime()) / (1000 * 60 * 60 * 24))
    : Math.ceil((now.getTime() - matter.openDate.getTime()) / (1000 * 60 * 60 * 24));

  const daysSinceClientContact = lastClientContact
    ? Math.ceil((now.getTime() - lastClientContact.occurredAt.getTime()) / (1000 * 60 * 60 * 24))
    : 999;

  // Detect current phase
  const currentPhase = await detectCurrentPhase(matterId, matter, activityLogs, deadlines);

  return {
    matterId,
    matterName: matter.name,
    practiceArea: matter.practiceArea,
    status: matter.status,
    pipelineStage: matter.pipelineStage,
    openDate: matter.openDate,
    clientName: matter.client?.name || "Unknown",
    currentPhase,
    daysSinceOpen: Math.ceil((now.getTime() - matter.openDate.getTime()) / (1000 * 60 * 60 * 24)),
    daysSinceLastActivity,
    lastClientContact: lastClientContact?.occurredAt || null,
    daysSinceClientContact,
    recentActivities: matter.activities.slice(0, 20).map((a) => ({
      type: a.type,
      description: a.description,
      date: a.createdAt,
    })),
    pendingDeadlines,
    overdueDeadlines,
    upcomingEvents: events.map((e) => ({
      id: e.id,
      title: e.title,
      date: e.startTime,
      type: e.eventType || "appointment",
    })),
    unbilledHours,
    unbilledAmount,
    predictionScore: prediction?.overallScore || null,
    predictionTrend: null,
    pendingActions: existingActions.map((a) => ({
      id: a.id,
      title: a.title,
      actionType: a.actionType,
      urgency: a.urgency,
      priority: a.priority,
      status: a.status,
    })),
    documentReviewFlags: docFlags,
    correspondenceCount: corrCount,
    discoveryStatus: null,
  };
}

// ==========================================
// PHASE DETECTION
// ==========================================

async function detectCurrentPhase(
  matterId: string,
  matter: any,
  activityLogs: any[],
  deadlines: any[]
): Promise<string> {
  if (matter.status === "CLOSED") return "closed";

  const activities = activityLogs.map((a) => a.activityType);
  const descriptions = activityLogs.map((a) => a.description.toLowerCase());

  // Check from most advanced phase backwards
  if (descriptions.some((d) => d.includes("appeal") || d.includes("notice of appeal"))) return "appeal";
  if (descriptions.some((d) => d.includes("verdict") || d.includes("decision") || d.includes("judgment entered"))) return "post_trial";
  if (descriptions.some((d) => d.includes("trial") && (d.includes("day") || d.includes("start") || d.includes("commenced")))) return "trial";

  // Check deadlines for trial date
  const trialDeadline = deadlines.find((d) =>
    d.name.toLowerCase().includes("trial") && d.status !== "completed"
  );
  if (trialDeadline) {
    const daysToTrial = Math.ceil((trialDeadline.deadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysToTrial <= 60) return "trial_prep";
  }

  if (descriptions.some((d) => d.includes("settlement") && (d.includes("discuss") || d.includes("negotiat") || d.includes("mediat")))) {
    // Settlement can overlap - check if also in another phase
  }

  if (descriptions.some((d) => d.includes("note of issue") || d.includes("discovery cutoff"))) return "motion_practice";
  if (activities.includes("discovery_served") || activities.includes("discovery_received") ||
      descriptions.some((d) => d.includes("discovery") || d.includes("interrogator") || d.includes("deposition"))) return "discovery";
  if (descriptions.some((d) => d.includes("answer filed") || d.includes("answer served"))) return "discovery";
  if (descriptions.some((d) => d.includes("complaint") || d.includes("petition") || d.includes("summons"))) return "pleadings";

  // Default based on matter age and stage
  if (matter.pipelineStage === "NEW" || matter.pipelineStage === "CONSULTATION") return "pre_litigation";
  if (matter.pipelineStage === "ACTIVE") return "pleadings";

  return "pre_litigation";
}

// ==========================================
// RULE-BASED ACTION GENERATION
// ==========================================

export async function evaluateRules(
  state: MatterState,
  firmId: string
): Promise<GeneratedAction[]> {
  const rules = await db.actionRule.findMany({
    where: {
      isActive: true,
      OR: [{ firmId }, { firmId: null }],
    },
  });

  const actions: GeneratedAction[] = [];

  for (const rule of rules) {
    // Filter by practice area
    if (rule.practiceArea && state.practiceArea?.toLowerCase() !== rule.practiceArea.toLowerCase()) continue;
    // Filter by phase
    if (rule.casePhase && state.currentPhase !== rule.casePhase) continue;

    const condition = rule.triggerCondition as any;
    const template = rule.actionTemplate as any;
    let triggered = false;

    switch (rule.triggerType) {
      case "inactivity": {
        if (condition.type === "client_contact_gap" && state.daysSinceClientContact >= (condition.daysThreshold || 30)) {
          triggered = true;
        }
        if (condition.type === "matter_inactivity" && state.daysSinceLastActivity >= (condition.daysThreshold || 21)) {
          triggered = true;
        }
        break;
      }
      case "deadline_approaching": {
        if (condition.type === "deadline_overdue" && state.overdueDeadlines.length > 0) {
          // Create one action per overdue deadline
          for (const dl of state.overdueDeadlines) {
            actions.push({
              title: template.title.replace("[deadline name]", dl.name).replace("[days]", String(Math.abs(dl.daysRemaining))),
              description: template.description.replace("[daysRemaining]", String(Math.abs(dl.daysRemaining))),
              actionType: template.actionType || "deadline_response",
              urgency: "immediate",
              priority: 10,
              source: "rule",
              triggerEvent: `Deadline "${dl.name}" overdue by ${Math.abs(dl.daysRemaining)} days`,
              suggestedFeature: template.suggestedFeature,
              relatedDeadlineId: dl.id,
              relatedDeadlineDate: dl.date,
              estimatedTime: template.estimatedTime,
            });
          }
          continue; // already added actions
        }
        if (condition.type === "deadline_no_prep") {
          const threshold = condition.daysThreshold || 14;
          const approaching = state.pendingDeadlines.filter((d) => d.daysRemaining > 0 && d.daysRemaining <= threshold);
          for (const dl of approaching) {
            triggered = true;
            actions.push({
              title: `Prepare for ${dl.name} — due in ${dl.daysRemaining} days`,
              description: template.description.replace("[daysRemaining]", String(dl.daysRemaining)),
              actionType: template.actionType || "deadline_response",
              urgency: dl.daysRemaining <= 7 ? "immediate" : "this_week",
              priority: dl.daysRemaining <= 7 ? 9 : 7,
              source: "rule",
              triggerEvent: `Deadline "${dl.name}" in ${dl.daysRemaining} days`,
              suggestedFeature: template.suggestedFeature,
              relatedDeadlineId: dl.id,
              relatedDeadlineDate: dl.date,
              estimatedTime: template.estimatedTime,
              ruleReference: (template as any).ruleReference,
            });
          }
          continue;
        }
        if (condition.type === "discovery_cutoff_approaching") {
          const discoCutoff = state.pendingDeadlines.find((d) =>
            d.name.toLowerCase().includes("discovery") && d.name.toLowerCase().includes("cutoff")
          );
          if (discoCutoff && discoCutoff.daysRemaining <= (condition.daysThreshold || 30)) {
            triggered = true;
          }
        }
        break;
      }
      case "billing_trigger": {
        if (condition.type === "unbilled_hours" && state.unbilledHours >= (condition.hoursThreshold || 15)) {
          triggered = true;
        }
        break;
      }
      case "prediction_change": {
        // Would need score history - simplified: check if score is low
        if (condition.type === "score_declined" && state.predictionScore && state.predictionScore < 50) {
          triggered = true;
        }
        break;
      }
      case "document_review_result": {
        if (condition.type === "unresolved_critical_flags" && state.documentReviewFlags > 0) {
          triggered = true;
        }
        break;
      }
      case "phase_transition": {
        triggered = true; // Phase-specific rules already filtered by casePhase
        break;
      }
    }

    if (triggered && template) {
      actions.push({
        title: template.title || rule.name,
        description: template.description || rule.description,
        actionType: template.actionType || "strategic",
        urgency: template.urgency || "this_week",
        priority: template.priority || 5,
        source: "rule",
        triggerEvent: rule.triggerType,
        practiceAreaContext: template.practiceAreaContext,
        ruleReference: template.ruleReference,
        suggestedFeature: template.suggestedFeature,
        suggestedAction: template.suggestedAction,
        estimatedTime: template.estimatedTime,
      });
    }
  }

  return actions;
}

// ==========================================
// AI-POWERED ACTION GENERATION
// ==========================================

const AI_ACTION_PROMPT = `You are a senior litigation attorney advising on the next best actions for a legal matter. Analyze the matter state and suggest 3-5 high-impact actions.

Return a JSON array of actions:
[
  {
    "title": "concise action title",
    "description": "detailed explanation of why this action is needed now",
    "actionType": "filing|discovery|correspondence|client_communication|court_preparation|settlement|billing|expert|strategic|document_review|deadline_response|administrative",
    "urgency": "immediate|this_week|next_two_weeks|this_month|when_possible",
    "priority": 1-10,
    "reasoning": "your reasoning chain explaining why this matters",
    "practiceAreaContext": "practice-area-specific tips if applicable",
    "ruleReference": "legal rule citation if applicable",
    "suggestedFeature": "correspondence|deadline_calculator|document_review|calendar|billing|prediction" or null,
    "estimatedTime": "time estimate string"
  }
]

Focus on:
1. Time-sensitive items (approaching deadlines, overdue tasks)
2. Client relationship maintenance (contact gaps)
3. Case strategy advancement (next logical litigation step)
4. Risk mitigation (declining scores, unresolved issues)
5. Revenue protection (unbilled time, aging invoices)

Be specific to the practice area. Don't suggest actions that duplicate existing pending actions.
Return ONLY the JSON array.`;

export async function generateAIActions(state: MatterState): Promise<GeneratedAction[]> {
  try {
    const anthropic = new Anthropic();

    const stateSnapshot = {
      matterName: state.matterName,
      practiceArea: state.practiceArea,
      phase: state.currentPhase,
      daysSinceOpen: state.daysSinceOpen,
      daysSinceLastActivity: state.daysSinceLastActivity,
      daysSinceClientContact: state.daysSinceClientContact,
      pendingDeadlines: state.pendingDeadlines.slice(0, 5).map((d) => ({
        name: d.name,
        daysRemaining: d.daysRemaining,
        category: d.category,
      })),
      overdueDeadlines: state.overdueDeadlines.map((d) => ({
        name: d.name,
        daysOverdue: Math.abs(d.daysRemaining),
      })),
      upcomingEvents: state.upcomingEvents.slice(0, 3).map((e) => ({
        title: e.title,
        date: e.date,
      })),
      unbilledHours: state.unbilledHours,
      unbilledAmount: state.unbilledAmount,
      predictionScore: state.predictionScore,
      documentReviewFlags: state.documentReviewFlags,
      recentActivities: state.recentActivities.slice(0, 10).map((a) => ({
        type: a.type,
        description: a.description.slice(0, 100),
        date: a.date,
      })),
      existingPendingActions: state.pendingActions.map((a) => a.title),
    };

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: AI_ACTION_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(stateSnapshot, null, 2) }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.map((a: any) => ({
      title: a.title,
      description: a.description,
      actionType: a.actionType || "strategic",
      urgency: a.urgency || "this_week",
      priority: Math.min(a.priority || 5, 10),
      source: "ai" as const,
      reasoning: a.reasoning,
      practiceAreaContext: a.practiceAreaContext,
      ruleReference: a.ruleReference,
      suggestedFeature: a.suggestedFeature,
      estimatedTime: a.estimatedTime,
    }));
  } catch (error) {
    console.error("[NextActions] AI generation failed:", error);
    return [];
  }
}

// ==========================================
// ACTION DEDUPLICATION & MERGING
// ==========================================

export function deduplicateActions(
  ruleActions: GeneratedAction[],
  aiActions: GeneratedAction[],
  existingActions: ActionEntry[]
): GeneratedAction[] {
  const merged: GeneratedAction[] = [];
  const existingTitles = new Set(existingActions.map((a) => a.title.toLowerCase()));

  // Add all rule actions first (keep if not already existing)
  for (const action of ruleActions) {
    if (!existingTitles.has(action.title.toLowerCase())) {
      merged.push(action);
      existingTitles.add(action.title.toLowerCase());
    }
  }

  // Add AI actions, preferring AI version over rule when similar
  for (const aiAction of aiActions) {
    if (existingTitles.has(aiAction.title.toLowerCase())) continue;

    // Check for similar actions by type + rough title match
    const similar = merged.findIndex((m) =>
      m.actionType === aiAction.actionType &&
      calculateSimilarity(m.title, aiAction.title) > 0.6
    );

    if (similar >= 0) {
      // Keep AI version if more detailed
      if (aiAction.description.length > merged[similar].description.length) {
        merged[similar] = { ...aiAction, priority: Math.max(aiAction.priority, merged[similar].priority) };
      }
    } else {
      merged.push(aiAction);
      existingTitles.add(aiAction.title.toLowerCase());
    }
  }

  return merged;
}

// ==========================================
// PRIORITY SCORING
// ==========================================

export function calculateActionPriority(action: GeneratedAction, state: MatterState): number {
  let priority = action.priority;

  // Boost factors
  if (action.relatedDeadlineDate) {
    const days = Math.ceil((action.relatedDeadlineDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) priority += 3; // overdue
    else if (days < 7) priority += 3;
    else if (days < 14) priority += 2;
  }

  if (state.daysSinceClientContact > 30) priority += 2;
  if (state.predictionScore && state.predictionScore < 40) priority += 2;

  // Check SOL proximity
  const solDeadline = state.pendingDeadlines.find((d) =>
    d.name.toLowerCase().includes("statute") || d.name.toLowerCase().includes("sol")
  );
  if (solDeadline && solDeadline.daysRemaining <= 180) priority += 1;

  // Dampen factors
  if (action.actionType === "administrative" || action.actionType === "billing") {
    if (state.overdueDeadlines.length > 0) priority -= 2;
  }

  return Math.max(1, Math.min(10, priority));
}

// ==========================================
// MAIN GENERATION PIPELINE
// ==========================================

export async function generateNextActions(
  matterId: string,
  userId: string,
  firmId: string,
  trigger?: string
): Promise<GeneratedAction[]> {
  // 1. Gather state
  const state = await gatherMatterState(matterId, firmId);

  // Skip closed matters
  if (state.status === "CLOSED") return [];

  // 2. Evaluate rules
  const ruleActions = await evaluateRules(state, firmId);

  // 3. Generate AI actions
  const aiActions = await generateAIActions(state);

  // 4. Deduplicate
  const merged = deduplicateActions(ruleActions, aiActions, state.pendingActions);

  // 5. Calculate final priorities
  for (const action of merged) {
    action.priority = calculateActionPriority(action, state);
  }

  // 6. Sort by priority
  merged.sort((a, b) => b.priority - a.priority);

  // 7. Limit to top actions
  return merged.slice(0, 8);
}

// ==========================================
// BATCH PROCESSING
// ==========================================

export async function generateAllMatterActions(firmId: string, userId: string): Promise<{
  mattersAnalyzed: number;
  totalActions: number;
  byUrgency: Record<string, number>;
  byType: Record<string, number>;
}> {
  const matters = await db.matter.findMany({
    where: { status: "OPEN" },
    select: { id: true },
    take: 50, // rate limit
  });

  let totalActions = 0;
  const byUrgency: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const matter of matters) {
    try {
      const actions = await generateNextActions(matter.id, userId, firmId);

      // Save actions to DB
      for (const action of actions) {
        await db.matterAction.create({
          data: {
            matterId: matter.id,
            title: action.title,
            description: action.description,
            actionType: action.actionType,
            urgency: action.urgency,
            priority: action.priority,
            source: action.source,
            triggerEvent: action.triggerEvent,
            reasoning: action.reasoning,
            practiceAreaContext: action.practiceAreaContext,
            ruleReference: action.ruleReference,
            suggestedFeature: action.suggestedFeature,
            suggestedAction: action.suggestedAction as any,
            estimatedTime: action.estimatedTime,
            relatedDeadlineId: action.relatedDeadlineId,
            relatedDeadlineDate: action.relatedDeadlineDate,
            expiresAt: action.expiresAt,
            userId,
            firmId,
          },
        });

        totalActions++;
        byUrgency[action.urgency] = (byUrgency[action.urgency] || 0) + 1;
        byType[action.actionType] = (byType[action.actionType] || 0) + 1;
      }
    } catch (error) {
      console.error(`[NextActions] Failed for matter ${matter.id}:`, error);
    }
  }

  return {
    mattersAnalyzed: matters.length,
    totalActions,
    byUrgency,
    byType,
  };
}

// ==========================================
// ACTIVITY LOGGING
// ==========================================

export async function logActivity(params: {
  matterId: string;
  activityType: string;
  description: string;
  entityType?: string;
  entityId?: string;
  metadata?: any;
  userId?: string;
  firmId: string;
}): Promise<void> {
  await db.matterActivityLog.create({
    data: {
      matterId: params.matterId,
      activityType: params.activityType,
      description: params.description,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata,
      userId: params.userId,
      firmId: params.firmId,
    },
  });
}

// ==========================================
// HELPERS
// ==========================================

function calculateSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let intersection = 0;
  for (const word of Array.from(wordsA)) {
    if (wordsB.has(word)) intersection++;
  }
  return (2 * intersection) / (wordsA.size + wordsB.size);
}
