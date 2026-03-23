import { db } from "@/lib/db";
import * as aiRouter from "@/lib/ai-router";

// ---------------------------------------------------------------------------
// 1. Document Type Detection
// ---------------------------------------------------------------------------

const DOC_TYPE_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /INTERROGATOR(Y|IES)\s+NO\./i, type: "interrogatory_answers" },
  { pattern: /DOCUMENT\s+(REQUEST|DEMAND)\s+NO\./i, type: "document_demand_response" },
  { pattern: /REQUEST\s+FOR\s+ADMISSION/i, type: "discovery_response" },
  { pattern: /THIS\s+AGREEMENT|PARTIES\s+AGREE|WITNESSETH/i, type: "contract" },
  { pattern: /LEASE\s+AGREEMENT|LANDLORD\s+AND\s+TENANT/i, type: "lease" },
  { pattern: /SETTLEMENT\s+AGREEMENT|RELEASE\s+AND\s+SETTLEMENT/i, type: "settlement_agreement" },
  { pattern: /ORDER(ED|S)?\s+THAT|SO\s+ORDERED|IT\s+IS\s+HEREBY/i, type: "court_order" },
  { pattern: /WHEREFORE|COMPLAINT|PLAINTIFF\s+ALLEGES/i, type: "pleading" },
  { pattern: /DEPOSITION\s+OF|Q\.\s+.*\nA\.\s+/i, type: "deposition_transcript" },
  { pattern: /EXPERT\s+REPORT|REASONABLE\s+DEGREE\s+OF\s+(MEDICAL|SCIENTIFIC)\s+CERTAINTY/i, type: "expert_report" },
  { pattern: /INSURANCE\s+POLICY|COVERAGE|INSURED|PREMIUM/i, type: "insurance_policy" },
  { pattern: /MEDICAL\s+RECORD|DIAGNOSIS|PROGNOSIS|TREATMENT\s+PLAN/i, type: "medical_records" },
  { pattern: /CERTIFICATE\s+OF\s+INCORPORATION|ARTICLES\s+OF|BYLAWS/i, type: "corporate_filing" },
  { pattern: /LAST\s+WILL\s+AND\s+TESTAMENT|TRUST\s+AGREEMENT|REVOCABLE\s+TRUST/i, type: "will_trust" },
  { pattern: /I-\d{3}|USCIS|FORM\s+N-\d{3}/i, type: "immigration_form" },
];

export function detectDocumentType(text: string, fileName: string): string {
  // Check filename first
  const fnLower = fileName.toLowerCase();
  if (fnLower.includes("interrogator")) return "interrogatory_answers";
  if (fnLower.includes("demand") && fnLower.includes("response")) return "document_demand_response";
  if (fnLower.includes("contract") || fnLower.includes("agreement")) return "contract";
  if (fnLower.includes("lease")) return "lease";
  if (fnLower.includes("settlement")) return "settlement_agreement";
  if (fnLower.includes("order")) return "court_order";
  if (fnLower.includes("deposition") || fnLower.includes("transcript")) return "deposition_transcript";
  if (fnLower.includes("expert")) return "expert_report";

  // Check content patterns
  for (const { pattern, type } of DOC_TYPE_PATTERNS) {
    if (pattern.test(text.substring(0, 5000))) return type;
  }

  return "custom";
}

export function detectPracticeArea(text: string, matterPracticeArea?: string): string {
  if (matterPracticeArea) return matterPracticeArea;

  const lower = text.toLowerCase().substring(0, 10000);
  if (/personal\s+injury|negligence|bodily\s+harm|medical\s+malpractice|damages/i.test(lower)) return "personal_injury";
  if (/custody|divorce|matrimonial|child\s+support|alimony|family\s+court/i.test(lower)) return "family_law";
  if (/immigration|visa|uscis|deportation|asylum|green\s+card/i.test(lower)) return "immigration";
  if (/corporation|shareholder|merger|acquisition|securities|llc/i.test(lower)) return "corporate";
  if (/criminal|defendant|prosecution|indictment|plea/i.test(lower)) return "criminal";
  if (/real\s+property|deed|mortgage|conveyance|easement/i.test(lower)) return "real_estate";
  if (/estate|probate|will|trust|decedent|executor/i.test(lower)) return "estate_planning";

  return "general";
}

