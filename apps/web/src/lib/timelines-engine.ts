import { db } from "@/lib/db";
import * as trialline from "@/lib/integrations/trialline";
import * as agilelaw from "@/lib/integrations/agilelaw";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const MODEL = "claude-sonnet-4-20250514";

// ── Timeline builders ──

export async function buildTimelineFromMatter(matterId: string, timelineType: string = "GENERAL") {
  const matter = await db.matter.findUniqueOrThrow({
    where: { id: matterId },
    include: { deadlines: true, events: true, documents: true },
  });

  const timeline = await db.caseTimeline.create({
    data: {
      matterId,
      title: `${matter.name} — ${timelineType} Timeline`,
      description: `Auto-generated ${timelineType.toLowerCase()} timeline for ${matter.name}`,
      timelineType: timelineType as any,
      status: "DRAFT",
    },
  });

  const events: any[] = [];

  for (const d of matter.deadlines) {
    const evt = await db.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        title: d.title || d.description || "Deadline",
        date: d.dueDate,
        description: d.description,
        category: "LEGAL_FILING" as any,
        source: "DEADLINE",
        sourceRecordId: d.id,
      },
    });
    events.push(evt);
  }

  for (const ce of matter.events) {
    const evt = await db.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        title: ce.title,
        date: ce.startTime,
        description: ce.description,
        category: "CONFERENCE" as any,
        source: "CALENDAR_EVENT",
        sourceRecordId: ce.id,
      },
    });
    events.push(evt);
  }

  for (const doc of matter.documents) {
    const evt = await db.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        title: `Document: ${doc.name}`,
        date: doc.createdAt,
        description: `Filed document — ${doc.filename}`,
        category: "DOCUMENT" as any,
        source: "DOCUMENT",
        sourceRecordId: doc.id,
      },
    });
    events.push(evt);
  }

  return { timeline, events };
}

export async function buildMedicalTimeline(matterId: string) {
  const matter = await db.matter.findUniqueOrThrow({
    where: { id: matterId },
    include: { deadlines: true, events: true, documents: true },
  });

  const timeline = await db.caseTimeline.create({
    data: {
      matterId,
      title: `${matter.name} — Medical Timeline`,
      description: `Medical records timeline for ${matter.name}`,
      timelineType: "MEDICAL_TREATMENT" as any,
      status: "DRAFT",
    },
  });

  const medicalDocs = matter.documents.filter(d =>
    /medical|health|hospital|doctor|diagnosis|treatment|radiology|lab|pathology/i.test(d.name + " " + (d.filename || ""))
  );

  const sources = medicalDocs.length > 0 ? medicalDocs : matter.documents;
  const events: any[] = [];

  for (const doc of sources) {
    const evt = await db.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        title: doc.name,
        date: doc.createdAt,
        description: `${medicalDocs.length > 0 ? "Medical record" : "Document"}: ${doc.filename}`,
        category: "MEDICAL" as any,
        source: "DOCUMENT",
        sourceRecordId: doc.id,
      },
    });
    events.push(evt);
  }

  for (const ce of matter.events.filter(e =>
    /medical|doctor|appointment|treatment|therapy|exam/i.test(e.title + " " + (e.description || ""))
  )) {
    const evt = await db.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        title: ce.title,
        date: ce.startTime,
        description: ce.description,
        category: "MEDICAL" as any,
        source: "CALENDAR_EVENT",
        sourceRecordId: ce.id,
      },
    });
    events.push(evt);
  }

  return { timeline, events };
}

export async function buildDiscoveryTimeline(matterId: string) {
  const matter = await db.matter.findUniqueOrThrow({
    where: { id: matterId },
    include: { deadlines: true, events: true, documents: true },
  });

  const timeline = await db.caseTimeline.create({
    data: {
      matterId,
      title: `${matter.name} — Discovery Timeline`,
      description: `Discovery schedule and events for ${matter.name}`,
      timelineType: "DISCOVERY" as any,
      status: "DRAFT",
    },
  });

  const events: any[] = [];

  for (const d of matter.deadlines.filter(dl =>
    /discovery|interrogator|deposition|subpoena|production|disclosure|request for admission/i.test((dl.title || "") + " " + (dl.description || ""))
  )) {
    const evt = await db.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        title: d.title || d.description || "Discovery Deadline",
        date: d.dueDate,
        description: d.description,
        category: "DISCOVERY" as any,
        source: "DEADLINE",
        sourceRecordId: d.id,
      },
    });
    events.push(evt);
  }

  for (const doc of matter.documents.filter(d =>
    /discovery|interrogator|deposition|subpoena|production|exhibit|request/i.test(d.name + " " + (d.filename || ""))
  )) {
    const evt = await db.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        title: `Discovery Document: ${doc.name}`,
        date: doc.createdAt,
        description: doc.filename,
        category: "DISCOVERY" as any,
        source: "DOCUMENT",
        sourceRecordId: doc.id,
      },
    });
    events.push(evt);
  }

  return { timeline, events };
}

