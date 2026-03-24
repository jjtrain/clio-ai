import { db } from "@/lib/db";
import Anthropic from "@anthropic-ai/sdk";

// ==========================================
// TYPES
// ==========================================

export interface ParsedQuery {
  originalQuery: string;
  primaryTarget: EntityType | null;
  secondaryTargets: EntityType[];
  filters: SearchFilter[];
  keywords: string[];
  timeRange: TimeRange | null;
  sortBy: string | null;
  isAggregation: boolean;
  aggregationType: string | null;
  confidence: number;
}

export type EntityType =
  | "matter"
  | "contact"
  | "document"
  | "correspondence"
  | "calendarEvent"
  | "deadline"
  | "intakeSession"
  | "prediction"
  | "note"
  | "billing";

export interface SearchFilter {
  field: string;
  operator: "eq" | "contains" | "gt" | "lt" | "gte" | "lte" | "in" | "between";
  value: any;
}

export interface TimeRange {
  start?: Date;
  end?: Date;
  relative?: string; // 'today', 'this_week', 'this_month', 'last_30_days', etc.
}

export interface SearchResult {
  id: string;
  entityType: EntityType;
  title: string;
  subtitle?: string;
  matchContext?: string;
  relevanceScore: number;
  data: Record<string, any>;
}

export interface SearchResults {
  results: SearchResult[];
  totalCount: number;
  byType: Record<string, number>;
  executionTimeMs: number;
}

export interface FullSearchResponse {
  summary: string;
  results: SearchResult[];
  totalCount: number;
  byType: Record<string, number>;
  suggestions: string[];
  parsedIntent: ParsedQuery;
  executionTimeMs: number;
}

// ==========================================
// QUERY PARSER (AI-powered)
// ==========================================

const PARSE_SYSTEM_PROMPT = `You are a legal practice management search query parser. Parse the user's natural language query into structured search parameters.

Return valid JSON with this schema:
{
  "primaryTarget": one of "matter"|"contact"|"document"|"correspondence"|"calendarEvent"|"deadline"|"intakeSession"|"prediction"|"note"|"billing" or null,
  "secondaryTargets": array of entity types to also search,
  "filters": array of { "field": string, "operator": "eq"|"contains"|"gt"|"lt"|"gte"|"lte"|"in"|"between", "value": any },
  "keywords": array of search terms,
  "timeRange": { "start": "ISO date or null", "end": "ISO date or null", "relative": "today"|"this_week"|"this_month"|"last_30_days"|"last_7_days"|"last_90_days"|null } or null,
  "sortBy": "newest"|"oldest"|"relevance"|"alphabetical"|null,
  "isAggregation": boolean,
  "aggregationType": "count"|"sum"|"list"|null,
  "confidence": 0-1 float
}

Context:
- "matters" = legal cases, "OC" = opposing counsel, "PI" = personal injury
- "disco" = discovery, "SJ"/"MSJ" = summary judgment, "SOL" = statute of limitations
- "overdue deadlines" = deadlines with date < today and status != completed
- "active matters" = status is OPEN
- Status values: OPEN, CLOSED, PENDING, SETTLED
- Pipeline stages: NEW, INTAKE, ACTIVE, DISCOVERY, NEGOTIATION, LITIGATION, TRIAL, SETTLED, CLOSED
- Today's date: ${new Date().toISOString().split("T")[0]}

Only return the JSON object, nothing else.`;

export async function parseQuery(query: string): Promise<ParsedQuery> {
  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: PARSE_SYSTEM_PROMPT,
      messages: [{ role: "user", content: query }],
    });

    const text = response.content[0]?.type === "text" ? response.content[0].text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in response");

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      originalQuery: query,
      primaryTarget: parsed.primaryTarget || null,
      secondaryTargets: parsed.secondaryTargets || [],
      filters: parsed.filters || [],
      keywords: parsed.keywords || [],
      timeRange: parsed.timeRange || null,
      sortBy: parsed.sortBy || null,
      isAggregation: parsed.isAggregation || false,
      aggregationType: parsed.aggregationType || null,
      confidence: parsed.confidence || 0.5,
    };
  } catch (error) {
    // Fallback: basic keyword extraction
    return fallbackParse(query);
  }
}

