import { db } from "@/lib/db";
import * as legl from "@/lib/integrations/legl";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const AI_DISCLAIMER = "DISCLAIMER: This AI-based screening is a preliminary assessment only and does not constitute a comprehensive sanctions/PEP/AML database search. Professional compliance screening through a certified provider (e.g. Legl) is recommended for regulatory compliance.";

const HIGH_RISK_COUNTRIES = [
  "AF", "BY", "CF", "CD", "CU", "ER", "GN", "GW", "HT", "IR", "IQ", "LB", "LY", "ML", "MM",
  "NI", "KP", "RU", "SO", "SS", "SD", "SY", "VE", "YE", "ZW",
];

export async function initiateClientCheck(params: { clientId: string; matterId?: string; policyId?: string; checkTypes?: string[] }) {
  const client = await db.client.findUniqueOrThrow({ where: { id: params.clientId } });

  // Determine policy
  let policy: any = null;
  if (params.policyId) {
    policy = await db.compliancePolicy.findUnique({ where: { id: params.policyId } });
  } else if (params.matterId) {
    policy = await determinePolicyForMatter(params.matterId);
  }
  if (!policy) {
    policy = await db.compliancePolicy.findFirst({ where: { isDefault: true, isActive: true } });
  }

  const checkTypes = params.checkTypes || (policy?.requiredChecks ? JSON.parse(policy.requiredChecks) : ["KYC", "SANCTIONS", "PEP"]);

  // Try Legl first
  const config = await db.complianceIntegration.findUnique({ where: { provider: "LEGL" } });
  let externalCheckId: string | null = null;
  let clientPortalUrl: string | null = null;

  if (config?.isEnabled) {
    const result = await legl.initiateCheck({
      subjectType: "INDIVIDUAL", name: client.name, email: client.email || "",
      phone: client.phone || undefined, address: client.address || undefined,
      checkTypes, matterId: params.matterId,
    });
    if (result.success) {
      externalCheckId = result.checkId || null;
      clientPortalUrl = result.clientPortalUrl || null;
    }
  }

  const check = await db.complianceCheck.create({
    data: {
      provider: config?.isEnabled ? "LEGL" : null, externalCheckId,
      clientId: params.clientId, matterId: params.matterId,
      checkType: checkTypes.includes("FULL_CDD") ? "FULL_CDD" : checkTypes[0] as any,
      status: config?.isEnabled ? "PENDING_CLIENT" : "NOT_STARTED",
      subjectType: "INDIVIDUAL", subjectName: client.name,
      subjectEmail: client.email, subjectPhone: client.phone,
      subjectAddress: client.address, clientPortalUrl,
    },
  });

  await db.complianceActivity.create({
    data: { checkId: check.id, activityType: "CHECK_INITIATED", description: `Compliance check initiated for ${client.name}`, performedBy: "system" },
  });

  return check;
}

export async function initiateLeadCheck(params: { leadId: string; checkTypes?: string[] }) {
  const lead = await db.lead.findUniqueOrThrow({ where: { id: params.leadId } });
  const checkTypes = params.checkTypes || ["SANCTIONS", "PEP"];

  // For leads, create a lightweight local check
  const check = await db.complianceCheck.create({
    data: {
      clientId: params.leadId, // temporary — will be relinked when lead converts
      leadId: params.leadId,
      checkType: "SANCTIONS",
      status: "IN_PROGRESS",
      subjectType: "INDIVIDUAL", subjectName: lead.name,
      subjectEmail: lead.email,
    },
  });

  // Run built-in checks
  const sanctions = await runBuiltInSanctionsCheck(lead.name);
  const pep = await runBuiltInPEPCheck(lead.name);

  await db.complianceCheck.update({
    where: { id: check.id },
    data: {
      status: "PASSED",
      sanctionsResult: sanctions.matchLikelihood === "none" ? "CLEAR" : "POTENTIAL_MATCH",
      pepResult: pep.matchLikelihood === "none" ? "CLEAR" : "POTENTIAL_MATCH",
      aiRiskAssessment: `${sanctions.explanation}\n\n${pep.explanation}\n\n${AI_DISCLAIMER}`,
    },
  });

  return check;
}

