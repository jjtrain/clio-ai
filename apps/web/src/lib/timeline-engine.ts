import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

// ==========================================
// TYPES
// ==========================================

export interface ClientTimeline {
  matterId: string;
  matterName: string;
  practiceArea: string | null;
  currentPhase: { phase: string; label: string; description: string; progress: number } | null;
  welcomeNote: string | null;
  events: TimelineEventData[];
  phaseGroups: PhaseGroup[];
}

export interface TimelineEventData {
  id: string;
  eventType: string;
  category: string;
  timelineStatus: string;
  title: string;
  clientDescription: string | null;
  date: Date;
  dateLabel: string | null;
  isEstimatedDate: boolean;
  iconType: string | null;
  accentColor: string | null;
  importance: string;
  requiresClientAction: boolean;
  clientActionText: string | null;
  clientActionLink: string | null;
  clientActionCompleted: boolean;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  phaseTag: string | null;
}

export interface PhaseGroup {
  phase: string;
  label: string;
  events: TimelineEventData[];
  isComplete: boolean;
  isCurrent: boolean;
}

// ==========================================
// MAIN TIMELINE BUILDER
// ==========================================

export async function buildClientTimeline(matterId: string, firmId: string): Promise<ClientTimeline> {
  const matter = await db.matter.findUnique({
    where: { id: matterId },
    select: { id: true, name: true, practiceArea: true, openDate: true, status: true },
  });
  if (!matter) throw new Error("Matter not found");

  // Load config
  let config = await db.timelineConfig.findUnique({ where: { matterId } });

  // Load existing manual/auto events
  const events = await db.clientTimelineEvent.findMany({
    where: { matterId, isVisibleToClient: true },
    orderBy: { date: "asc" },
  });

  // Auto-populate from system data if no events yet or for enrichment
  const autoEvents = await autoPopulateFromSystemData(matterId, config, firmId);

  // Merge: keep manually created events, add auto events that don't duplicate
  const existingSourceIds = new Set(events.filter((e) => e.sourceId).map((e) => e.sourceId));
  const mergedEvents: TimelineEventData[] = [
    ...events.map(mapToEventData),
    ...autoEvents.filter((e) => !e.sourceId || !existingSourceIds.has(e.sourceId)).map(mapToEventData),
  ];

  // Load template for anticipated milestones
  let template = null;
  if (config?.templateId) {
    template = await db.timelineTemplate.findUnique({ where: { id: config.templateId } });
  }
  if (!template && matter.practiceArea) {
    template = await db.timelineTemplate.findFirst({
      where: { practiceArea: matter.practiceArea, isDefault: true, isActive: true },
    });
  }

  if (template) {
    const anticipated = generateAnticipatedMilestones(matter, template, mergedEvents);
    mergedEvents.push(...anticipated);
  }

  // Sort by date
  mergedEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Detect current phase
  const currentPhase = detectCurrentPhase(mergedEvents);

  // Group by phase
  const phaseGroups = groupByPhase(mergedEvents, currentPhase?.phase || null);

  return {
    matterId,
    matterName: matter.name,
    practiceArea: matter.practiceArea,
    currentPhase,
    welcomeNote: config?.customWelcomeNote || null,
    events: mergedEvents,
    phaseGroups,
  };
}

// ==========================================
// AUTO-POPULATE FROM SYSTEM DATA
// ==========================================