function fallbackParse(query: string): ParsedQuery {
  const lower = query.toLowerCase();
  let primaryTarget: EntityType | null = null;

  if (/\b(matter|case|cases|matters)\b/.test(lower)) primaryTarget = "matter";
  else if (/\b(contact|client|attorney|counsel|judge)\b/.test(lower)) primaryTarget = "contact";
  else if (/\b(document|file|retainer|motion|contract)\b/.test(lower)) primaryTarget = "document";
  else if (/\b(email|letter|correspondence|draft)\b/.test(lower)) primaryTarget = "correspondence";
  else if (/\b(event|hearing|deposition|meeting|calendar)\b/.test(lower)) primaryTarget = "calendarEvent";
  else if (/\b(deadline|due|overdue)\b/.test(lower)) primaryTarget = "deadline";
  else if (/\b(intake|lead|screening)\b/.test(lower)) primaryTarget = "intakeSession";
  else if (/\b(prediction|outcome|score)\b/.test(lower)) primaryTarget = "prediction";
  else if (/\b(note|notes)\b/.test(lower)) primaryTarget = "note";
  else if (/\b(bill|billing|invoice|time entry|unbilled|hours)\b/.test(lower)) primaryTarget = "billing";

  const filters: SearchFilter[] = [];
  if (/\boverdue\b/.test(lower)) {
    filters.push({ field: "status", operator: "eq", value: "overdue" });
  }
  if (/\bactive\b|\bopen\b/.test(lower)) {
    filters.push({ field: "status", operator: "eq", value: "OPEN" });
  }
  if (/\bdiscovery\b/.test(lower)) {
    filters.push({ field: "pipelineStage", operator: "eq", value: "DISCOVERY" });
  }

  const stopWords = new Set(["show", "me", "all", "the", "find", "search", "for", "a", "an", "in", "on", "my", "with", "where", "that", "are", "is", "get", "list"]);
  const keywords = query
    .split(/\s+/)
    .filter((w) => w.length > 1 && !stopWords.has(w.toLowerCase()));

  return {
    originalQuery: query,
    primaryTarget,
    secondaryTargets: [],
    filters,
    keywords,
    timeRange: null,
    sortBy: null,
    isAggregation: false,
    aggregationType: null,
    confidence: 0.3,
  };
}

// ==========================================
// SYNONYM EXPANSION
// ==========================================

const BUILT_IN_SYNONYMS: Record<string, string> = {
  disco: "discovery",
  sj: "summary judgment",
  msj: "motion for summary judgment",
  oc: "opposing counsel",
  sol: "statute of limitations",
  bop: "bill of particulars",
  noi: "note of issue",
  ime: "independent medical examination",
  ebt: "examination before trial",
  rji: "request for judicial intervention",
  pi: "personal injury",
  wc: "workers compensation",
  "work comp": "workers compensation",
  mtd: "motion to dismiss",
  mtc: "motion to compel",
  tro: "temporary restraining order",
  osc: "order to show cause",
  stip: "stipulation",
  aff: "affidavit",
  cert: "certification",
  ret: "retainer agreement",
  retainer: "retainer agreement",
  "med recs": "medical record",
  "medical records": "medical record",
};

export async function expandQueryTerms(
  terms: string[],
  firmId: string
): Promise<string[]> {
  const expanded = new Set<string>();

  for (const term of terms) {
    expanded.add(term);
    const lower = term.toLowerCase();

    // Built-in synonyms
    if (BUILT_IN_SYNONYMS[lower]) {
      expanded.add(BUILT_IN_SYNONYMS[lower]);
    }

    // Check multi-word built-in synonyms
    for (const [key, val] of Object.entries(BUILT_IN_SYNONYMS)) {
      if (key.includes(lower) || lower.includes(key)) {
        expanded.add(val);
      }
    }
  }

  // Firm-specific synonyms from DB
  try {
    const dbSynonyms = await db.searchSynonym.findMany({
      where: {
        OR: [{ firmId }, { firmId: null }],
        term: { in: terms.map((t) => t.toLowerCase()) },
      },
    });
    for (const syn of dbSynonyms) {
      expanded.add(syn.canonicalTerm);
    }
  } catch {
    // DB not available, continue with built-in only
  }

  return Array.from(expanded);
}

// ==========================================
// MULTI-SOURCE SEARCH EXECUTOR
// ==========================================

export async function executeSearch(
  parsed: ParsedQuery,
  userId: string,
  firmId: string,
  limit: number = 20
): Promise<SearchResults> {
  const startTime = Date.now();

  const typesToSearch = new Set<EntityType>();
  if (parsed.primaryTarget) typesToSearch.add(parsed.primaryTarget);
  for (const t of parsed.secondaryTargets) typesToSearch.add(t);

  // If no specific target, search all types
  if (typesToSearch.size === 0) {
    const allTypes: EntityType[] = [
      "matter", "contact", "document", "correspondence",
      "calendarEvent", "deadline", "intakeSession", "prediction", "note", "billing",
    ];
    allTypes.forEach((t) => typesToSearch.add(t));
  }

  const expandedKeywords = await expandQueryTerms(parsed.keywords, firmId);

  // Execute searches in parallel
  const searchPromises: Promise<SearchResult[]>[] = [];
  for (const entityType of Array.from(typesToSearch)) {
    searchPromises.push(
      searchByEntityType(entityType, parsed.filters, expandedKeywords, parsed.timeRange, parsed.sortBy, limit, userId, firmId)
    );
  }

  const allResults = (await Promise.all(searchPromises)).flat();

  // If structured search returned nothing, fall back to full-text on SearchIndex
  if (allResults.length === 0 && parsed.keywords.length > 0) {
    const indexResults = await searchFullTextIndex(expandedKeywords, firmId, limit);
    allResults.push(...indexResults);
  }

  // Sort by relevance
  allResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Count by type
  const byType: Record<string, number> = {};
  for (const r of allResults) {
    byType[r.entityType] = (byType[r.entityType] || 0) + 1;
  }

  return {
    results: allResults.slice(0, limit),
    totalCount: allResults.length,
    byType,
    executionTimeMs: Date.now() - startTime,
  };
}

