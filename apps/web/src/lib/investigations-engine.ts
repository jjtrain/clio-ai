import { db } from "@/lib/db";
import * as tracers from "@/lib/integrations/tracers";
import * as sonar from "@/lib/integrations/sonar";
import * as mediascope from "@/lib/integrations/mediascope";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const MODEL = "claude-sonnet-4-20250514";

const SEARCH_TYPE_TO_TRACERS: Record<string, (params: any) => Promise<any>> = {
  PERSON_LOCATE: tracers.personSearch,
  SKIP_TRACE: tracers.skipTrace,
  ASSET_SEARCH: tracers.assetSearch,
  BACKGROUND_CHECK: tracers.backgroundCheck,
  CRIMINAL_RECORDS: tracers.criminalSearch,
  COURT_RECORDS: tracers.courtRecords,
  BANKRUPTCY: tracers.bankruptcySearch,
  LIENS_JUDGMENTS: tracers.liensJudgments,
  PROPERTY_RECORDS: tracers.propertySearch,
  VEHICLE_RECORDS: tracers.vehicleSearch,
  BUSINESS_SEARCH: tracers.businessSearch,
  UCC_FILINGS: tracers.uccSearch,
  PHONE_LOOKUP: tracers.phoneLookup,
  EMAIL_LOOKUP: tracers.emailLookup,
  ADDRESS_HISTORY: tracers.addressHistory,
  DEATH_RECORDS: tracers.deathSearch,
  PROFESSIONAL_LICENSE: tracers.professionalLicense,
  IDENTITY_VERIFICATION: tracers.identityVerification,
  COMPREHENSIVE: tracers.comprehensiveSearch,
};

// ── Core search router ──

export async function runSearch(params: {
  searchType: string; subject: string; inputs: Record<string, any>;
  matterId?: string; clientId?: string; requestedBy?: string;
}) {
  const isVisual = ["VISUAL_ASSET_SEARCH", "BRAND_MONITORING", "TRADEMARK_SEARCH"].includes(params.searchType);
  const provider = isVisual ? "MEDIASCOPE" : "TRACERS";

  const search = await db.investigationSearch.create({
    data: {
      provider: provider as any,
      searchType: params.searchType as any,
      searchSubject: params.subject,
      searchInputs: JSON.stringify(params.inputs),
      matterId: params.matterId,
      clientId: params.clientId,
      requestedBy: params.requestedBy,
      status: "PROCESSING",
    },
  });

  let result: any;
  if (isVisual) {
    const fn = params.searchType === "TRADEMARK_SEARCH" ? mediascope.searchTrademark
      : params.searchType === "BRAND_MONITORING" ? mediascope.searchLogo
      : mediascope.searchByImage;
    result = await fn(params.inputs);
  } else {
    const fn = SEARCH_TYPE_TO_TRACERS[params.searchType] || tracers.personSearch;
    result = await fn(params.inputs);
  }

  if (!result.success) {
    await db.investigationSearch.update({ where: { id: search.id }, data: { status: "FAILED", notes: result.error } });
    return { success: false, error: result.error, searchId: search.id };
  }

  const data = result.data;
  const records = Array.isArray(data.results) ? data.results : data.records ? data.records : [data];

  await db.investigationSearch.update({
    where: { id: search.id },
    data: {
      status: "COMPLETED",
      externalSearchId: data.search_id || data.id,
      results: JSON.stringify(data),
      resultCount: records.length,
      rawPayload: JSON.stringify(data),
    },
  });

  // Create records
  if (isVisual) {
    for (const m of records) {
      await db.visualAssetMatch.create({
        data: {
          searchId: search.id, matterId: params.matterId,
          matchType: (m.match_type || "IMAGE") as any,
          matchUrl: m.url || m.match_url || "",
          matchPageTitle: m.page_title, matchDomain: m.domain, matchImageUrl: m.image_url,
          originalAssetUrl: m.original_url,
          similarityScore: m.similarity_score || m.confidence || 0,
          matchDate: m.found_date ? new Date(m.found_date) : new Date(),
          platform: m.platform,
          potentialInfringement: m.potential_infringement || false,
          status: "NEW",
        },
      });
    }
  } else if (records.length > 0) {
    const r = records[0];
    await db.personRecord.create({
      data: {
        searchId: search.id, provider: "TRACERS", matterId: params.matterId,
        externalRecordId: r.id || r.record_id,
        fullName: r.full_name || r.name || params.subject,
        firstName: r.first_name, middleName: r.middle_name, lastName: r.last_name,
        dateOfBirth: r.date_of_birth ? new Date(r.date_of_birth) : undefined,
        age: r.age ? parseInt(r.age) : undefined,
        currentAddress: r.current_address ? JSON.stringify(r.current_address) : undefined,
        currentCity: r.city, currentState: r.state, currentZip: r.zip,
        phones: r.phones ? JSON.stringify(r.phones) : undefined,
        emails: r.emails ? JSON.stringify(r.emails) : undefined,
        criminalRecords: r.criminal_records ? JSON.stringify(r.criminal_records) : undefined,
        properties: r.properties ? JSON.stringify(r.properties) : undefined,
      },
    });
  }

  // Generate AI summary
  await generateSearchSummary(search.id);

  return { success: true, searchId: search.id, resultCount: records.length };
}