// ---------------------------------------------------------------------------
// 2. Document-Type-Specific Review Prompts
// ---------------------------------------------------------------------------

function getReviewSystemPrompt(documentType: string, practiceArea: string, jurisdiction?: string): string {
  const base = `You are an expert legal document reviewer and litigation support AI. You analyze legal documents to identify issues, risks, missing items, and inconsistencies that attorneys need to address.

JURISDICTION: ${jurisdiction || "Not specified"}
PRACTICE AREA: ${practiceArea}

You MUST return ONLY valid JSON in this exact format:
{
  "summary": "Executive summary of the document and key findings (2-3 sentences)",
  "overallRiskLevel": "low|medium|high|critical",
  "flags": [
    {
      "flagType": "missing_item|inconsistency|unusual_clause|boilerplate_deviation|privilege_issue|incomplete_response|evasive_response|missing_document|date_discrepancy|amount_discrepancy|undefined_term|ambiguous_language|unfavorable_term|missing_protection|compliance_issue|deadline_triggered|custom",
      "severity": "critical|high|medium|low|info",
      "category": "completeness|accuracy|legal_risk|compliance|negotiation_point|privilege|procedural|substantive",
      "title": "Short descriptive title",
      "description": "Detailed explanation of the issue",
      "recommendation": "Suggested action for the attorney",
      "documentSection": "Section/paragraph reference if applicable",
      "pageNumber": null,
      "relevantText": "The specific text that triggered this flag (quote if possible)",
      "ruleReference": "Legal rule reference if applicable"
    }
  ]
}`;

  const typeSpecific: Record<string, string> = {
    discovery_response: `
DOCUMENT TYPE: Discovery Response
Focus on:
- Missing or incomplete responses to individual requests
- Objections that lack specificity or are boilerplate
- Privilege claims without proper privilege log entries
- Evasive or non-responsive answers
- Documents referenced but not produced
- Inconsistencies between different responses
- Failure to identify responsive documents
- General vs. specific objections (improper under most court rules)
- "Subject to" objections followed by partial responses
- Timeliness issues
- Verification/signature requirements`,

    interrogatory_answers: `
DOCUMENT TYPE: Interrogatory Answers
Focus on:
- Answers that don't fully address the interrogatory
- Inconsistencies with known facts or other discovery responses
- Missing sworn verification
- Improper objections (overly broad, unduly burdensome without explanation)
- References to "see attached" without attachments
- Answers that are evasive or non-responsive
- Failure to identify witnesses or facts requested
- Contention interrogatory responses that are insufficient
- Supplementation obligations
- Cross-reference inconsistencies with deposition testimony`,

    document_demand_response: `
DOCUMENT TYPE: Document Demand Response
Focus on:
- Categories of documents requested but not produced
- Privilege objections without privilege log
- Documents referenced in other discovery but not produced
- Metadata concerns for electronic documents
- Redactions without explanation
- Format of production issues
- Missing date ranges
- Partial production of document categories
- Chain of custody issues
- Documents that should exist based on business practices but weren't produced`,

    contract: `
DOCUMENT TYPE: Contract
Focus on:
- Undefined or ambiguous terms
- Missing essential terms (price, duration, deliverables, termination)
- One-sided indemnification clauses
- Unfavorable limitation of liability
- Missing representations and warranties
- Problematic governing law or venue provisions
- Non-compete scope issues
- Assignment restrictions
- Force majeure gaps
- Intellectual property ownership ambiguity
- Missing confidentiality protections
- Automatic renewal traps
- Unusual termination provisions
- Missing dispute resolution mechanism
- Insurance requirements gaps`,

    lease: `
DOCUMENT TYPE: Lease Agreement
Focus on:
- Rent escalation clauses
- Maintenance and repair obligations
- Subletting/assignment restrictions
- Early termination penalties
- Security deposit terms
- Insurance requirements
- Common area maintenance (CAM) charges
- Environmental liability
- ADA compliance
- Permitted use restrictions
- Default and remedy provisions
- Holdover provisions`,

    settlement_agreement: `
DOCUMENT TYPE: Settlement Agreement
Focus on:
- Scope of release (too broad or too narrow)
- Unknown claims release language
- Confidentiality provisions
- Non-disparagement clauses
- Indemnification obligations
- Payment terms and timing
- Conditions precedent
- Representations and warranties
- Tax implications language
- Enforcement provisions
- Compliance with court approval requirements (if applicable)
- Missing consideration
- Mutual vs. one-sided terms`,

    court_order: `
DOCUMENT TYPE: Court Order
Focus on:
- Compliance deadlines triggered
- Scope of obligations imposed
- Ambiguity in order terms
- Potential appeal issues
- Discovery obligations created
- Scheduling implications
- Sanctions risk for non-compliance
- Reporting requirements`,

    pleading: `
DOCUMENT TYPE: Pleading
Focus on:
- Sufficiency of allegations (notice pleading vs. heightened standard)
- Missing elements of claimed causes of action
- Statute of limitations issues
- Standing issues
- Jurisdictional questions
- Improper joinder
- Failure to state a claim
- Affirmative defenses to evaluate
- Counterclaim opportunities
- Cross-claim considerations`,

    deposition_transcript: `
DOCUMENT TYPE: Deposition Transcript
Focus on:
- Inconsistencies with other testimony or documents
- Admissions that help or hurt the case
- Areas where witness was evasive
- Follow-up questions needed
- Impeachment opportunities
- Key testimony for summary judgment
- Expert qualification issues
- Foundation problems
- Hearsay issues in testimony`,

    expert_report: `
DOCUMENT TYPE: Expert Report
Focus on:
- Qualifications gaps
- Methodology concerns (Daubert/Frye issues)
- Missing factual basis for opinions
- Assumptions not supported by evidence
- Scope of opinions vs. retainer
- Inconsistencies with treatises or standards
- Missing supporting data or calculations
- Failure to consider alternative explanations
- Bias indicators`,

    insurance_policy: `
DOCUMENT TYPE: Insurance Policy
Focus on:
- Coverage gaps
- Exclusion clauses
- Deductible and limit issues
- Notice requirements
- Cooperation clauses
- Subrogation provisions
- Policy period issues
- Additional insured status
- Duty to defend vs. duty to indemnify
- Bad faith triggers`,

    medical_records: `
DOCUMENT TYPE: Medical Records
Focus on:
- Gaps in treatment timeline
- Inconsistencies between different providers
- Pre-existing condition documentation
- Causation language
- Prognosis opinions
- Missing records or pages
- Unsigned or undated entries
- Late entries or amendments
- Medication discrepancies
- Referral follow-through`,
  };

  const specific = typeSpecific[documentType] || `
DOCUMENT TYPE: ${documentType}
Analyze for general legal issues including completeness, accuracy, legal risks, and recommended actions.`;

  return base + specific;
}