async function autoPopulateFromSystemData(
  matterId: string,
  config: any,
  firmId: string
): Promise<any[]> {
  const events: any[] = [];
  const now = new Date();

  // From PortalStatusUpdate
  const statusUpdates = await db.portalStatusUpdate.findMany({
    where: { matterId, isPublished: true },
    orderBy: { publishedAt: "asc" },
  });
  for (const su of statusUpdates) {
    events.push({
      id: `auto-su-${su.id}`,
      matterId,
      eventType: "status_update",
      category: "communication",
      timelineStatus: "completed",
      title: su.title,
      clientDescription: su.body,
      date: su.publishedAt || su.createdAt,
      iconType: su.milestone ? "star" : "mail",
      importance: su.milestone ? "major" : "normal",
      isVisibleToClient: true,
      phaseTag: su.phase,
      linkedEntityType: "status_update",
      linkedEntityId: su.id,
      sourceType: "auto",
      sourceId: `su-${su.id}`,
      userId: su.userId,
      firmId,
    });
  }

  // From CalendarEvent (past court events)
  const pastEvents = await db.calendarEvent.findMany({
    where: { matterId, startTime: { lte: now }, eventType: { in: ["hearing", "conference", "deposition", "mediation", "trial"] } },
    orderBy: { startTime: "asc" },
  });
  for (const ce of pastEvents) {
    events.push({
      id: `auto-ce-${ce.id}`,
      matterId,
      eventType: "court_event",
      category: "legal_proceeding",
      timelineStatus: "completed",
      title: ce.title,
      clientDescription: `${ce.title}${ce.location ? ` at ${ce.location}` : ""}`,
      date: ce.startTime,
      iconType: "gavel",
      importance: "major",
      isVisibleToClient: true,
      linkedEntityType: "calendar_event",
      linkedEntityId: ce.id,
      sourceType: "auto",
      sourceId: `ce-${ce.id}`,
      userId: ce.userId || "",
      firmId,
    });
  }

  // Future calendar events
  if (config?.showEstimatedDates !== false) {
    const futureEvents = await db.calendarEvent.findMany({
      where: { matterId, startTime: { gt: now }, eventType: { in: ["hearing", "conference", "deposition", "mediation", "trial"] } },
      orderBy: { startTime: "asc" },
      take: 5,
    });
    for (const ce of futureEvents) {
      events.push({
        id: `auto-fce-${ce.id}`,
        matterId,
        eventType: "anticipated_event",
        category: "legal_proceeding",
        timelineStatus: "upcoming",
        title: ce.title,
        clientDescription: `Scheduled: ${ce.title}`,
        date: ce.startTime,
        dateLabel: new Date(ce.startTime).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
        iconType: "calendar",
        importance: "major",
        isVisibleToClient: true,
        linkedEntityType: "calendar_event",
        linkedEntityId: ce.id,
        sourceType: "auto",
        sourceId: `fce-${ce.id}`,
        userId: ce.userId || "",
        firmId,
      });
    }
  }

  // From PortalDocument (key documents)
  if (config?.showDocuments !== false) {
    const docs = await db.portalDocument.findMany({
      where: { matterId, isVisible: true, firmId, uploaderType: "attorney" },
      orderBy: { createdAt: "asc" },
    });
    for (const doc of docs) {
      events.push({
        id: `auto-doc-${doc.id}`,
        matterId,
        eventType: "document_shared",
        category: "document",
        timelineStatus: "completed",
        title: doc.fileName,
        clientDescription: doc.description || `Document shared: ${doc.fileName}`,
        date: doc.createdAt,
        iconType: "file",
        importance: "minor",
        isVisibleToClient: true,
        linkedEntityType: "portal_document",
        linkedEntityId: doc.id,
        sourceType: "auto",
        sourceId: `doc-${doc.id}`,
        userId: doc.userId || "",
        firmId,
      });
    }
  }

  // From MatterPhaseHistory
  const phases = await db.matterPhaseHistory.findMany({
    where: { matterId },
    orderBy: { startedAt: "asc" },
  });
  for (const ph of phases) {
    events.push({
      id: `auto-ph-${ph.id}`,
      matterId,
      eventType: "phase_change",
      category: "legal_proceeding",
      timelineStatus: ph.endedAt ? "completed" : "current",
      title: `Case entered ${ph.phase.replace(/_/g, " ")} phase`,
      clientDescription: `Your case moved to the ${ph.phase.replace(/_/g, " ")} phase.`,
      date: ph.startedAt,
      iconType: "flag",
      importance: "major",
      isVisibleToClient: true,
      phaseTag: ph.phase,
      sourceType: "auto",
      sourceId: `ph-${ph.id}`,
      userId: ph.userId || "",
      firmId,
    });
  }

  return events;
}

// ==========================================
// ANTICIPATED MILESTONES
// ==========================================

function generateAnticipatedMilestones(
  matter: any,
  template: any,
  existingEvents: TimelineEventData[]
): TimelineEventData[] {
  const milestones = (template.milestones as any[]) || [];
  const anticipated: TimelineEventData[] = [];
  const completedTitles = new Set(
    existingEvents.filter((e) => e.timelineStatus === "completed").map((e) => e.title.toLowerCase())
  );

  const startDate = matter.openDate;
  const now = new Date();

  for (const ms of milestones) {
    // Skip if already completed
    if (completedTitles.has(ms.title.toLowerCase())) continue;

    const estimatedDate = new Date(startDate);
    estimatedDate.setDate(estimatedDate.getDate() + (ms.typicalDaysFromStart || 90));

    // Skip if estimated date is in the past (should have been completed)
    if (estimatedDate < now) continue;

    const monthYear = estimatedDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });

    anticipated.push({
      id: `anticipated-${ms.id}`,
      eventType: "future_milestone",
      category: ms.category || "upcoming",
      timelineStatus: "anticipated",
      title: ms.title,
      clientDescription: ms.clientDescription || ms.title,
      date: estimatedDate,
      dateLabel: `Expected: ${monthYear}`,
      isEstimatedDate: true,
      iconType: ms.iconType || "clock",
      accentColor: null,
      importance: ms.importance || "normal",
      requiresClientAction: ms.requiresClientAction || false,
      clientActionText: ms.clientActionText || null,
      clientActionLink: null,
      clientActionCompleted: false,
      linkedEntityType: null,
      linkedEntityId: null,
      attachmentUrl: null,
      attachmentName: null,
      phaseTag: ms.phase || null,
    });
  }

  return anticipated;
}