// ── Comprehensive person search ──

export async function runComprehensivePersonSearch(params: {
  subject: string; inputs: Record<string, any>;
  matterId?: string; clientId?: string; requestedBy?: string;
}) {
  const [tracersResult, sonarResult] = await Promise.all([
    tracers.comprehensiveSearch(params.inputs),
    sonar.identifyProspect(params.inputs),
  ]);

  const search = await db.investigationSearch.create({
    data: {
      provider: "TRACERS",
      searchType: "COMPREHENSIVE",
      searchSubject: params.subject,
      searchInputs: JSON.stringify(params.inputs),
      matterId: params.matterId,
      clientId: params.clientId,
      requestedBy: params.requestedBy,
      status: tracersResult.success || sonarResult.success ? "COMPLETED" : "FAILED",
      results: JSON.stringify({ tracers: tracersResult.success ? tracersResult.data : null, sonar: sonarResult.success ? sonarResult.data : null }),
      resultCount: (tracersResult.success ? 1 : 0) + (sonarResult.success ? 1 : 0),
    },
  });

  // Merge and deduplicate into a single PersonRecord
  const t = tracersResult.success ? tracersResult.data : {} as any;
  const s = sonarResult.success ? sonarResult.data : {} as any;

  await db.personRecord.create({
    data: {
      searchId: search.id, provider: "TRACERS", matterId: params.matterId,
      fullName: t.full_name || s.name || params.subject,
      firstName: t.first_name || s.first_name,
      lastName: t.last_name || s.last_name,
      dateOfBirth: t.date_of_birth ? new Date(t.date_of_birth) : undefined,
      currentAddress: t.current_address ? JSON.stringify(t.current_address) : undefined,
      currentCity: t.city || s.city,
      currentState: t.state || s.state,
      currentZip: t.zip || s.zip,
      phones: JSON.stringify([...(t.phones || []), ...(s.phones || [])].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)),
      emails: JSON.stringify([...(t.emails || []), ...(s.emails || [])].filter((v: string, i: number, a: string[]) => a.indexOf(v) === i)),
      criminalRecords: t.criminal_records ? JSON.stringify(t.criminal_records) : undefined,
      courtCases: t.court_cases || s.incidents ? JSON.stringify([...(t.court_cases || []), ...(s.incidents || [])]) : undefined,
      properties: t.properties ? JSON.stringify(t.properties) : undefined,
      vehicles: t.vehicles ? JSON.stringify(t.vehicles) : undefined,
    },
  });

  await generateSearchSummary(search.id);

  return { success: true, searchId: search.id };
}

// ── AI summary generation ──

export async function generateSearchSummary(searchId: string) {
  const search = await db.investigationSearch.findUniqueOrThrow({
    where: { id: searchId },
    include: { personRecords: true, visualAssetMatches: true },
  });

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: "You are a professional investigative analyst working for a law firm. Summarize search results clearly and concisely, highlighting key findings relevant to legal proceedings. Flag any concerns or inconsistencies. Use plain language suitable for attorneys.",
    messages: [{
      role: "user",
      content: `Summarize these investigation search results:\n\nSearch type: ${search.searchType}\nSubject: ${search.searchSubject}\nResults: ${search.results || "No results"}\n\nPerson records: ${JSON.stringify(search.personRecords.map(r => ({ name: r.fullName, address: r.currentAddress, city: r.currentCity, state: r.currentState })))}\n\nVisual matches: ${search.visualAssetMatches.length} found`,
    }],
  });

  const summary = message.content[0].type === "text" ? message.content[0].text : "";

  await db.investigationSearch.update({ where: { id: searchId }, data: { resultSummary: summary } });

  return summary;
}

// ── Visual asset report ──