async function searchByEntityType(
  entityType: EntityType,
  filters: SearchFilter[],
  keywords: string[],
  timeRange: TimeRange | null,
  sortBy: string | null,
  limit: number,
  userId: string,
  firmId: string
): Promise<SearchResult[]> {
  try {
    switch (entityType) {
      case "matter":
        return await searchMatters(filters, keywords, timeRange, sortBy, limit, userId, firmId);
      case "contact":
        return await searchContacts(filters, keywords, timeRange, sortBy, limit, userId, firmId);
      case "document":
        return await searchDocuments(filters, keywords, timeRange, sortBy, limit, userId, firmId);
      case "correspondence":
        return await searchCorrespondence(filters, keywords, timeRange, sortBy, limit, userId, firmId);
      case "calendarEvent":
        return await searchCalendarEvents(filters, keywords, timeRange, sortBy, limit, userId, firmId);
      case "deadline":
        return await searchDeadlines(filters, keywords, timeRange, sortBy, limit, userId, firmId);
      case "intakeSession":
        return await searchIntakeSessions(filters, keywords, timeRange, sortBy, limit, userId, firmId);
      case "prediction":
        return await searchPredictions(filters, keywords, timeRange, sortBy, limit, userId, firmId);
      case "note":
        return await searchNotes(filters, keywords, timeRange, sortBy, limit, userId, firmId);
      case "billing":
        return await searchBilling(filters, keywords, timeRange, sortBy, limit, userId, firmId);
      default:
        return [];
    }
  } catch {
    return [];
  }
}

// ==========================================
// SOURCE-SPECIFIC SEARCH EXECUTORS
// ==========================================

function buildKeywordFilter(keywords: string[], fields: string[]) {
  if (keywords.length === 0) return undefined;
  return {
    OR: keywords.flatMap((kw) =>
      fields.map((field) => ({ [field]: { contains: kw, mode: "insensitive" as const } }))
    ),
  };
}

function buildTimeFilter(timeRange: TimeRange | null, dateField: string) {
  if (!timeRange) return undefined;
  const now = new Date();
  let start = timeRange.start ? new Date(timeRange.start) : undefined;
  let end = timeRange.end ? new Date(timeRange.end) : undefined;

  if (timeRange.relative) {
    end = now;
    switch (timeRange.relative) {
      case "today":
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "this_week":
        start = new Date(now);
        start.setDate(now.getDate() - now.getDay());
        break;
      case "this_month":
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "last_7_days":
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case "last_30_days":
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
      case "last_90_days":
        start = new Date(now);
        start.setDate(now.getDate() - 90);
        break;
    }
  }

  if (!start && !end) return undefined;
  const filter: any = {};
  if (start) filter.gte = start;
  if (end) filter.lte = end;
  return { [dateField]: filter };
}

async function searchMatters(
  filters: SearchFilter[], keywords: string[], timeRange: TimeRange | null,
  sortBy: string | null, limit: number, userId: string, firmId: string
): Promise<SearchResult[]> {
  const where: any = {};
  const kwFilter = buildKeywordFilter(keywords, ["name", "matterNumber", "description", "practiceArea"]);
  if (kwFilter) Object.assign(where, kwFilter);

  const timeFilter = buildTimeFilter(timeRange, "createdAt");
  if (timeFilter) Object.assign(where, timeFilter);

  for (const f of filters) {
    if (f.field === "status") {
      where.status = f.value === "overdue" ? undefined : f.value;
    }
    if (f.field === "pipelineStage") where.pipelineStage = f.value;
    if (f.field === "practiceArea") where.practiceArea = { contains: f.value, mode: "insensitive" };
  }

  const matters = await db.matter.findMany({
    where,
    include: { client: { select: { name: true } } },
    take: limit,
    orderBy: sortBy === "newest" ? { createdAt: "desc" } : sortBy === "oldest" ? { createdAt: "asc" } : sortBy === "alphabetical" ? { name: "asc" } : { updatedAt: "desc" },
  });

  return matters.map((m, i) => ({
    id: m.id,
    entityType: "matter" as EntityType,
    title: m.name,
    subtitle: `${m.matterNumber} · ${m.practiceArea || "General"} · ${m.status}`,
    matchContext: m.description?.slice(0, 150) || undefined,
    relevanceScore: calculateRelevance(m.name, keywords, 100 - i),
    data: {
      caseNumber: m.matterNumber,
      practiceArea: m.practiceArea,
      status: m.status,
      pipelineStage: m.pipelineStage,
      clientName: m.client?.name,
      openDate: m.openDate,
    },
  }));
}