export async function determinePolicyForMatter(matterId: string) {
  const matter = await db.matter.findUniqueOrThrow({ where: { id: matterId }, include: { client: true } });

  // Try to find a policy matching practice area
  if (matter.practiceArea) {
    const paPolicy = await db.compliancePolicy.findFirst({ where: { practiceArea: matter.practiceArea, isActive: true } });
    if (paPolicy) return paPolicy;
  }

  // Default policy
  return db.compliancePolicy.findFirst({ where: { isDefault: true, isActive: true } });
}

export async function runBuiltInSanctionsCheck(name: string, dob?: string, nationality?: string) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 1000,
    system: "You are a compliance analyst. Check if the following person may appear on major sanctions lists (OFAC SDN, UN Security Council, EU Consolidated List, UK HMT). Based on the name, date of birth, and nationality provided, assess the likelihood of a sanctions match. This is an AI-based preliminary screening only. Return JSON: {matchLikelihood: 'none'|'low'|'medium'|'high', explanation: string, recommendation: string}",
    messages: [{ role: "user", content: `Name: ${name}${dob ? `, DOB: ${dob}` : ""}${nationality ? `, Nationality: ${nationality}` : ""}` }],
  });
  const text = message.content[0].type === "text" ? message.content[0].text : "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : { matchLikelihood: "none", explanation: text };
    return { ...parsed, disclaimer: AI_DISCLAIMER };
  } catch {
    return { matchLikelihood: "none", explanation: text, disclaimer: AI_DISCLAIMER };
  }
}

export async function runBuiltInPEPCheck(name: string, nationality?: string) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 1000,
    system: "You are a compliance analyst. Check if the following person may be a Politically Exposed Person (PEP) — current or former senior political figure, or their family member or close associate. This is an AI-based preliminary screening only. Return JSON: {matchLikelihood: 'none'|'low'|'medium'|'high', explanation: string, recommendation: string}",
    messages: [{ role: "user", content: `Name: ${name}${nationality ? `, Nationality: ${nationality}` : ""}` }],
  });
  const text = message.content[0].type === "text" ? message.content[0].text : "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : { matchLikelihood: "none", explanation: text };
    return { ...parsed, disclaimer: AI_DISCLAIMER };
  } catch {
    return { matchLikelihood: "none", explanation: text, disclaimer: AI_DISCLAIMER };
  }
}

export async function runBuiltInAdverseMediaCheck(name: string, companyName?: string) {
  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 1000,
    system: "You are a compliance analyst. Assess whether the following person or company is likely associated with adverse media coverage (legal issues, regulatory actions, fraud, financial crime, etc.). This is an AI-based preliminary screening only. Return JSON: {matchLikelihood: 'none'|'low'|'medium'|'high', explanation: string, recommendation: string}",
    messages: [{ role: "user", content: `Name: ${name}${companyName ? `, Company: ${companyName}` : ""}` }],
  });
  const text = message.content[0].type === "text" ? message.content[0].text : "";
  try {
    const match = text.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : { matchLikelihood: "none", explanation: text };
    return { ...parsed, disclaimer: AI_DISCLAIMER };
  } catch {
    return { matchLikelihood: "none", explanation: text, disclaimer: AI_DISCLAIMER };
  }
}