export async function generateVisualAssetReport(matterId: string) {
  const matches = await db.visualAssetMatch.findMany({ where: { matterId } });
  if (!matches.length) return { success: false, error: "No visual asset matches found for this matter." };

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: "You are an IP enforcement analyst. Generate a comprehensive visual asset infringement report suitable for attorney review. Include match details, infringement assessment, and recommended actions.",
    messages: [{
      role: "user",
      content: `Generate an infringement report for ${matches.length} visual asset matches:\n\n${JSON.stringify(matches.map(m => ({ type: m.matchType, url: m.matchUrl, domain: m.matchDomain, similarity: m.similarityScore.toString(), platform: m.platform, status: m.status, infringement: m.potentialInfringement })))}`,
    }],
  });

  return { success: true, report: message.content[0].type === "text" ? message.content[0].text : "", matchCount: matches.length };
}

// ── Monitoring ──

export async function monitorPerson(params: {
  subject: string; subjectDetails: Record<string, any>;
  matterId?: string; clientId?: string; frequency?: string;
}) {
  const sonarResult = await sonar.monitorForIncidents({ name: params.subject, ...params.subjectDetails });

  const sub = await db.monitoringSubscription.create({
    data: {
      provider: "SONAR",
      externalSubscriptionId: sonarResult.success ? sonarResult.data?.subscription_id : undefined,
      matterId: params.matterId,
      clientId: params.clientId,
      monitoringType: "PERSON_CHANGE",
      subject: params.subject,
      subjectDetails: JSON.stringify(params.subjectDetails),
      isActive: sonarResult.success,
      frequency: params.frequency || "daily",
    },
  });

  return { success: sonarResult.success, subscriptionId: sub.id, error: sonarResult.success ? undefined : sonarResult.error };
}

export async function monitorVisualAsset(params: {
  assetName: string; assetDetails: Record<string, any>;
  matterId?: string; clientId?: string; frequency?: string;
}) {
  const result = await mediascope.startMonitoring({ asset_name: params.assetName, ...params.assetDetails });

  const sub = await db.monitoringSubscription.create({
    data: {
      provider: "MEDIASCOPE",
      externalSubscriptionId: result.success ? result.data?.subscription_id : undefined,
      matterId: params.matterId,
      clientId: params.clientId,
      monitoringType: "VISUAL_ASSET_MATCH",
      subject: params.assetName,
      subjectDetails: JSON.stringify(params.assetDetails),
      isActive: result.success,
      frequency: params.frequency || "daily",
    },
  });

  return { success: result.success, subscriptionId: sub.id, error: result.success ? undefined : result.error };
}

export async function stopMonitoring(subscriptionId: string) {
  const sub = await db.monitoringSubscription.findUniqueOrThrow({ where: { id: subscriptionId } });

  if (sub.externalSubscriptionId) {
    if (sub.provider === "SONAR") {
      await sonar.stopMonitoring(sub.externalSubscriptionId);
    } else if (sub.provider === "MEDIASCOPE") {
      await mediascope.stopMonitoring(sub.externalSubscriptionId);
    }
  }

  await db.monitoringSubscription.update({ where: { id: subscriptionId }, data: { isActive: false } });

  return { success: true };
}

// ── Subject dossier ──

export async function getSubjectDossier(personRecordId: string) {
  const record = await db.personRecord.findUniqueOrThrow({
    where: { id: personRecordId },
    include: { search: true },
  });

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: "You are a legal investigative analyst. Format the following person record into a clear, well-structured dossier document suitable for attorney review. Use sections with headings. Highlight key facts and any red flags.",
    messages: [{
      role: "user",
      content: `Create an attorney-friendly dossier for:\n\n${JSON.stringify({
        name: record.fullName, dob: record.dateOfBirth, age: record.age,
        address: record.currentAddress, city: record.currentCity, state: record.currentState,
        phones: record.phones, emails: record.emails,
        relatives: record.relatives, associates: record.associates,
        criminal: record.criminalRecords, court: record.courtCases,
        properties: record.properties, vehicles: record.vehicles,
        bankruptcies: record.bankruptcies, liens: record.liensJudgments,
        licenses: record.professionalLicenses,
      })}`,
    }],
  });

  return { success: true, dossier: message.content[0].type === "text" ? message.content[0].text : "" };
}

// ── Cross-reference analysis ──