// ---------------------------------------------------------------------------
// 3. Core Review Function
// ---------------------------------------------------------------------------

export interface ReviewResult {
  summary: string;
  overallRiskLevel: string;
  flags: ReviewFlagData[];
  aiModelUsed: string;
  processingTime: number;
}

export interface ReviewFlagData {
  flagType: string;
  severity: string;
  category: string;
  title: string;
  description: string;
  recommendation?: string;
  documentSection?: string;
  pageNumber?: number;
  relevantText?: string;
  ruleReference?: string;
}

export async function reviewDocument(params: {
  text: string;
  documentType: string;
  practiceArea: string;
  jurisdiction?: string;
  matterContext?: string;
  comparisonDoc?: string;
  customInstructions?: string;
}): Promise<ReviewResult> {
  const startTime = Date.now();

  const systemPrompt = getReviewSystemPrompt(
    params.documentType,
    params.practiceArea,
    params.jurisdiction,
  );

  let userPrompt = `Review the following document:\n\n${params.text.substring(0, 80000)}`;

  if (params.matterContext) {
    userPrompt += `\n\n--- MATTER CONTEXT ---\n${params.matterContext}`;
  }

  if (params.comparisonDoc) {
    userPrompt += `\n\n--- COMPARISON DOCUMENT (original demand/request) ---\n${params.comparisonDoc.substring(0, 20000)}`;
    userPrompt += `\n\nCompare the response against this original document. Identify items from the original that were not adequately addressed.`;
  }

  if (params.customInstructions) {
    userPrompt += `\n\n--- ADDITIONAL INSTRUCTIONS ---\n${params.customInstructions}`;
  }

  const result = await aiRouter.complete({
    feature: "document_review",
    systemPrompt,
    userPrompt,
    maxTokens: 8192,
    temperature: 0.2,
  });

  const processingTime = Math.round((Date.now() - startTime) / 1000);

  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = result.content;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    const parsed = JSON.parse(jsonStr.trim());

    return {
      summary: parsed.summary || "Review completed.",
      overallRiskLevel: parsed.overallRiskLevel || "medium",
      flags: (parsed.flags || []).map((f: any, i: number) => ({
        flagType: f.flagType || "custom",
        severity: f.severity || "medium",
        category: f.category || "substantive",
        title: f.title || `Flag ${i + 1}`,
        description: f.description || "",
        recommendation: f.recommendation,
        documentSection: f.documentSection,
        pageNumber: f.pageNumber,
        relevantText: f.relevantText,
        ruleReference: f.ruleReference,
      })),
      aiModelUsed: result.model,
      processingTime,
    };
  } catch {
    return {
      summary: "Document review completed but response parsing failed. Raw output available.",
      overallRiskLevel: "medium",
      flags: [{
        flagType: "custom",
        severity: "info",
        category: "substantive",
        title: "Review Output Available",
        description: result.content.substring(0, 2000),
        recommendation: "Manually review the AI output for flags.",
      }],
      aiModelUsed: result.model,
      processingTime,
    };
  }
}