export async function buildLitigationTimeline(matterId: string) {
  const matter = await db.matter.findUniqueOrThrow({
    where: { id: matterId },
    include: { deadlines: true, events: true, documents: true },
  });

  const timeline = await db.caseTimeline.create({
    data: {
      matterId,
      title: `${matter.name} — Litigation Timeline`,
      description: `Full litigation lifecycle for ${matter.name}`,
      timelineType: "LITIGATION" as any,
      status: "DRAFT",
    },
  });

  const events: any[] = [];

  for (const d of matter.deadlines) {
    const evt = await db.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        title: d.title || d.description || "Deadline",
        date: d.dueDate,
        description: d.description,
        category: "LEGAL_FILING" as any,
        source: "DEADLINE",
        sourceRecordId: d.id,
      },
    });
    events.push(evt);
  }

  for (const ce of matter.events) {
    const evt = await db.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        title: ce.title,
        date: ce.startTime,
        description: ce.description,
        category: "LEGAL_FILING" as any,
        source: "CALENDAR_EVENT",
        sourceRecordId: ce.id,
      },
    });
    events.push(evt);
  }

  for (const doc of matter.documents) {
    const evt = await db.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        title: `Filing: ${doc.name}`,
        date: doc.createdAt,
        description: doc.filename,
        category: "LEGAL_FILING" as any,
        source: "DOCUMENT",
        sourceRecordId: doc.id,
      },
    });
    events.push(evt);
  }

  return { timeline, events };
}

// ── TrialLine sync ──

export async function syncTimelineToTrialLine(timelineId: string) {
  const timeline = await db.caseTimeline.findUniqueOrThrow({
    where: { id: timelineId },
    include: { events: true },
  });

  const createResult = await trialline.createTimeline({
    title: timeline.title,
    description: timeline.description || undefined,
    matterId: timeline.matterId,
  });

  if (!createResult.success) throw new Error(createResult.error || "Failed to create TrialLine timeline");

  const externalId = createResult.data?.id || createResult.data?.timeline_id;

  await db.caseTimeline.update({
    where: { id: timelineId },
    data: { externalTimelineId: externalId, provider: "TRIALLINE" },
  });

  if (timeline.events.length > 0) {
    await trialline.bulkAddEvents(
      externalId,
      timeline.events.map((e: any) => ({
        title: e.title,
        date: e.eventDate.toISOString(),
        description: e.description || undefined,
        category: e.category || undefined,
      }))
    );
  }

  return { timelineId, externalId, eventsSynced: timeline.events.length };
}

export async function syncTimelineFromTrialLine(externalTimelineId: string, matterId: string) {
  const tlResult = await trialline.getTimeline(externalTimelineId);
  if (!tlResult.success) throw new Error(tlResult.error || "Failed to fetch TrialLine timeline");

  const tlData = tlResult.data;

  const timeline = await db.caseTimeline.create({
    data: {
      matterId,
      title: tlData.title || tlData.name || "Imported Timeline",
      description: tlData.description,
      timelineType: (tlData.type || "CASE_CHRONOLOGY") as any,
      status: "DRAFT",
      externalTimelineId,
      provider: "TRIALLINE",
    },
  });

  const eventsResult = await trialline.getEvents(externalTimelineId);
  const externalEvents = eventsResult.success ? (eventsResult.data?.events || eventsResult.data || []) : [];

  const events: any[] = [];
  for (const ext of externalEvents) {
    const evt = await db.timelineEvent.create({
      data: {
        timelineId: timeline.id,
        title: ext.title || ext.name || "Event",
        date: ext.date ? new Date(ext.date) : new Date(),
        description: ext.description,
        category: ext.category,
        source: "TRIALLINE_IMPORT",
        externalEventId: ext.id || ext.event_id,
      },
    });
    events.push(evt);
  }

  return { timeline, events };
}

// ── Event helpers ──