export async function crossReferenceWithMatter(searchId: string, matterId: string) {
  const [search, matter] = await Promise.all([
    db.investigationSearch.findUniqueOrThrow({ where: { id: searchId }, include: { personRecords: true } }),
    db.matter.findUniqueOrThrow({ where: { id: matterId }, include: { client: true } }),
  ]);

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: "You are a legal investigative analyst. Cross-reference the search results with matter details. Identify connections, conflicts of interest, relevant findings, and any information that could impact the case.",
    messages: [{
      role: "user",
      content: `Cross-reference these search results with the matter:\n\nMatter: ${matter.name} (${matter.practiceArea || "General"})\nClient: ${matter.client?.name}\nDescription: ${matter.description || "N/A"}\n\nSearch subject: ${search.searchSubject}\nSearch type: ${search.searchType}\nResults summary: ${search.resultSummary || search.results || "No results"}`,
    }],
  });

  return { success: true, analysis: message.content[0].type === "text" ? message.content[0].text : "" };
}

// ── Infringement damages estimate ──

export async function estimateInfringementDamages(matterId: string) {
  const matches = await db.visualAssetMatch.findMany({
    where: { matterId, potentialInfringement: true },
  });

  if (!matches.length) return { success: false, error: "No confirmed infringement matches found." };

  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1536,
    system: "You are an IP damages expert. Based on the visual asset infringement matches, provide a preliminary damages estimate. Include statutory damages range, potential actual damages factors, and recommended next steps. Note this is a preliminary assessment only.",
    messages: [{
      role: "user",
      content: `Estimate infringement damages for ${matches.length} matches:\n\n${JSON.stringify(matches.map(m => ({
        type: m.matchType, url: m.matchUrl, domain: m.matchDomain,
        similarity: m.similarityScore.toString(), platform: m.platform,
        infringementType: m.infringementType, seller: m.sellerInfo,
      })))}`,
    }],
  });

  return { success: true, estimate: message.content[0].type === "text" ? message.content[0].text : "", matchCount: matches.length };
}

// ── Takedown package ──

export async function generateTakedownPackage(matchIds: string[]) {
  const matches = await db.visualAssetMatch.findMany({ where: { id: { in: matchIds } } });
  if (!matches.length) return { success: false, error: "No matches found." };

  const notices: Array<{ matchId: string; notice: any }> = [];
  for (const match of matches) {
    const result = await mediascope.generateTakedownNotice(match.id);
    if (result.success) {
      notices.push({ matchId: match.id, notice: result.data });
      await db.visualAssetMatch.update({
        where: { id: match.id },
        data: { status: "TAKEDOWN_REQUESTED", takedownRequestDate: new Date() },
      });
    }
  }

  return { success: true, notices, totalRequested: notices.length };
}

// ── Stats ──

export async function getInvestigationStats(dateRange?: { from: Date; to: Date }) {
  const where = dateRange ? { createdAt: { gte: dateRange.from, lte: dateRange.to } } : {};

  const [searches, personRecords, visualMatches, alerts, subscriptions] = await Promise.all([
    db.investigationSearch.count({ where }),
    db.personRecord.count({ where }),
    db.visualAssetMatch.count({ where }),
    db.monitoringAlert.count({ where }),
    db.monitoringSubscription.count({ where: { ...where, isActive: true } }),
  ]);

  const byProvider = await db.investigationSearch.groupBy({ by: ["provider"], _count: true, where });
  const byType = await db.investigationSearch.groupBy({ by: ["searchType"], _count: true, where });
  const byStatus = await db.investigationSearch.groupBy({ by: ["status"], _count: true, where });

  return {
    totalSearches: searches,
    totalPersonRecords: personRecords,
    totalVisualMatches: visualMatches,
    totalAlerts: alerts,
    activeSubscriptions: subscriptions,
    byProvider: Object.fromEntries(byProvider.map(r => [r.provider, r._count])),
    byType: Object.fromEntries(byType.map(r => [r.searchType, r._count])),
    byStatus: Object.fromEntries(byStatus.map(r => [r.status, r._count])),
  };
}

// ── Client / opposing party enrichment ──

export async function enrichClientProfile(clientId: string) {
  const client = await db.client.findUniqueOrThrow({ where: { id: clientId } });

  return runSearch({
    searchType: "PERSON_LOCATE",
    subject: client.name,
    inputs: { name: client.name, email: client.email, phone: client.phone, address: client.address },
    clientId,
    requestedBy: "system",
  });
}

export async function enrichOpposingParty(matterId: string, partyName: string) {
  const [personResult, courtResult] = await Promise.all([
    runSearch({
      searchType: "PERSON_LOCATE", subject: partyName,
      inputs: { name: partyName }, matterId, requestedBy: "system",
    }),
    runSearch({
      searchType: "COURT_RECORDS", subject: partyName,
      inputs: { name: partyName }, matterId, requestedBy: "system",
    }),
  ]);

  return {
    success: personResult.success || courtResult.success,
    personSearchId: personResult.searchId,
    courtSearchId: courtResult.searchId,
  };
}