// ---------------------------------------------------------------------------
// 4. Comparison Function
// ---------------------------------------------------------------------------

export async function compareDocuments(params: {
  responseText: string;
  demandText: string;
  documentType: string;
}): Promise<{
  matchedItems: string[];
  missingItems: string[];
  extraItems: string[];
  matchPercentage: number;
}> {
  const result = await aiRouter.complete({
    feature: "document_review",
    systemPrompt: `You are a legal document comparison expert. Compare a discovery response against the original demand/request.

Return ONLY valid JSON:
{
  "matchedItems": ["Item 1 description - adequately addressed", ...],
  "missingItems": ["Item 2 description - not addressed or inadequately addressed", ...],
  "extraItems": ["Additional item in response not in original demand", ...],
  "matchPercentage": 75.0
}`,
    userPrompt: `ORIGINAL DEMAND/REQUEST:\n${params.demandText.substring(0, 30000)}\n\n---\n\nRESPONSE:\n${params.responseText.substring(0, 30000)}`,
    maxTokens: 4096,
    temperature: 0.1,
  });

  try {
    let jsonStr = result.content;
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];

    const parsed = JSON.parse(jsonStr.trim());
    return {
      matchedItems: parsed.matchedItems || [],
      missingItems: parsed.missingItems || [],
      extraItems: parsed.extraItems || [],
      matchPercentage: parsed.matchPercentage ?? 0,
    };
  } catch {
    return { matchedItems: [], missingItems: [], extraItems: [], matchPercentage: 0 };
  }
}

// ---------------------------------------------------------------------------
// 5. Persistence Functions
// ---------------------------------------------------------------------------

export async function createReview(params: {
  matterId?: string;
  documentName: string;
  documentType: string;
  practiceArea?: string;
  jurisdiction?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  extractedText: string;
  pageCount?: number;
  userId: string;
  firmId: string;
}): Promise<any> {
  return (db as any).documentReview.create({
    data: {
      matterId: params.matterId,
      documentName: params.documentName,
      documentType: params.documentType,
      practiceArea: params.practiceArea,
      jurisdiction: params.jurisdiction,
      fileName: params.fileName,
      fileSize: params.fileSize,
      mimeType: params.mimeType,
      extractedText: params.extractedText,
      pageCount: params.pageCount,
      reviewStatus: "processing",
      userId: params.userId,
      firmId: params.firmId,
    },
  });
}