export function calculateRiskScore(check: any) {
  let score = 0;
  const factors: string[] = [];

  // Geography
  if (check.subjectNationality && HIGH_RISK_COUNTRIES.includes(check.subjectNationality.toUpperCase())) {
    score += 30; factors.push("High-risk jurisdiction (+30)");
  }
  if (check.companyJurisdiction && HIGH_RISK_COUNTRIES.includes(check.companyJurisdiction.toUpperCase())) {
    score += 30; factors.push("Company in high-risk jurisdiction (+30)");
  }

  // Sanctions
  if (check.sanctionsResult === "CONFIRMED_MATCH") { score += 50; factors.push("Confirmed sanctions match (+50)"); }
  else if (check.sanctionsResult === "POTENTIAL_MATCH") { score += 30; factors.push("Potential sanctions match (+30)"); }

  // PEP
  if (check.pepResult === "CONFIRMED_MATCH") { score += 25; factors.push("Confirmed PEP (+25)"); }
  else if (check.pepResult === "POTENTIAL_MATCH") { score += 15; factors.push("Potential PEP (+15)"); }

  // Adverse media
  if (check.adverseMediaResult === "CONFIRMED_MATCH") { score += 20; factors.push("Confirmed adverse media (+20)"); }
  else if (check.adverseMediaResult === "POTENTIAL_MATCH") { score += 10; factors.push("Potential adverse media (+10)"); }

  // Document verification
  if (check.documentVerificationResult) {
    try {
      const docResult = JSON.parse(check.documentVerificationResult);
      if (docResult.documentsRejected > 0) { score += 20; factors.push("Document(s) rejected (+20)"); }
      else if (docResult.documentsVerified < docResult.documentsSubmitted) { score += 10; factors.push("Document(s) pending verification (+10)"); }
    } catch {}
  }

  // Source of funds
  if (check.sourceOfFundsResult) {
    try {
      const sof = JSON.parse(check.sourceOfFundsResult);
      if (!sof.verified) { score += 15; factors.push("Source of funds unverified (+15)"); }
    } catch {}
  }

  score = Math.min(score, 100);
  const riskLevel = score <= 25 ? "LOW" : score <= 50 ? "MEDIUM" : score <= 75 ? "HIGH" : "VERY_HIGH";

  return { score, riskLevel, factors };
}

export async function generateRiskNarrative(checkId: string) {
  const check = await db.complianceCheck.findUniqueOrThrow({ where: { id: checkId }, include: { documents: true, activities: true } });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 1500,
    system: "You are a compliance officer preparing a risk assessment for a law firm's client. Write a concise risk assessment narrative covering: subject identification, sanctions screening results, PEP status, adverse media findings, document verification status, overall risk rating with justification, and recommended actions. Use professional compliance language. Use markdown formatting.",
    messages: [{
      role: "user",
      content: `Subject: ${check.subjectName} (${check.subjectType})\nNationality: ${check.subjectNationality || "Unknown"}\nSanctions: ${check.sanctionsResult || "Not checked"}\nPEP: ${check.pepResult || "Not checked"}\nAdverse Media: ${check.adverseMediaResult || "Not checked"}\nDocuments: ${check.documents.length} submitted, ${check.documents.filter(d => d.status === "VERIFIED").length} verified\nRisk Score: ${check.riskScore || "Not calculated"}\nRisk Level: ${check.overallRiskLevel || "Not assessed"}`,
    }],
  });

  const narrative = message.content[0].type === "text" ? message.content[0].text : "";
  await db.complianceCheck.update({ where: { id: checkId }, data: { aiRiskAssessment: narrative } });
  return narrative;
}

export async function checkExpiring(daysAhead: number) {
  const deadline = new Date(Date.now() + daysAhead * 86400000);
  return db.complianceCheck.findMany({
    where: { expiresAt: { lte: deadline }, status: "PASSED" },
    include: { client: true, matter: true },
    orderBy: { expiresAt: "asc" },
  });
}

export async function renewCheck(checkId: string) {
  const old = await db.complianceCheck.findUniqueOrThrow({ where: { id: checkId } });
  await db.complianceCheck.update({ where: { id: checkId }, data: { status: "EXPIRED" } });
  await db.complianceActivity.create({
    data: { checkId, activityType: "EXPIRED", description: "Check expired, renewal initiated", performedBy: "system" },
  });
  return initiateClientCheck({ clientId: old.clientId, matterId: old.matterId || undefined });
}

export async function getClientComplianceStatus(clientId: string) {
  const latestCheck = await db.complianceCheck.findFirst({
    where: { clientId }, orderBy: { createdAt: "desc" },
  });

  if (!latestCheck) return { badge: "none", status: "No compliance check on file", check: null };

  const isExpired = latestCheck.expiresAt && new Date(latestCheck.expiresAt) < new Date();
  if (latestCheck.status === "PASSED" && !isExpired) {
    return { badge: "compliant", status: "Compliant", riskLevel: latestCheck.overallRiskLevel, expiresAt: latestCheck.expiresAt, check: latestCheck };
  }
  if (latestCheck.status === "FAILED") {
    return { badge: "non_compliant", status: "Non-Compliant", riskLevel: latestCheck.overallRiskLevel, check: latestCheck };
  }
  if (isExpired) {
    return { badge: "expired", status: "Expired", check: latestCheck };
  }
  return { badge: "pending", status: `Pending: ${latestCheck.status}`, check: latestCheck };
}