// ==========================================
// PHASE DETECTION
// ==========================================

function detectCurrentPhase(events: TimelineEventData[]): {
  phase: string;
  label: string;
  description: string;
  progress: number;
} | null {
  const phaseEvents = events.filter((e) => e.eventType === "phase_change");
  if (phaseEvents.length === 0) return null;

  const current = phaseEvents.filter((e) => e.timelineStatus === "current")[0]
    || phaseEvents[phaseEvents.length - 1];

  const phase = current.phaseTag || "active";
  const total = events.filter((e) => e.importance === "major").length;
  const completed = events.filter((e) => e.importance === "major" && e.timelineStatus === "completed").length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 50;

  const PHASE_LABELS: Record<string, string> = {
    pre_litigation: "Getting Started",
    pleadings: "Case Filed",
    discovery: "Information Exchange",
    motion_practice: "Legal Arguments",
    trial_prep: "Preparing for Trial",
    trial: "Trial",
    post_trial: "After Trial",
    appeal: "Appeal",
    settlement: "Settlement",
    closed: "Case Resolved",
  };

  return {
    phase,
    label: PHASE_LABELS[phase] || phase.replace(/_/g, " "),
    description: current.clientDescription || "",
    progress,
  };
}

// ==========================================
// PHASE GROUPING
// ==========================================

function groupByPhase(events: TimelineEventData[], currentPhase: string | null): PhaseGroup[] {
  const groupMap = new Map<string, TimelineEventData[]>();
  const order: string[] = [];

  for (const event of events) {
    const phase = event.phaseTag || "general";
    if (!groupMap.has(phase)) {
      groupMap.set(phase, []);
      order.push(phase);
    }
    groupMap.get(phase)!.push(event);
  }

  return order.map((phase) => {
    const groupEvents = groupMap.get(phase) || [];
    const isComplete = groupEvents.every((e) => e.timelineStatus === "completed" || e.timelineStatus === "cancelled");
    const isCurrent = phase === currentPhase || groupEvents.some((e) => e.timelineStatus === "current");

    const PHASE_LABELS: Record<string, string> = {
      pre_litigation: "Getting Started",
      pleadings: "Case Filed",
      discovery: "Information Exchange",
      motion_practice: "Legal Arguments",
      trial_prep: "Preparing for Trial",
      trial: "Trial",
      settlement: "Settlement",
      general: "Case Activity",
    };

    return {
      phase,
      label: PHASE_LABELS[phase] || phase.replace(/_/g, " "),
      events: groupEvents,
      isComplete,
      isCurrent,
    };
  });
}

// ==========================================
// AI DESCRIPTION GENERATOR
// ==========================================

export async function generateClientEventDescription(
  event: any,
  practiceArea: string
): Promise<string> {
  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      system: "You are a legal assistant. Rewrite the following legal event description in plain English for a non-lawyer client. Be warm, clear, and brief (1-2 sentences). Never use legal jargon without explanation. Match the practice area's tone.",
      messages: [{
        role: "user",
        content: `Practice Area: ${practiceArea}\nEvent: ${event.title}\nDetails: ${event.description || "N/A"}\n\nRewrite for client:`,
      }],
    });
    return response.content[0]?.type === "text" ? response.content[0].text : event.title;
  } catch {
    return event.description || event.title;
  }
}

// ==========================================
// HELPERS
// ==========================================

function mapToEventData(e: any): TimelineEventData {
  return {
    id: e.id,
    eventType: e.eventType,
    category: e.category,
    timelineStatus: e.timelineStatus,
    title: e.title,
    clientDescription: e.clientDescription || e.description,
    date: e.date,
    dateLabel: e.dateLabel,
    isEstimatedDate: e.isEstimatedDate || false,
    iconType: e.iconType,
    accentColor: e.accentColor,
    importance: e.importance || "normal",
    requiresClientAction: e.requiresClientAction || false,
    clientActionText: e.clientActionText,
    clientActionLink: e.clientActionLink,
    clientActionCompleted: e.clientActionCompleted || false,
    linkedEntityType: e.linkedEntityType,
    linkedEntityId: e.linkedEntityId,
    attachmentUrl: e.attachmentUrl,
    attachmentName: e.attachmentName,
    phaseTag: e.phaseTag,
  };
}