export async function completeReview(
  reviewId: string,
  result: ReviewResult,
  userId: string,
  firmId: string,
): Promise<{ review: any; flags: any[] }> {
  const flagCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const f of result.flags) {
    if (f.severity in flagCounts) {
      flagCounts[f.severity as keyof typeof flagCounts]++;
    }
  }

  const review = await (db as any).documentReview.update({
    where: { id: reviewId },
    data: {
      reviewStatus: "completed",
      overallRiskLevel: result.overallRiskLevel,
      summaryText: result.summary,
      totalFlags: result.flags.length,
      criticalFlags: flagCounts.critical,
      highFlags: flagCounts.high,
      mediumFlags: flagCounts.medium,
      lowFlags: flagCounts.low,
      aiModelUsed: result.aiModelUsed,
      processingTime: result.processingTime,
    },
  });

  const flags = [];
  for (let i = 0; i < result.flags.length; i++) {
    const f = result.flags[i];
    const flag = await (db as any).reviewFlag.create({
      data: {
        reviewId,
        flagType: f.flagType,
        severity: f.severity,
        category: f.category,
        title: f.title,
        description: f.description,
        recommendation: f.recommendation,
        documentSection: f.documentSection,
        pageNumber: f.pageNumber,
        relevantText: f.relevantText,
        ruleReference: f.ruleReference,
        sortOrder: i,
        userId,
        firmId,
      },
    });
    flags.push(flag);
  }

  return { review, flags };
}

export async function updateFlagStatus(
  flagId: string,
  status: string,
  attorneyNotes?: string,
  resolvedAction?: string,
): Promise<any> {
  const data: any = { status };
  if (attorneyNotes !== undefined) data.attorneyNotes = attorneyNotes;
  if (status === "resolved") {
    data.resolvedAt = new Date();
    data.resolvedAction = resolvedAction;
  }

  const flag = await (db as any).reviewFlag.update({
    where: { id: flagId },
    data,
  });

  // Update resolved count on review
  if (status === "resolved") {
    const review = await (db as any).documentReview.findFirst({
      where: { id: flag.reviewId },
    });
    if (review) {
      await (db as any).documentReview.update({
        where: { id: flag.reviewId },
        data: { resolvedFlags: review.resolvedFlags + 1 },
      });
    }
  }

  return flag;
}

export async function getReviewWithFlags(reviewId: string) {
  const review = await (db as any).documentReview.findUnique({
    where: { id: reviewId },
  });
  if (!review) return null;

  const flags = await (db as any).reviewFlag.findMany({
    where: { reviewId },
    orderBy: [
      { severity: "asc" },
      { sortOrder: "asc" },
    ],
  });

  return { review, flags };
}