async function searchContacts(
  filters: SearchFilter[], keywords: string[], timeRange: TimeRange | null,
  sortBy: string | null, limit: number, userId: string, firmId: string
): Promise<SearchResult[]> {
  const where: any = { firmId };
  const kwFilter = buildKeywordFilter(keywords, ["name", "email", "firm", "notes"]);
  if (kwFilter) Object.assign(where, kwFilter);

  for (const f of filters) {
    if (f.field === "contactType") where.contactType = f.value;
  }

  const contacts = await db.correspondenceContact.findMany({
    where,
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  return contacts.map((c, i) => ({
    id: c.id,
    entityType: "contact" as EntityType,
    title: c.name,
    subtitle: `${c.contactType} ${c.firm ? `· ${c.firm}` : ""} ${c.email ? `· ${c.email}` : ""}`.trim(),
    relevanceScore: calculateRelevance(c.name, keywords, 90 - i),
    data: {
      type: c.contactType,
      firm: c.firm,
      email: c.email,
      phone: c.phone,
      lastContacted: c.lastContacted,
    },
  }));
}

async function searchDocuments(
  filters: SearchFilter[], keywords: string[], timeRange: TimeRange | null,
  sortBy: string | null, limit: number, userId: string, firmId: string
): Promise<SearchResult[]> {
  const where: any = { firmId };
  const kwFilter = buildKeywordFilter(keywords, ["documentName", "documentType", "extractedText"]);
  if (kwFilter) Object.assign(where, kwFilter);

  const timeFilter = buildTimeFilter(timeRange, "createdAt");
  if (timeFilter) Object.assign(where, timeFilter);

  for (const f of filters) {
    if (f.field === "documentType") where.documentType = { contains: f.value, mode: "insensitive" };
    if (f.field === "reviewStatus") where.reviewStatus = f.value;
  }

  const docs = await db.documentReview.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return docs.map((d, i) => ({
    id: d.id,
    entityType: "document" as EntityType,
    title: d.documentName,
    subtitle: `${d.documentType} · ${d.reviewStatus}`,
    matchContext: d.extractedText?.slice(0, 150) || d.summaryText?.slice(0, 150) || undefined,
    relevanceScore: calculateRelevance(d.documentName, keywords, 85 - i),
    data: {
      documentType: d.documentType,
      reviewStatus: d.reviewStatus,
      pageCount: d.pageCount,
      totalFlags: d.totalFlags,
      matterId: d.matterId,
      createdAt: d.createdAt,
    },
  }));
}

async function searchCorrespondence(
  filters: SearchFilter[], keywords: string[], timeRange: TimeRange | null,
  sortBy: string | null, limit: number, userId: string, firmId: string
): Promise<SearchResult[]> {
  const where: any = { firmId };
  const kwFilter = buildKeywordFilter(keywords, ["subject", "body", "recipientName", "matterName"]);
  if (kwFilter) Object.assign(where, kwFilter);

  const timeFilter = buildTimeFilter(timeRange, "createdAt");
  if (timeFilter) Object.assign(where, timeFilter);

  for (const f of filters) {
    if (f.field === "status") where.status = f.value;
    if (f.field === "correspondenceType") where.correspondenceType = f.value;
  }

  const items = await db.correspondenceDraft.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return items.map((c, i) => ({
    id: c.id,
    entityType: "correspondence" as EntityType,
    title: c.subject || `${c.correspondenceType} to ${c.recipientName || "Unknown"}`,
    subtitle: `${c.correspondenceType} · To: ${c.recipientName || "N/A"} · ${c.status}`,
    matchContext: c.body?.slice(0, 150) || undefined,
    relevanceScore: calculateRelevance(c.subject || "", keywords, 80 - i),
    data: {
      type: c.correspondenceType,
      recipientName: c.recipientName,
      matterName: c.matterName,
      status: c.status,
      sentAt: c.sentAt,
    },
  }));
}

async function searchCalendarEvents(
  filters: SearchFilter[], keywords: string[], timeRange: TimeRange | null,
  sortBy: string | null, limit: number, userId: string, firmId: string
): Promise<SearchResult[]> {
  const where: any = {};
  const kwFilter = buildKeywordFilter(keywords, ["title", "description", "location"]);
  if (kwFilter) Object.assign(where, kwFilter);

  const timeFilter = buildTimeFilter(timeRange, "startTime");
  if (timeFilter) Object.assign(where, timeFilter);

  for (const f of filters) {
    if (f.field === "eventType") where.eventType = f.value;
  }

  const events = await db.calendarEvent.findMany({
    where,
    include: { matter: { select: { name: true } } },
    take: limit,
    orderBy: { startTime: "desc" },
  });

  return events.map((e, i) => ({
    id: e.id,
    entityType: "calendarEvent" as EntityType,
    title: e.title,
    subtitle: `${e.startTime.toLocaleDateString()} · ${e.location || "No location"} ${e.matter ? `· ${e.matter.name}` : ""}`,
    matchContext: e.description?.slice(0, 150) || undefined,
    relevanceScore: calculateRelevance(e.title, keywords, 75 - i),
    data: {
      startTime: e.startTime,
      endTime: e.endTime,
      location: e.location,
      matterName: e.matter?.name,
      eventType: (e as any).eventType,
    },
  }));
}

async function searchDeadlines(
  filters: SearchFilter[], keywords: string[], timeRange: TimeRange | null,
  sortBy: string | null, limit: number, userId: string, firmId: string
): Promise<SearchResult[]> {
  const where: any = { firmId };
  const kwFilter = buildKeywordFilter(keywords, ["name", "description", "category", "ruleReference"]);
  if (kwFilter) Object.assign(where, kwFilter);

  const now = new Date();
  for (const f of filters) {
    if (f.field === "status") {
      if (f.value === "overdue") {
        where.deadlineDate = { lt: now };
        where.status = { not: "completed" };
      } else {
        where.status = f.value;
      }
    }
    if (f.field === "category") where.category = { contains: f.value, mode: "insensitive" };
    if (f.field === "priority") where.priority = f.value;
  }

  const deadlines = await db.calculatedDeadline.findMany({
    where,
    take: limit,
    orderBy: { deadlineDate: "asc" },
  });

  return deadlines.map((d, i) => {
    const daysRemaining = Math.ceil((d.deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isOverdue = daysRemaining < 0 && d.status !== "completed";

    return {
      id: d.id,
      entityType: "deadline" as EntityType,
      title: d.name,
      subtitle: `${d.category} · ${d.deadlineDate.toLocaleDateString()} · ${isOverdue ? "OVERDUE" : d.status}`,
      matchContext: d.description?.slice(0, 150) || d.ruleReference || undefined,
      relevanceScore: calculateRelevance(d.name, keywords, isOverdue ? 95 : 70) - i,
      data: {
        category: d.category,
        deadlineDate: d.deadlineDate,
        status: isOverdue ? "overdue" : d.status,
        priority: d.priority,
        daysRemaining,
        ruleReference: d.ruleReference,
        chainId: d.chainId,
        matterId: d.matterId,
      },
    };
  });
}

async function searchIntakeSessions(
  filters: SearchFilter[], keywords: string[], timeRange: TimeRange | null,
  sortBy: string | null, limit: number, userId: string, firmId: string
): Promise<SearchResult[]> {
  const where: any = { firmId };
  const kwFilter = buildKeywordFilter(keywords, ["practiceArea", "aiSummary"]);
  if (kwFilter) Object.assign(where, kwFilter);

  const timeFilter = buildTimeFilter(timeRange, "createdAt");
  if (timeFilter) Object.assign(where, timeFilter);

  for (const f of filters) {
    if (f.field === "leadGrade") where.leadGrade = f.value;
    if (f.field === "status") where.status = f.value;
    if (f.field === "practiceArea") where.practiceArea = { contains: f.value, mode: "insensitive" };
    if (f.field === "source") where.source = f.value;
  }

  const sessions = await db.intakeSession.findMany({
    where,
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return sessions.map((s, i) => {
    const contactInfo = s.contactInfo as any;
    const contactName = contactInfo ? `${contactInfo.firstName || ""} ${contactInfo.lastName || ""}`.trim() : "Anonymous";

    return {
      id: s.id,
      entityType: "intakeSession" as EntityType,
      title: contactName || "Anonymous Lead",
      subtitle: `${s.practiceArea || "Unknown"} · Grade: ${s.leadGrade || "N/A"} · ${s.status}`,
      matchContext: s.aiSummary?.slice(0, 150) || undefined,
      relevanceScore: calculateRelevance(contactName, keywords, 65 - i),
      data: {
        practiceArea: s.practiceArea,
        leadGrade: s.leadGrade,
        score: s.leadScore,
        status: s.status,
        source: s.source,
        date: s.createdAt,
      },
    };
  });
}

async function searchPredictions(
  filters: SearchFilter[], keywords: string[], timeRange: TimeRange | null,
  sortBy: string | null, limit: number, userId: string, firmId: string
): Promise<SearchResult[]> {
  const where: any = { firmId };
  const kwFilter = buildKeywordFilter(keywords, ["matterName", "practiceArea", "overallLabel"]);
  if (kwFilter) Object.assign(where, kwFilter);

  for (const f of filters) {
    if (f.field === "overallScore" && f.operator === "lt") where.overallScore = { lt: f.value };
    if (f.field === "overallScore" && f.operator === "gt") where.overallScore = { gt: f.value };
    if (f.field === "practiceArea") where.practiceArea = { contains: f.value, mode: "insensitive" };
  }

  const predictions = await db.matterPrediction.findMany({
    where,
    take: limit,
    orderBy: { overallScore: "desc" },
  });

  return predictions.map((p, i) => ({
    id: p.id,
    entityType: "prediction" as EntityType,
    title: p.matterName || `Prediction ${p.id.slice(0, 8)}`,
    subtitle: `Score: ${p.overallScore} · ${p.overallLabel} · ${p.practiceArea}`,
    relevanceScore: calculateRelevance(p.matterName || "", keywords, 60 - i),
    data: {
      overallScore: p.overallScore,
      overallLabel: p.overallLabel,
      practiceArea: p.practiceArea,
      settlementRange: p.settlementRange,
      riskAlerts: p.riskAlerts,
      matterId: p.matterId,
    },
  }));
}

async function searchNotes(
  filters: SearchFilter[], keywords: string[], timeRange: TimeRange | null,
  sortBy: string | null, limit: number, userId: string, firmId: string
): Promise<SearchResult[]> {
  // Search in MatterActivity for notes
  const where: any = { type: "NOTE" };
  const kwFilter = buildKeywordFilter(keywords, ["description"]);
  if (kwFilter) Object.assign(where, kwFilter);

  const timeFilter = buildTimeFilter(timeRange, "createdAt");
  if (timeFilter) Object.assign(where, timeFilter);

  const notes = await db.matterActivity.findMany({
    where,
    include: { matter: { select: { name: true } } },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  return notes.map((n, i) => ({
    id: n.id,
    entityType: "note" as EntityType,
    title: `Note on ${n.matter.name}`,
    subtitle: `${n.createdAt.toLocaleDateString()}`,
    matchContext: n.description?.slice(0, 150) || undefined,
    relevanceScore: calculateRelevance(n.description || "", keywords, 55 - i),
    data: {
      matterName: n.matter.name,
      matterId: n.matterId,
      date: n.createdAt,
      content: n.description,
    },
  }));
}

async function searchBilling(
  filters: SearchFilter[], keywords: string[], timeRange: TimeRange | null,
  sortBy: string | null, limit: number, userId: string, firmId: string
): Promise<SearchResult[]> {
  const where: any = {};
  const kwFilter = buildKeywordFilter(keywords, ["description"]);
  if (kwFilter) Object.assign(where, kwFilter);

  const timeFilter = buildTimeFilter(timeRange, "date");
  if (timeFilter) Object.assign(where, timeFilter);

  for (const f of filters) {
    if (f.field === "status") {
      if (f.value === "unbilled") where.invoiceId = null;
    }
  }

  const entries = await db.timeEntry.findMany({
    where,
    include: { matter: { select: { name: true } } },
    take: limit,
    orderBy: { date: "desc" },
  });

  return entries.map((e, i) => ({
    id: e.id,
    entityType: "billing" as EntityType,
    title: e.description,
    subtitle: `${e.matter.name} · ${e.hours}h · $${(e.hours * Number(e.rate || 0)).toFixed(2)}`,
    relevanceScore: calculateRelevance(e.description, keywords, 50 - i),
    data: {
      hours: e.hours,
      rate: e.rate,
      amount: e.hours * Number(e.rate || 0),
      matterName: e.matter.name,
      matterId: e.matterId,
      date: e.date,
      isBilled: !!e.invoiceId,
    },
  }));
}

// ==========================================
// FULL-TEXT INDEX SEARCH (FALLBACK)
// ==========================================

async function searchFullTextIndex(
  keywords: string[],
  firmId: string,
  limit: number
): Promise<SearchResult[]> {
  if (keywords.length === 0) return [];

  const where: any = {
    firmId,
    OR: keywords.flatMap((kw) => [
      { title: { contains: kw, mode: "insensitive" } },
      { subtitle: { contains: kw, mode: "insensitive" } },
      { body: { contains: kw, mode: "insensitive" } },
    ]),
  };

  const entries = await db.searchIndex.findMany({
    where,
    take: limit,
    orderBy: { updatedAt: "desc" },
  });

  return entries.map((e, i) => {
    // Determine relevance tier
    let score = 50;
    const kwLower = keywords.map((k) => k.toLowerCase());
    if (kwLower.some((k) => e.title.toLowerCase().includes(k))) score = 90;
    else if (e.subtitle && kwLower.some((k) => e.subtitle!.toLowerCase().includes(k))) score = 70;
    else if (e.body && kwLower.some((k) => e.body!.toLowerCase().includes(k))) score = 50;

    return {
      id: e.entityId,
      entityType: e.entityType as EntityType,
      title: e.title,
      subtitle: e.subtitle || undefined,
      matchContext: e.body?.slice(0, 150) || undefined,
      relevanceScore: score - i,
      data: (e.metadata as Record<string, any>) || {},
    };
  });
}

// ==========================================
// RELEVANCE SCORING
// ==========================================

function calculateRelevance(text: string, keywords: string[], baseScore: number): number {
  if (keywords.length === 0) return baseScore;

  const lower = text.toLowerCase();
  let bonus = 0;

  for (const kw of keywords) {
    const kwLower = kw.toLowerCase();
    if (lower === kwLower) bonus += 50; // exact match
    else if (lower.startsWith(kwLower)) bonus += 30;
    else if (lower.includes(kwLower)) bonus += 15;
  }

  return Math.min(baseScore + bonus, 100);
}

// ==========================================
// AI RESULT SUMMARIZER
// ==========================================

export async function summarizeResults(
  query: string,
  results: SearchResult[],
  parsedIntent: ParsedQuery
): Promise<string> {
  if (results.length === 0) {
    return `I couldn't find anything matching "${query}". Try broadening your search or using different terms.`;
  }

  try {
    const anthropic = new Anthropic();
    const resultSummary = results.slice(0, 10).map((r) =>
      `[${r.entityType}] ${r.title} ${r.subtitle ? `(${r.subtitle})` : ""}`
    ).join("\n");

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      system: "You are a legal practice management assistant. Summarize search results in 1-3 concise sentences. Be specific and mention key details like counts, names, and statuses. Do not use markdown.",
      messages: [{
        role: "user",
        content: `Query: "${query}"\nTotal results: ${results.length}\nTop results:\n${resultSummary}\n\nProvide a natural language summary.`,
      }],
    });

    return response.content[0]?.type === "text" ? response.content[0].text : `Found ${results.length} results for "${query}".`;
  } catch {
    // Fallback summary
    const types = Object.entries(
      results.reduce<Record<string, number>>((acc, r) => {
        acc[r.entityType] = (acc[r.entityType] || 0) + 1;
        return acc;
      }, {})
    )
      .map(([type, count]) => `${count} ${type}${count !== 1 ? "s" : ""}`)
      .join(", ");

    return `Found ${results.length} results (${types}) matching "${query}".`;
  }
}

// ==========================================
// CONTEXTUAL SUGGESTIONS
// ==========================================

export function generateQuerySuggestions(
  query: string,
  results: SearchResult[]
): string[] {
  const suggestions: string[] = [];
  const types = new Set(results.map((r) => r.entityType));

  if (types.has("matter")) {
    const matterName = results.find((r) => r.entityType === "matter")?.title;
    if (matterName) {
      suggestions.push(`Show deadlines for ${matterName}`);
      suggestions.push(`Who is opposing counsel on ${matterName}?`);
    }
  }

  if (types.has("contact")) {
    const contactName = results.find((r) => r.entityType === "contact")?.title;
    if (contactName) {
      suggestions.push(`Show all matters with ${contactName}`);
      suggestions.push(`Last correspondence with ${contactName}`);
    }
  }

  if (types.has("deadline")) {
    suggestions.push("Which of these are overdue?");
    suggestions.push("Show the matters these deadlines belong to");
  }

  if (types.has("document")) {
    suggestions.push("Show related matters for these documents");
  }

  if (results.length === 0) {
    suggestions.push("Show me all active matters");
    suggestions.push("Find overdue deadlines");
    suggestions.push("List recent documents");
  }

  return suggestions.slice(0, 4);
}

// ==========================================
// SEARCH INDEX BUILDER
// ==========================================

export async function buildSearchIndex(firmId: string): Promise<number> {
  let count = 0;

  // Index matters
  const matters = await db.matter.findMany({
    include: { client: true },
  });
  for (const m of matters) {
    await db.searchIndex.upsert({
      where: { entityType_entityId: { entityType: "matter", entityId: m.id } },
      create: {
        entityType: "matter",
        entityId: m.id,
        title: m.name,
        subtitle: `${m.matterNumber} · ${m.practiceArea || "General"} · ${m.status}`,
        body: [m.description, m.client?.name, m.practiceArea].filter(Boolean).join(" "),
        tags: [m.practiceArea, m.status, m.pipelineStage].filter(Boolean) as any,
        metadata: { practiceArea: m.practiceArea, status: m.status, pipelineStage: m.pipelineStage },
        firmId,
      },
      update: {
        title: m.name,
        subtitle: `${m.matterNumber} · ${m.practiceArea || "General"} · ${m.status}`,
        body: [m.description, m.client?.name, m.practiceArea].filter(Boolean).join(" "),
        tags: [m.practiceArea, m.status, m.pipelineStage].filter(Boolean) as any,
        metadata: { practiceArea: m.practiceArea, status: m.status, pipelineStage: m.pipelineStage },
      },
    });
    count++;
  }

  // Index contacts
  const contacts = await db.correspondenceContact.findMany({ where: { firmId } });
  for (const c of contacts) {
    await db.searchIndex.upsert({
      where: { entityType_entityId: { entityType: "contact", entityId: c.id } },
      create: {
        entityType: "contact",
        entityId: c.id,
        title: c.name,
        subtitle: `${c.contactType} ${c.firm ? `· ${c.firm}` : ""}`,
        body: [c.name, c.firm, c.email, c.notes].filter(Boolean).join(" "),
        tags: [c.contactType],
        firmId,
      },
      update: {
        title: c.name,
        subtitle: `${c.contactType} ${c.firm ? `· ${c.firm}` : ""}`,
        body: [c.name, c.firm, c.email, c.notes].filter(Boolean).join(" "),
        tags: [c.contactType],
      },
    });
    count++;
  }

  // Index documents
  const docs = await db.documentReview.findMany({ where: { firmId } });
  for (const d of docs) {
    await db.searchIndex.upsert({
      where: { entityType_entityId: { entityType: "document", entityId: d.id } },
      create: {
        entityType: "document",
        entityId: d.id,
        title: d.documentName,
        subtitle: `${d.documentType} · ${d.reviewStatus}`,
        body: d.extractedText?.slice(0, 2000) || d.summaryText || "",
        tags: [d.documentType, d.reviewStatus].filter(Boolean),
        firmId,
      },
      update: {
        title: d.documentName,
        subtitle: `${d.documentType} · ${d.reviewStatus}`,
        body: d.extractedText?.slice(0, 2000) || d.summaryText || "",
        tags: [d.documentType, d.reviewStatus].filter(Boolean),
      },
    });
    count++;
  }

  // Index correspondence
  const corr = await db.correspondenceDraft.findMany({ where: { firmId } });
  for (const c of corr) {
    await db.searchIndex.upsert({
      where: { entityType_entityId: { entityType: "correspondence", entityId: c.id } },
      create: {
        entityType: "correspondence",
        entityId: c.id,
        title: c.subject || `${c.correspondenceType} to ${c.recipientName}`,
        subtitle: `${c.correspondenceType} · ${c.status}`,
        body: c.body?.slice(0, 2000) || "",
        tags: [c.correspondenceType, c.status].filter(Boolean),
        firmId,
      },
      update: {
        title: c.subject || `${c.correspondenceType} to ${c.recipientName}`,
        subtitle: `${c.correspondenceType} · ${c.status}`,
        body: c.body?.slice(0, 2000) || "",
        tags: [c.correspondenceType, c.status].filter(Boolean),
      },
    });
    count++;
  }

  // Index deadlines
  const deadlines = await db.calculatedDeadline.findMany({ where: { firmId } });
  for (const d of deadlines) {
    await db.searchIndex.upsert({
      where: { entityType_entityId: { entityType: "deadline", entityId: d.id } },
      create: {
        entityType: "deadline",
        entityId: d.id,
        title: d.name,
        subtitle: `${d.category} · ${d.deadlineDate.toLocaleDateString()} · ${d.status}`,
        body: [d.description, d.ruleReference].filter(Boolean).join(" "),
        tags: [d.category, d.status, d.priority].filter(Boolean),
        firmId,
      },
      update: {
        title: d.name,
        subtitle: `${d.category} · ${d.deadlineDate.toLocaleDateString()} · ${d.status}`,
        body: [d.description, d.ruleReference].filter(Boolean).join(" "),
        tags: [d.category, d.status, d.priority].filter(Boolean),
      },
    });
    count++;
  }

  // Index calendar events
  const events = await db.calendarEvent.findMany({
    include: { matter: { select: { name: true } } },
  });
  for (const e of events) {
    await db.searchIndex.upsert({
      where: { entityType_entityId: { entityType: "calendarEvent", entityId: e.id } },
      create: {
        entityType: "calendarEvent",
        entityId: e.id,
        title: e.title,
        subtitle: `${e.startTime.toLocaleDateString()} · ${e.location || ""}`,
        body: [e.description, e.matter?.name, e.location].filter(Boolean).join(" "),
        tags: [(e as any).eventType].filter(Boolean),
        firmId,
      },
      update: {
        title: e.title,
        subtitle: `${e.startTime.toLocaleDateString()} · ${e.location || ""}`,
        body: [e.description, e.matter?.name, e.location].filter(Boolean).join(" "),
        tags: [(e as any).eventType].filter(Boolean),
      },
    });
    count++;
  }

  // Index intake sessions
  const sessions = await db.intakeSession.findMany({ where: { firmId } });
  for (const s of sessions) {
    const contactInfo = s.contactInfo as any;
    const contactName = contactInfo ? `${contactInfo.firstName || ""} ${contactInfo.lastName || ""}`.trim() : "";
    await db.searchIndex.upsert({
      where: { entityType_entityId: { entityType: "intakeSession", entityId: s.id } },
      create: {
        entityType: "intakeSession",
        entityId: s.id,
        title: contactName || "Anonymous Lead",
        subtitle: `${s.practiceArea || ""} · Grade: ${s.leadGrade || "N/A"}`,
        body: s.aiSummary || "",
        tags: [s.practiceArea, s.leadGrade, s.status].filter(Boolean),
        firmId,
      },
      update: {
        title: contactName || "Anonymous Lead",
        subtitle: `${s.practiceArea || ""} · Grade: ${s.leadGrade || "N/A"}`,
        body: s.aiSummary || "",
        tags: [s.practiceArea, s.leadGrade, s.status].filter(Boolean),
      },
    });
    count++;
  }

  return count;
}

export async function updateSearchIndexEntry(
  entityType: string,
  entityId: string,
  firmId: string
): Promise<void> {
  // Delegate to appropriate indexer based on type
  try {
    switch (entityType) {
      case "matter": {
        const m = await db.matter.findUnique({ where: { id: entityId }, include: { client: true } });
        if (!m) return;
        await db.searchIndex.upsert({
          where: { entityType_entityId: { entityType: "matter", entityId } },
          create: {
            entityType: "matter", entityId,
            title: m.name,
            subtitle: `${m.matterNumber} · ${m.practiceArea || "General"} · ${m.status}`,
            body: [m.description, m.client?.name].filter(Boolean).join(" "),
            tags: [m.practiceArea, m.status].filter(Boolean),
            metadata: { practiceArea: m.practiceArea, status: m.status },
            firmId,
          },
          update: {
            title: m.name,
            subtitle: `${m.matterNumber} · ${m.practiceArea || "General"} · ${m.status}`,
            body: [m.description, m.client?.name].filter(Boolean).join(" "),
            tags: [m.practiceArea, m.status].filter(Boolean),
            metadata: { practiceArea: m.practiceArea, status: m.status },
          },
        });
        break;
      }
      // Other types follow same pattern - index on demand
      default:
        break;
    }
  } catch {
    // Non-critical - log and continue
    console.error(`Failed to update search index for ${entityType}:${entityId}`);
  }
}