export async function addEventFromRecord(timelineId: string, source: string, sourceRecordId: string) {
  let title = "Event";
  let eventDate = new Date();
  let description: string | undefined;

  if (source === "DEADLINE") {
    const d = await db.deadline.findUniqueOrThrow({ where: { id: sourceRecordId } });
    title = d.title || d.description || "Deadline";
    eventDate = d.dueDate;
    description = d.description || undefined;
  } else if (source === "CALENDAR_EVENT") {
    const ce = await db.calendarEvent.findUniqueOrThrow({ where: { id: sourceRecordId } });
    title = ce.title;
    eventDate = ce.startTime;
    description = ce.description || undefined;
  } else if (source === "DOCUMENT") {
    const doc = await db.document.findUniqueOrThrow({ where: { id: sourceRecordId } });
    title = `Document: ${doc.name}`;
    eventDate = doc.createdAt;
    description = doc.filename;
  }

  return db.timelineEvent.create({
    data: { timelineId, title, date: eventDate, description, category: "OTHER" as any, source, sourceRecordId },
  });
}

// ── AI features ──

export async function generateAISummary(timelineId: string) {
  const timeline = await db.caseTimeline.findUniqueOrThrow({
    where: { id: timelineId },
    include: { events: { orderBy: { date: "asc" } } },
  });

  const eventsText = timeline.events
    .map((e: any) => `- ${e.eventDate.toLocaleDateString()}: ${e.title}${e.description ? ` — ${e.description}` : ""}`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: "You are a legal analyst. Given a case timeline, write a clear narrative summary suitable for attorney review. Include chronological flow, key turning points, and notable patterns. Use professional legal language.",
    messages: [{ role: "user", content: `Timeline: ${timeline.title}\nType: ${timeline.timelineType}\n\nEvents (${timeline.events.length} total):\n${eventsText}` }],
  });

  const summary = message.content[0].type === "text" ? message.content[0].text : "";

  await db.caseTimeline.update({
    where: { id: timelineId },
    data: { aiSummary: summary },
  });

  return { timelineId, summary };
}

export async function detectPatterns(timelineId: string) {
  const timeline = await db.caseTimeline.findUniqueOrThrow({
    where: { id: timelineId },
    include: { events: { orderBy: { date: "asc" } } },
  });

  const eventsText = timeline.events
    .map((e: any) => `[${e.eventDate.toLocaleDateString()}] [${e.category || "GENERAL"}] ${e.title}: ${e.description || ""}`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: `You are a legal analyst specializing in pattern detection. Analyze the timeline for:
1. Temporal patterns (clustering, gaps, acceleration)
2. Category patterns (which event types dominate)
3. Potential causal relationships
4. Missing events that might be expected
5. Strategic implications

Return JSON: {"patterns":[{"type":"...","description":"...","significance":"high|medium|low","events":[]}],"gaps":[{"description":"...","suggestedDate":"..."}],"insights":"markdown summary"}`,
    messages: [{ role: "user", content: `Timeline: ${timeline.title}\n\n${eventsText}` }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  let parsed: any;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { insights: text };
  } catch {
    parsed = { insights: text };
  }

  await db.caseTimeline.update({
    where: { id: timelineId },
    data: { annotations: JSON.stringify(parsed) },
  });

  return parsed;
}

export async function compareTimelines(timelineId1: string, timelineId2: string) {
  const t1 = await db.caseTimeline.findUniqueOrThrow({ where: { id: timelineId1 }, include: { events: { orderBy: { date: "asc" } } } });
  const t2 = await db.caseTimeline.findUniqueOrThrow({ where: { id: timelineId2 }, include: { events: { orderBy: { date: "asc" } } } });

  const fmt = (t: any) => t.events.map((e: any) => `[${e.eventDate.toLocaleDateString()}] ${e.title}: ${e.description || ""}`).join("\n");

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: "You are a legal analyst comparing two case timelines. Identify overlapping events, contradictions, unique events in each, temporal discrepancies, and strategic implications. Use markdown.",
    messages: [{
      role: "user",
      content: `Timeline 1: ${t1.title}\n${fmt(t1)}\n\nTimeline 2: ${t2.title}\n${fmt(t2)}`,
    }],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

// ── Export ──

export async function exportTimelineAsDocument(timelineId: string, format: string = "markdown") {
  const timeline = await db.caseTimeline.findUniqueOrThrow({
    where: { id: timelineId },
    include: { events: { orderBy: { date: "asc" } } },
  });

  return {
    timelineId,
    title: timeline.title,
    format,
    eventCount: timeline.events.length,
    exportReady: true,
    message: `Timeline "${timeline.title}" prepared for ${format} export with ${timeline.events.length} events.`,
  };
}

// ── Deposition ──

export async function prepareDepositionSession(matterId: string, deponentName: string, depositionDate: string) {
  const matter = await db.matter.findUniqueOrThrow({ where: { id: matterId } });

  const session = await db.depositionSession.create({
    data: {
      matterId,
      title: `Deposition of ${deponentName} — ${matter.name}`,
      deponentName,
      depositionDate: new Date(depositionDate),
      status: "SETUP",
    },
  });

  // Sync to AgileLaw if configured
  const agileLawConfig = await db.visualsIntegration.findUnique({ where: { provider: "AGILELAW" } });
  if (agileLawConfig?.isEnabled) {
    const result = await agilelaw.createSession({
      title: session.title,
      deponentName,
      depositionDate,
      matterId,
    });

    if (result.success && result.data) {
      await db.depositionSession.update({
        where: { id: session.id },
        data: {
          externalSessionId: result.data.id || result.data.session_id,
          provider: "AGILELAW",
            },
      });
    }
  }

  return session;
}

export async function analyzeDeposition(sessionId: string) {
  const session = await db.depositionSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { exhibits: true, annotations: true },
  });

  const exhibitSummary = session.exhibits
    .map((e: any, i: number) => `${i + 1}. ${e.exhibitNumber || `Ex. ${i + 1}`}: ${e.name}${e.status ? ` [${e.status}]` : ""}`)
    .join("\n");

  const annotationSummary = session.annotations
    .map((a: any) => `- ${a.type || "NOTE"}: ${a.text}`)
    .join("\n");

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2000,
    system: `You are a litigation analyst reviewing deposition materials. Analyze the exhibits and annotations to provide:
1. Key exhibit summary and their evidentiary significance
2. Notable annotations and their implications
3. Potential follow-up questions or areas to explore
4. Exhibit organization recommendations
Return JSON: {"summary":"...","keyExhibits":[{"exhibit":"...","significance":"..."}],"followUps":[{"area":"...","questions":["..."]}],"recommendations":["..."]}`,
    messages: [{
      role: "user",
      content: `Deposition: ${session.title}\nDeponent: ${session.deponentName}\nDate: ${session.depositionDate?.toLocaleDateString()}\n\nExhibits:\n${exhibitSummary || "None"}\n\nAnnotations:\n${annotationSummary || "None"}`,
    }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  let parsed: any;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: text };
  } catch {
    parsed = { summary: text };
  }

  await db.depositionSession.update({
    where: { id: sessionId },
    data: {
      aiDepoSummary: parsed.summary || JSON.stringify(parsed),
      aiKeyTestimony: parsed.keyTestimony ? JSON.stringify(parsed.keyTestimony) : undefined,
      aiImpeachmentPoints: parsed.impeachmentPoints ? JSON.stringify(parsed.impeachmentPoints) : undefined,
    },
  });

  return parsed;
}