export async function getReviewsForMatter(matterId: string) {
  return (db as any).documentReview.findMany({
    where: { matterId },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// 6. Checklist Functions
// ---------------------------------------------------------------------------

export function getDefaultChecklists(): Array<{
  name: string;
  documentType: string;
  practiceArea?: string;
  items: Array<{ item: string; category: string; required: boolean; ruleReference?: string }>;
}> {
  return [
    {
      name: "Discovery Response Completeness (NY)",
      documentType: "discovery_response",
      practiceArea: "general",
      items: [
        { item: "Each interrogatory answered individually", category: "completeness", required: true, ruleReference: "CPLR 3133" },
        { item: "Responses verified under oath", category: "compliance", required: true, ruleReference: "CPLR 3133" },
        { item: "All objections state specific grounds", category: "compliance", required: true, ruleReference: "CPLR 3122" },
        { item: "Privilege log provided for withheld documents", category: "privilege", required: true, ruleReference: "CPLR 3122" },
        { item: "Documents produced in requested format", category: "compliance", required: false },
        { item: "Supplementation obligations acknowledged", category: "procedural", required: false, ruleReference: "CPLR 3101(h)" },
        { item: "All responsive documents identified", category: "completeness", required: true },
        { item: "Date range of production matches demand", category: "completeness", required: true },
      ],
    },
    {
      name: "Contract Review Checklist",
      documentType: "contract",
      items: [
        { item: "All parties properly identified", category: "completeness", required: true },
        { item: "Effective date and term specified", category: "completeness", required: true },
        { item: "Consideration clearly stated", category: "legal_risk", required: true },
        { item: "Termination provisions included", category: "legal_risk", required: true },
        { item: "Indemnification clause reviewed", category: "legal_risk", required: true },
        { item: "Limitation of liability acceptable", category: "negotiation_point", required: true },
        { item: "Governing law specified", category: "compliance", required: true },
        { item: "Dispute resolution mechanism included", category: "legal_risk", required: true },
        { item: "Confidentiality provisions adequate", category: "legal_risk", required: false },
        { item: "Assignment restrictions reviewed", category: "legal_risk", required: false },
        { item: "Force majeure clause present", category: "legal_risk", required: false },
        { item: "Representations and warranties reviewed", category: "substantive", required: true },
        { item: "IP ownership clearly defined", category: "legal_risk", required: false },
        { item: "Insurance requirements specified", category: "compliance", required: false },
      ],
    },
    {
      name: "Settlement Agreement Checklist",
      documentType: "settlement_agreement",
      items: [
        { item: "Release scope appropriate (not overly broad)", category: "legal_risk", required: true },
        { item: "Settlement amount and payment terms clear", category: "completeness", required: true },
        { item: "Confidentiality provisions acceptable", category: "negotiation_point", required: false },
        { item: "Non-disparagement scope reasonable", category: "negotiation_point", required: false },
        { item: "Tax treatment addressed", category: "compliance", required: true },
        { item: "Liens and subrogation addressed", category: "legal_risk", required: true },
        { item: "Court approval provisions (if needed)", category: "procedural", required: false },
        { item: "Enforcement mechanism included", category: "legal_risk", required: true },
        { item: "Unknown claims language reviewed", category: "legal_risk", required: true },
      ],
    },
    {
      name: "Federal Discovery Response (FRCP)",
      documentType: "discovery_response",
      practiceArea: "general",
      items: [
        { item: "Responses served within 30 days", category: "procedural", required: true, ruleReference: "FRCP 33(b)(2)" },
        { item: "Each request answered or objected to individually", category: "completeness", required: true, ruleReference: "FRCP 34(b)(2)" },
        { item: "Objections state with specificity", category: "compliance", required: true, ruleReference: "FRCP 34(b)(2)(B)" },
        { item: "Documents produced as kept in ordinary course or by category", category: "compliance", required: true, ruleReference: "FRCP 34(b)(2)(E)" },
        { item: "ESI produced in agreed or native format", category: "compliance", required: false, ruleReference: "FRCP 34(b)(2)(E)" },
        { item: "Privilege log provided", category: "privilege", required: true, ruleReference: "FRCP 26(b)(5)" },
        { item: "Certification of completeness", category: "compliance", required: true, ruleReference: "FRCP 26(g)" },
      ],
    },
  ];
}

// ---------------------------------------------------------------------------
// 7. Sample Review for Demo
// ---------------------------------------------------------------------------

export function getSampleReview() {
  return {
    review: {
      id: "sample-review-1",
      documentName: "Defendant's Response to Interrogatories — Smith v. Jones",
      documentType: "interrogatory_answers",
      practiceArea: "personal_injury",
      jurisdiction: "ny_supreme",
      reviewStatus: "completed",
      overallRiskLevel: "high",
      summaryText: "Defendant's interrogatory responses contain several critical deficiencies. Multiple responses are evasive or incomplete, particularly regarding the timeline of events and insurance coverage. Several objections lack specificity as required by CPLR 3133. Privilege claims are made without a corresponding privilege log. Immediate follow-up recommended.",
      totalFlags: 8,
      criticalFlags: 2,
      highFlags: 3,
      mediumFlags: 2,
      lowFlags: 1,
      resolvedFlags: 0,
      aiModelUsed: "claude-sonnet-4-20250514",
      processingTime: 12,
      createdAt: new Date().toISOString(),
    },
    flags: [
      {
        id: "sample-flag-1",
        reviewId: "sample-review-1",
        flagType: "evasive_response",
        severity: "critical",
        category: "completeness",
        title: "Evasive Response to Interrogatory #5 — Accident Timeline",
        description: "Defendant's response to Interrogatory #5 requesting a detailed timeline of events leading to the accident states only 'Defendant was driving in a normal manner.' This fails to address the specific questions about speed, road conditions, visibility, and actions taken prior to impact.",
        recommendation: "File motion to compel pursuant to CPLR 3124. Send meet-and-confer letter first demanding complete response within 20 days.",
        documentSection: "Interrogatory #5",
        relevantText: "ANSWER: Defendant was driving in a normal manner and denies any negligent conduct.",
        ruleReference: "CPLR 3133",
        status: "open",
        sortOrder: 0,
      },
      {
        id: "sample-flag-2",
        reviewId: "sample-review-1",
        flagType: "privilege_issue",
        severity: "critical",
        category: "privilege",
        title: "Privilege Claimed Without Privilege Log",
        description: "Defendant asserts attorney-client privilege and work product protection for Interrogatories #8 and #12 but has not provided the required privilege log identifying the withheld communications.",
        recommendation: "Demand privilege log within 10 days per CPLR 3122. Without a proper privilege log, the privilege is deemed waived.",
        documentSection: "Interrogatories #8, #12",
        relevantText: "OBJECTION: This interrogatory seeks information protected by the attorney-client privilege and work product doctrine.",
        ruleReference: "CPLR 3122",
        status: "open",
        sortOrder: 1,
      },
      {
        id: "sample-flag-3",
        reviewId: "sample-review-1",
        flagType: "incomplete_response",
        severity: "high",
        category: "completeness",
        title: "Incomplete Insurance Coverage Disclosure",
        description: "Response to Interrogatory #3 regarding insurance coverage identifies only the primary liability policy but fails to disclose umbrella/excess coverage, which is required under CPLR 3101(f).",
        recommendation: "Send supplemental demand specifically requesting umbrella/excess policy information and SIR details.",
        documentSection: "Interrogatory #3",
        ruleReference: "CPLR 3101(f)",
        status: "open",
        sortOrder: 2,
      },
      {
        id: "sample-flag-4",
        reviewId: "sample-review-1",
        flagType: "inconsistency",
        severity: "high",
        category: "accuracy",
        title: "Date Inconsistency — Employment History",
        description: "Defendant states in Interrogatory #7 that they were employed at ABC Corp from 2020-2024, but in Interrogatory #15 references 'during my time at ABC Corp in 2018.' This creates an inconsistency in the employment timeline.",
        recommendation: "Note for deposition preparation. Use this inconsistency to impeach credibility. Request supplemental response clarifying dates.",
        documentSection: "Interrogatories #7, #15",
        status: "open",
        sortOrder: 3,
      },
      {
        id: "sample-flag-5",
        reviewId: "sample-review-1",
        flagType: "missing_item",
        severity: "high",
        category: "completeness",
        title: "Missing Witness Identification",
        description: "Interrogatory #10 requested identification of all witnesses to the accident. Response lists only 'the parties involved' without identifying any third-party witnesses, passengers, or first responders.",
        recommendation: "Demand supplemental response identifying all witnesses by name, address, and telephone number. This is a standard interrogatory that requires complete disclosure.",
        documentSection: "Interrogatory #10",
        ruleReference: "CPLR 3130",
        status: "open",
        sortOrder: 4,
      },
      {
        id: "sample-flag-6",
        reviewId: "sample-review-1",
        flagType: "boilerplate_deviation",
        severity: "medium",
        category: "procedural",
        title: "Boilerplate Objections to Multiple Interrogatories",
        description: "Defendant interposes identical 'overly broad and unduly burdensome' objections to Interrogatories #6, #9, #11, #14 without any particularized showing of burden.",
        recommendation: "Challenge boilerplate objections in meet-and-confer letter. Courts routinely overrule non-specific objections. Cite Forman v. Henkin, 30 N.Y.3d 656 (2018).",
        documentSection: "Interrogatories #6, #9, #11, #14",
        status: "open",
        sortOrder: 5,
      },
      {
        id: "sample-flag-7",
        reviewId: "sample-review-1",
        flagType: "missing_document",
        severity: "medium",
        category: "completeness",
        title: "Missing Verification Page",
        description: "The interrogatory responses do not appear to include a signed verification page. Under CPLR 3133, interrogatory answers must be verified (sworn to).",
        recommendation: "Demand verified responses. Unverified responses may be treated as a nullity.",
        ruleReference: "CPLR 3133(b)",
        status: "open",
        sortOrder: 6,
      },
      {
        id: "sample-flag-8",
        reviewId: "sample-review-1",
        flagType: "deadline_triggered",
        severity: "low",
        category: "procedural",
        title: "Discovery Supplementation Deadline",
        description: "Defendant has an ongoing obligation to supplement responses if additional information becomes available. Calendar a follow-up date to check for supplementation.",
        recommendation: "Calendar 60-day follow-up to demand supplemental responses if case developments warrant.",
        ruleReference: "CPLR 3101(h)",
        status: "open",
        sortOrder: 7,
      },
    ],
  };
}