export async function getMatterComplianceGate(matterId: string) {
  const config = await db.complianceIntegration.findFirst();
  if (!config?.requireApprovalBeforeMatterStart) return { cleared: true, reason: "Compliance gate not enabled" };

  const matter = await db.matter.findUniqueOrThrow({ where: { id: matterId } });
  const check = await db.complianceCheck.findFirst({
    where: { clientId: matter.clientId, OR: [{ matterId }, { matterId: null }], status: "PASSED", expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  if (check) return { cleared: true, checkId: check.id, checkStatus: check.status };

  const pendingCheck = await db.complianceCheck.findFirst({
    where: { clientId: matter.clientId, status: { in: ["PENDING_CLIENT", "IN_PROGRESS", "AWAITING_DOCUMENTS", "UNDER_REVIEW"] } },
  });
  if (pendingCheck) return { cleared: false, reason: "Compliance check in progress", checkId: pendingCheck.id, checkStatus: pendingCheck.status };

  return { cleared: false, reason: "No valid compliance check found" };
}

export async function generateSARReport(checkId: string) {
  const check = await db.complianceCheck.findUniqueOrThrow({ where: { id: checkId }, include: { client: true, documents: true } });

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514", max_tokens: 2000,
    system: "Generate a Suspicious Activity Report (SAR) filing template based on these compliance findings. Include: subject information, nature of suspicious activity, supporting evidence, dates. Follow standard SAR format. Use markdown.",
    messages: [{
      role: "user",
      content: `Subject: ${check.subjectName}\nRisk Score: ${check.riskScore}\nSanctions: ${check.sanctionsResult} - ${check.sanctionsMatches || "none"}\nPEP: ${check.pepResult} - ${check.pepMatches || "none"}\nAdverse Media: ${check.adverseMediaResult} - ${check.adverseMediaMatches || "none"}`,
    }],
  });
  return message.content[0].type === "text" ? message.content[0].text : "";
}

export async function generateAuditLog(dateRange: { from: string; to: string }) {
  return db.complianceActivity.findMany({
    where: { createdAt: { gte: new Date(dateRange.from), lte: new Date(dateRange.to) } },
    include: { check: { select: { subjectName: true, clientId: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getComplianceDashboardData() {
  const total = await db.complianceCheck.count();
  const passed = await db.complianceCheck.count({ where: { status: "PASSED" } });
  const failed = await db.complianceCheck.count({ where: { status: "FAILED" } });
  const pending = await db.complianceCheck.count({ where: { status: { in: ["PENDING_CLIENT", "IN_PROGRESS", "AWAITING_DOCUMENTS", "UNDER_REVIEW"] } } });
  const highRisk = await db.complianceCheck.count({ where: { overallRiskLevel: { in: ["HIGH", "VERY_HIGH"] } } });
  const expiringSoon = await db.complianceCheck.count({ where: { status: "PASSED", expiresAt: { lte: new Date(Date.now() + 30 * 86400000) } } });

  const byRiskLevel = await db.complianceCheck.groupBy({ by: ["overallRiskLevel"], _count: true, where: { status: "PASSED" } });

  const completedChecks = await db.complianceCheck.findMany({ where: { status: { in: ["PASSED", "FAILED"] } }, select: { createdAt: true, updatedAt: true } });
  const avgCompletionDays = completedChecks.length > 0
    ? completedChecks.reduce((s, c) => s + (c.updatedAt.getTime() - c.createdAt.getTime()) / 86400000, 0) / completedChecks.length
    : 0;

  return {
    total, passed, failed, pending, highRisk, expiringSoon,
    complianceRate: total > 0 ? Math.round((passed / (passed + failed || 1)) * 100) : 0,
    avgCompletionDays: Math.round(avgCompletionDays * 10) / 10,
    byRiskLevel: byRiskLevel.map(r => ({ level: r.overallRiskLevel, count: r._count })),
  };
}

export async function onNewClient(clientId: string) {
  const config = await db.complianceIntegration.findFirst();
  if (!config?.autoRunOnNewClient) return null;
  return initiateClientCheck({ clientId });
}

export async function onNewMatter(matterId: string, clientId: string) {
  const config = await db.complianceIntegration.findFirst();
  if (!config?.autoRunOnNewMatter) return null;

  // Check if client already has valid check
  const existing = await db.complianceCheck.findFirst({
    where: { clientId, status: "PASSED", expiresAt: { gt: new Date() } },
  });
  if (existing) {
    // Link existing check to matter
    await db.complianceCheck.update({ where: { id: existing.id }, data: { matterId } });
    return { reused: true, check: existing };
  }

  return { reused: false, check: await initiateClientCheck({ clientId, matterId }) };
}

export function getHighRiskCountries() {
  return HIGH_RISK_COUNTRIES.map(code => ({
    code,
    name: COUNTRY_NAMES[code] || code,
    lists: ["FATF", "Sanctions"],
  }));
}

const COUNTRY_NAMES: Record<string, string> = {
  AF: "Afghanistan", BY: "Belarus", CF: "Central African Republic", CD: "DR Congo", CU: "Cuba",
  ER: "Eritrea", GN: "Guinea", GW: "Guinea-Bissau", HT: "Haiti", IR: "Iran", IQ: "Iraq",
  LB: "Lebanon", LY: "Libya", ML: "Mali", MM: "Myanmar", NI: "Nicaragua", KP: "North Korea",
  RU: "Russia", SO: "Somalia", SS: "South Sudan", SD: "Sudan", SY: "Syria", VE: "Venezuela",
  YE: "Yemen", ZW: "Zimbabwe",
};

export async function initializeDefaultPolicies() {
  const count = await db.compliancePolicy.count();
  if (count > 0) return { initialized: false, message: "Policies already exist" };

  const policies = [
    { name: "Standard Individual Client", subjectType: "INDIVIDUAL" as const, isDefault: true, requiredChecks: JSON.stringify(["KYC", "SANCTIONS", "PEP", "DOCUMENT_VERIFICATION"]), requiredDocuments: JSON.stringify(["PASSPORT", "PROOF_OF_ADDRESS"]), riskThresholds: JSON.stringify({ low: 25, medium: 50, high: 75, veryHigh: 100 }), eddTriggers: JSON.stringify([{ field: "nationality", operator: "in", value: "high_risk_countries" }, { field: "riskScore", operator: "gt", value: 60 }]) },
    { name: "Corporate Client", subjectType: "COMPANY" as const, requiredChecks: JSON.stringify(["KYC", "AML", "SANCTIONS", "PEP", "ADVERSE_MEDIA", "DOCUMENT_VERIFICATION"]), requiredDocuments: JSON.stringify(["COMPANY_REGISTRATION", "ARTICLES_OF_INCORPORATION", "PROOF_OF_ADDRESS"]), eddTriggers: JSON.stringify([{ field: "companyJurisdiction", operator: "in", value: "high_risk_countries" }, { field: "riskScore", operator: "gt", value: 50 }]) },
    { name: "High-Value Matter", subjectType: "INDIVIDUAL" as const, matterValueThreshold: 100000, requiredChecks: JSON.stringify(["FULL_CDD", "SOURCE_OF_FUNDS", "SOURCE_OF_WEALTH"]), requiredDocuments: JSON.stringify(["PASSPORT", "PROOF_OF_ADDRESS", "SOURCE_OF_FUNDS_EVIDENCE", "SOURCE_OF_WEALTH_EVIDENCE"]), eddTriggers: JSON.stringify([{ field: "riskScore", operator: "gt", value: 40 }]) },
    { name: "Trust/Estate Client", subjectType: "TRUST" as const, requiredChecks: JSON.stringify(["KYC", "AML", "SANCTIONS", "PEP", "DOCUMENT_VERIFICATION"]), requiredDocuments: JSON.stringify(["TRUST_DEED", "PASSPORT", "PROOF_OF_ADDRESS"]), eddTriggers: JSON.stringify([{ field: "nationality", operator: "in", value: "high_risk_countries" }]) },
    { name: "Quick Screening (Leads)", subjectType: "INDIVIDUAL" as const, description: "Use for preliminary screening before engagement. Full KYC required before matter opens.", requiredChecks: JSON.stringify(["SANCTIONS", "PEP"]), requiredDocuments: JSON.stringify([]) },
  ];

  await db.compliancePolicy.createMany({ data: policies });
  return { initialized: true, count: policies.length };
}