export async function buildExhibitIndex(sessionId: string) {
  const session = await db.depositionSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: { exhibits: { orderBy: { exhibitNumber: "asc" } } },
  });

  const index = session.exhibits.map((e: any, i: number) => ({
    number: e.exhibitNumber || `${i + 1}`,
    name: e.name,
    description: e.description,
    pageCount: e.pageCount,
    status: e.status,
    offered: e.offeredIntoEvidence || false,
    admitted: e.admitted || false,
  }));

  return { sessionId, deponentName: session.deponentName, title: session.title, exhibits: index, totalExhibits: index.length };
}

// ── Presentation ──

export async function createPresentationFromTimeline(timelineId: string, boardType: string = "TIMELINE") {
  const timeline = await db.caseTimeline.findUniqueOrThrow({
    where: { id: timelineId },
    include: { events: { orderBy: { date: "asc" } } },
  });

  const board = await db.presentationBoard.create({
    data: {
      matterId: timeline.matterId,
      title: `${timeline.title} — Presentation`,
      boardType: boardType as any,
      slides: JSON.stringify(
        timeline.events.map((e: any, i: number) => ({
          order: i + 1,
          title: e.title,
          date: e.eventDate.toISOString(),
          description: e.description,
          category: e.category,
        }))
      ),
      status: "DRAFT",
    },
  });

  return board;
}

export async function presentDepositionExhibit(sessionId: string, exhibitId: string, options?: { page?: number; zoom?: number; annotations?: boolean }) {
  const session = await db.depositionSession.findUniqueOrThrow({ where: { id: sessionId } });

  if (session.externalSessionId && session.provider === "AGILELAW") {
    const result = await agilelaw.presentExhibit(session.externalSessionId, {
      exhibitId,
      page: options?.page,
      zoom: options?.zoom,
    });

    if (!result.success) throw new Error(result.error || "Failed to present exhibit via AgileLaw");
    return { presented: true, provider: "AGILELAW", data: result.data };
  }

  return { presented: true, provider: "LOCAL", exhibitId, sessionId, options };
}
