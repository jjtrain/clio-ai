import { db } from "@/lib/db";
import * as docketwise from "@/lib/integrations/docketwise";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();
const MODEL = "claude-sonnet-4-20250514";

// ── Case Management ──────────────────────────────────────────────────

export async function createImmigrationCase(params: {
  clientId: string; matterId: string; caseType: string;
  beneficiaryName: string; petitionerName?: string; priorityDate?: Date; notes?: string;
}) {
  const immCase = await db.immigrationCase.create({
    data: {
      clientId: params.clientId, matterId: params.matterId, caseType: params.caseType as any,
      status: "PREPARING", beneficiaryName: params.beneficiaryName,
      petitionerName: params.petitionerName || null,
      priorityDate: params.priorityDate || null, notes: params.notes || null,
    },
  });

  // Auto-generate forms, checklist, deadlines
  const forms = getRequiredForms(params.caseType);
  for (const f of forms) {
    await db.immigrationForm.create({
      data: { caseId: immCase.id, matterId: params.matterId, formNumber: f.formNumber, formTitle: f.formTitle, status: "NOT_STARTED" },
    });
  }

  const docs = getDocumentChecklist(params.caseType);
  for (const d of docs) {
    await db.immigrationDocument.create({
      data: { caseId: immCase.id, docType: d.docType as any, title: d.title, isRequired: d.isRequired },
    });
  }

  await calculateDeadlines(immCase.id);

  // Sync to Docketwise if configured
  const config = await db.immigrationIntegration.findUnique({ where: { provider: "DOCKETWISE" } });
  if (config?.isEnabled) {
    const dwResult = await docketwise.createCase({
      case_type: params.caseType, beneficiary_name: params.beneficiaryName,
      petitioner_name: params.petitionerName, priority_date: params.priorityDate?.toISOString(),
    });
    if (dwResult.success) {
      await db.immigrationCase.update({
        where: { id: immCase.id },
        data: { externalCaseId: dwResult.data.id, provider: "DOCKETWISE" },
      });
    }
  }

  return immCase;
}

// ── Forms & Documents ────────────────────────────────────────────────

export function getRequiredForms(caseType: string): { formNumber: string; formTitle: string; isRequired: boolean }[] {
  const formMap: Record<string, { formNumber: string; formTitle: string; isRequired: boolean }[]> = {
    "H-1B": [
      { formNumber: "I-129", formTitle: "Petition for Nonimmigrant Worker", isRequired: true },
      { formNumber: "I-129H", formTitle: "H Classification Supplement", isRequired: true },
      { formNumber: "I-907", formTitle: "Request for Premium Processing", isRequired: false },
    ],
    "L-1": [
      { formNumber: "I-129", formTitle: "Petition for Nonimmigrant Worker", isRequired: true },
      { formNumber: "I-129L", formTitle: "L Classification Supplement", isRequired: true },
    ],
    "EB-1": [
      { formNumber: "I-140", formTitle: "Immigrant Petition for Alien Workers", isRequired: true },
      { formNumber: "I-485", formTitle: "Application to Register Permanent Residence", isRequired: false },
      { formNumber: "I-131", formTitle: "Application for Travel Document", isRequired: false },
      { formNumber: "I-765", formTitle: "Application for Employment Authorization", isRequired: false },
    ],
    "EB-2": [
      { formNumber: "I-140", formTitle: "Immigrant Petition for Alien Workers", isRequired: true },
      { formNumber: "I-485", formTitle: "Application to Register Permanent Residence", isRequired: false },
      { formNumber: "I-131", formTitle: "Application for Travel Document", isRequired: false },
      { formNumber: "I-765", formTitle: "Application for Employment Authorization", isRequired: false },
    ],
    "EB-3": [
      { formNumber: "I-140", formTitle: "Immigrant Petition for Alien Workers", isRequired: true },
      { formNumber: "I-485", formTitle: "Application to Register Permanent Residence", isRequired: false },
    ],
    "PERM": [
      { formNumber: "ETA-9089", formTitle: "Application for Permanent Employment Certification", isRequired: true },
    ],
    "F-1-OPT": [
      { formNumber: "I-765", formTitle: "Application for Employment Authorization", isRequired: true },
    ],
    "O-1": [
      { formNumber: "I-129", formTitle: "Petition for Nonimmigrant Worker", isRequired: true },
      { formNumber: "I-129O", formTitle: "O and P Classifications Supplement", isRequired: true },
    ],
    "NATURALIZATION": [
      { formNumber: "N-400", formTitle: "Application for Naturalization", isRequired: true },
    ],
    "FAMILY-I130": [
      { formNumber: "I-130", formTitle: "Petition for Alien Relative", isRequired: true },
      { formNumber: "I-130A", formTitle: "Supplemental Information for Spouse", isRequired: false },
      { formNumber: "I-485", formTitle: "Application to Register Permanent Residence", isRequired: false },
      { formNumber: "I-864", formTitle: "Affidavit of Support", isRequired: true },
    ],
  };
  return formMap[caseType] || [];
}

export function getDocumentChecklist(caseType: string): { docType: string; title: string; isRequired: boolean }[] {
  const base = [
    { docType: "PASSPORT", title: "Valid Passport (all pages)", isRequired: true },
    { docType: "PHOTO", title: "Passport-style photographs", isRequired: true },
    { docType: "I-94", title: "I-94 Arrival/Departure Record", isRequired: true },
  ];
  const specific: Record<string, { docType: string; title: string; isRequired: boolean }[]> = {
    "H-1B": [
      { docType: "LCA", title: "Certified Labor Condition Application", isRequired: true },
      { docType: "DEGREE", title: "Degree certificates and transcripts", isRequired: true },
      { docType: "RESUME", title: "Beneficiary resume/CV", isRequired: true },
      { docType: "OFFER_LETTER", title: "Employer offer/support letter", isRequired: true },
      { docType: "CREDENTIAL_EVAL", title: "Credential evaluation (if foreign degree)", isRequired: false },
    ],
    "EB-1": [
      { docType: "EVIDENCE", title: "Evidence of extraordinary ability", isRequired: true },
      { docType: "RECOMMENDATION", title: "Recommendation letters", isRequired: true },
      { docType: "PUBLICATIONS", title: "Publications and citations", isRequired: false },
    ],
    "EB-2": [
      { docType: "DEGREE", title: "Advanced degree or equivalent", isRequired: true },
      { docType: "PERM_CERT", title: "PERM Labor Certification (unless NIW)", isRequired: false },
      { docType: "RECOMMENDATION", title: "Recommendation letters", isRequired: true },
    ],
    "FAMILY-I130": [
      { docType: "MARRIAGE_CERT", title: "Marriage certificate", isRequired: true },
      { docType: "BIRTH_CERT", title: "Birth certificate", isRequired: true },
      { docType: "FINANCIAL", title: "Tax returns and financial documents", isRequired: true },
      { docType: "RELATIONSHIP_EVIDENCE", title: "Evidence of bona fide relationship", isRequired: true },
    ],
    "NATURALIZATION": [
      { docType: "GREEN_CARD", title: "Permanent Resident Card", isRequired: true },
      { docType: "TAX_RETURNS", title: "Tax returns (last 5 years)", isRequired: true },
      { docType: "TRAVEL_HISTORY", title: "Travel history records", isRequired: true },
    ],
  };
  return [...base, ...(specific[caseType] || [])];
}

// ── Deadlines ────────────────────────────────────────────────────────

export async function calculateDeadlines(caseId: string) {
  const immCase = await db.immigrationCase.findUnique({ where: { id: caseId } });
  if (!immCase) return [];

  const deadlines: { title: string; dueDate: Date; type: string }[] = [];
  const now = new Date();

  if (immCase.beneficiaryStatusExpiry) {
    // 90-day reminder before status expiry
    const reminder90 = new Date(immCase.beneficiaryStatusExpiry);
    reminder90.setDate(reminder90.getDate() - 90);
    if (reminder90 > now) deadlines.push({ title: "Status expiration 90-day warning", dueDate: reminder90, type: "STATUS_EXPIRY_WARNING" });

    // 30-day reminder
    const reminder30 = new Date(immCase.beneficiaryStatusExpiry);
    reminder30.setDate(reminder30.getDate() - 30);
    if (reminder30 > now) deadlines.push({ title: "Status expiration 30-day warning", dueDate: reminder30, type: "STATUS_EXPIRY_WARNING" });

    deadlines.push({ title: "Status expiration date", dueDate: immCase.beneficiaryStatusExpiry, type: "STATUS_EXPIRY" });
  }

  // RFE deadline (typically 87 days from issuance)
  if (immCase.status === "RFE_ISSUED" && immCase.rfeDate) {
    const rfeDue = new Date(immCase.rfeDate);
    rfeDue.setDate(rfeDue.getDate() + 87);
    deadlines.push({ title: "RFE response deadline", dueDate: rfeDue, type: "RFE_DEADLINE" });
  }

  for (const dl of deadlines) {
    await db.immigrationDeadline.create({
      data: { caseId: caseId, matterId: immCase.matterId, title: dl.title, dueDate: dl.dueDate, deadlineType: dl.type as any, status: "UPCOMING" },
    });
  }

  return deadlines;
}

// ── USCIS Status ─────────────────────────────────────────────────────

export async function checkUSCISStatus(caseId: string) {
  const immCase = await db.immigrationCase.findUnique({ where: { id: caseId } });
  if (!immCase?.receiptNumber) return { success: false, error: "No receipt number on case." };

  const config = await db.immigrationIntegration.findUnique({ where: { provider: "DOCKETWISE" } });
  let statusData: any = null;

  if (config?.isEnabled) {
    const result = await docketwise.checkCaseStatus(immCase.receiptNumber);
    if (result.success) statusData = result.data;
  }

  const check = await db.uSCISStatusCheck.create({
    data: {
      caseId: caseId, receiptNumber: immCase.receiptNumber || "",
      currentStatus: statusData?.status || "UNKNOWN",
      previousStatus: immCase.lastCaseStatusResult || null,
      statusDescription: statusData?.description || null,
      hasChanged: statusData?.status !== immCase.lastCaseStatusResult,
      rawResponse: statusData ? JSON.stringify(statusData) : null,
    },
  });

  // Update case if status changed
  if (statusData?.status && statusData.status !== immCase.status) {
    await db.immigrationCase.update({ where: { id: caseId }, data: { status: statusData.status } });
  }

  return { success: true, data: check };
}

export async function checkAllCaseStatuses() {
  const activeCases = await db.immigrationCase.findMany({
    where: { receiptNumber: { not: null }, status: { notIn: ["APPROVED", "DENIED", "WITHDRAWN"] } },
  });

  const results = [];
  for (const c of activeCases) {
    const result = await checkUSCISStatus(c.id);
    results.push({ caseId: c.id, receiptNumber: c.receiptNumber, ...result });
  }
  return results;
}

// ── Visa Bulletin ────────────────────────────────────────────────────

export async function checkVisaBulletin() {
  const config = await db.immigrationIntegration.findUnique({ where: { provider: "DOCKETWISE" } });
  if (!config?.isEnabled) return { success: false, error: "Docketwise not configured." };

  const result = await docketwise.getVisaBulletin();
  if (!result.success) return result;

  const bulletin = result.data;
  const entries = Array.isArray(bulletin.entries) ? bulletin.entries : [];
  for (const entry of entries) {
    await db.visaBulletinEntry.create({
      data: {
        category: entry.category || "",
        country: entry.chargeability || entry.country || "All Chargeability",
        bulletinMonth: entry.month || new Date().getMonth() + 1,
        bulletinYear: entry.year || new Date().getFullYear(),
        finalActionDate: entry.final_action_date ? new Date(entry.final_action_date) : null,
        datesForFilingDate: entry.dates_for_filing ? new Date(entry.dates_for_filing) : null,
        isCurrent: entry.is_current || false,
      },
    });
  }

  // Check impact on active cases with priority dates
  const activeCases = await db.immigrationCase.findMany({
    where: { priorityDate: { not: null }, status: { notIn: ["APPROVED", "DENIED", "WITHDRAWN"] } },
  });
  const impacted = [];
  for (const c of activeCases) {
    const relevant = entries.find((e: any) => e.category === c.caseType);
    if (relevant?.final_action_date && c.priorityDate && c.priorityDate <= new Date(relevant.final_action_date)) {
      impacted.push({ caseId: c.id, caseType: c.caseType, priorityDate: c.priorityDate, currentDate: relevant.final_action_date });
    }
  }

  return { success: true, data: { entriesSaved: entries.length, impactedCases: impacted } };
}

// ── AI Features ──────────────────────────────────────────────────────

export async function analyzeRFE(caseId: string, rfeText: string) {
  const immCase = await db.immigrationCase.findUnique({ where: { id: caseId }, include: { forms: true, documents: true } });
  if (!immCase) return { success: false, error: "Case not found." };

  const message = await anthropic.messages.create({
    model: MODEL, max_tokens: 4096,
    messages: [{ role: "user", content: `You are an immigration attorney analyzing an RFE (Request for Evidence) from USCIS.

Case Type: ${immCase.caseType}
Beneficiary: ${immCase.beneficiaryName}
Forms filed: ${immCase.forms.map(f => f.formNumber).join(", ")}
Documents on file: ${immCase.documents.map(d => d.title).join(", ")}

RFE Text:
${rfeText}

Provide: 1) Summary of what USCIS is requesting, 2) Analysis of each deficiency, 3) Recommended evidence to submit, 4) Response strategy, 5) Deadline considerations.` }],
  });

  const analysis = message.content[0].type === "text" ? message.content[0].text : "";
  await db.immigrationActivity.create({
    data: { caseId: caseId, activityType: "NOTE_ADDED" as any, description: "AI analysis of RFE completed", metadata: JSON.stringify({ rfeText, analysis }) },
  });
  return { success: true, data: { analysis } };
}

export async function generateRFEResponse(caseId: string) {
  const immCase = await db.immigrationCase.findUnique({ where: { id: caseId }, include: { forms: true, documents: true, activities: true } });
  if (!immCase) return { success: false, error: "Case not found." };

  const rfeActivity = immCase.activities.find(a => (a.activityType as string) === "NOTE_ADDED" && a.description?.includes("RFE"));
  const rfeData = rfeActivity?.metadata ? JSON.parse(rfeActivity.metadata) : null;

  const message = await anthropic.messages.create({
    model: MODEL, max_tokens: 8192,
    messages: [{ role: "user", content: `Draft a comprehensive RFE response letter for this immigration case.

Case Type: ${immCase.caseType} | Receipt #: ${immCase.receiptNumber || "N/A"}
Beneficiary: ${immCase.beneficiaryName} | Petitioner: ${immCase.petitionerName || "N/A"}
RFE Text: ${rfeData?.rfeText || "Not available"}
Previous Analysis: ${rfeData?.analysis || "None"}
Documents available: ${immCase.documents.map(d => d.title).join(", ")}

Draft a professional response addressing each point in the RFE with references to supporting evidence.` }],
  });

  const response = message.content[0].type === "text" ? message.content[0].text : "";
  return { success: true, data: { response } };
}

export async function generateCoverLetter(caseId: string, formNumbers: string[]) {
  const immCase = await db.immigrationCase.findUnique({
    where: { id: caseId }, include: { client: true, matter: true, documents: true },
  });
  if (!immCase) return { success: false, error: "Case not found." };

  const message = await anthropic.messages.create({
    model: MODEL, max_tokens: 4096,
    messages: [{ role: "user", content: `Draft a cover letter for an immigration filing.

Case Type: ${immCase.caseType} | Forms: ${formNumbers.join(", ")}
Beneficiary: ${immCase.beneficiaryName} | Petitioner: ${immCase.petitionerName || "N/A"}
Client: ${immCase.client.name} | Matter: ${immCase.matter.name}
Supporting Documents: ${immCase.documents.map((d, i) => `${i + 1}. ${d.title}`).join("\n")}

Generate a professional cover letter listing all enclosed forms and supporting documents.` }],
  });

  const letter = message.content[0].type === "text" ? message.content[0].text : "";
  return { success: true, data: { coverLetter: letter } };
}

export async function generateExhibitList(caseId: string) {
  const immCase = await db.immigrationCase.findUnique({ where: { id: caseId }, include: { documents: true } });
  if (!immCase) return { success: false, error: "Case not found." };

  const exhibits = immCase.documents.map((doc, index) => ({
    exhibitNumber: String.fromCharCode(65 + index), // A, B, C...
    title: doc.title,
    docType: doc.docType,
    description: doc.title,
    pages: null as number | null,
  }));

  return { success: true, data: { caseType: immCase.caseType, beneficiary: immCase.beneficiaryName, exhibits } };
}

// ── Processing Times & Premium ───────────────────────────────────────

export async function checkProcessingTimes(formNumber: string, office?: string) {
  const config = await db.immigrationIntegration.findUnique({ where: { provider: "DOCKETWISE" } });
  if (!config?.isEnabled) return { success: false, error: "Docketwise not configured." };
  return docketwise.getProcessingTimes({ formNumber, office });
}

export async function assessPremiumProcessing(caseId: string) {
  const immCase = await db.immigrationCase.findUnique({ where: { id: caseId }, include: { forms: true } });
  if (!immCase) return { success: false, error: "Case not found." };

  const premiumEligible: Record<string, boolean> = {
    "I-129": true, "I-140": true, "I-539": true, "I-765": false, "I-485": false,
  };
  const premiumFee = 2805;
  const formNumbers = immCase.forms.map(f => f.formNumber);
  const eligible = formNumbers.some(fn => premiumEligible[fn] === true);
  const eligibleForms = formNumbers.filter(fn => premiumEligible[fn] === true);

  return {
    success: true,
    data: {
      eligible, eligibleForms, fee: eligible ? premiumFee : 0,
      recommendation: eligible
        ? "Premium processing is available and reduces processing to 15 business days."
        : "Premium processing is not available for the forms in this case.",
    },
  };
}

// ── Strategy & Dependents ────────────────────────────────────────────

export async function buildCaseStrategy(caseId: string) {
  const immCase = await db.immigrationCase.findUnique({
    where: { id: caseId }, include: { client: true, matter: true, forms: true, documents: true, deadlines: true },
  });
  if (!immCase) return { success: false, error: "Case not found." };

  const message = await anthropic.messages.create({
    model: MODEL, max_tokens: 8192,
    messages: [{ role: "user", content: `Create a comprehensive immigration case strategy memo.

Case Type: ${immCase.caseType} | Status: ${immCase.status}
Beneficiary: ${immCase.beneficiaryName} | Petitioner: ${immCase.petitionerName || "N/A"}
Priority Date: ${immCase.priorityDate?.toISOString() || "N/A"}
Receipt #: ${immCase.receiptNumber || "Not yet filed"}
Practice Area: ${immCase.matter.practiceArea || "Immigration"}
Forms: ${immCase.forms.map(f => `${f.formNumber} (${f.status})`).join(", ")}
Documents: ${immCase.documents.length} on file
Deadlines: ${immCase.deadlines.map(d => `${d.title}: ${d.dueDate.toISOString()}`).join(", ")}

Provide: 1) Case overview, 2) Eligibility analysis, 3) Filing strategy and timeline, 4) Risk factors, 5) Alternative options, 6) Recommended next steps.` }],
  });

  const strategy = message.content[0].type === "text" ? message.content[0].text : "";
  await db.immigrationActivity.create({
    data: { caseId: caseId, activityType: "NOTE_ADDED" as any, description: "AI case strategy memo generated", metadata: JSON.stringify({ strategy }) },
  });
  return { success: true, data: { strategy } };
}

export async function trackDependents(caseId: string) {
  const immCase = await db.immigrationCase.findUnique({ where: { id: caseId } });
  if (!immCase) return { success: false, error: "Case not found." };

  const dependents = await db.immigrationCase.findMany({
    where: {
      clientId: immCase.clientId,
      id: { not: caseId },
      petitionerName: immCase.beneficiaryName,
    },
    include: { forms: true },
  });

  return {
    success: true,
    data: {
      primaryCase: { id: immCase.id, caseType: immCase.caseType, status: immCase.status, beneficiary: immCase.beneficiaryName },
      dependents: dependents.map(d => ({
        id: d.id, caseType: d.caseType, status: d.status,
        beneficiary: d.beneficiaryName, forms: d.forms.map(f => f.formNumber),
      })),
    },
  };
}

// ── Fee Calculator ───────────────────────────────────────────────────

export async function calculateFees(caseType: string, options?: { premiumProcessing?: boolean; concurrentFiling?: boolean }) {
  const feeSchedule: Record<string, { form: string; fee: number }[]> = {
    "H-1B": [{ form: "I-129", fee: 460 }, { form: "Anti-Fraud Fee", fee: 500 }, { form: "ACWIA Fee (25+ employees)", fee: 1500 }],
    "L-1": [{ form: "I-129", fee: 460 }, { form: "Anti-Fraud Fee", fee: 500 }],
    "O-1": [{ form: "I-129", fee: 460 }],
    "EB-1": [{ form: "I-140", fee: 700 }],
    "EB-2": [{ form: "I-140", fee: 700 }],
    "EB-3": [{ form: "I-140", fee: 700 }],
    "PERM": [{ form: "ETA-9089", fee: 0 }],
    "NATURALIZATION": [{ form: "N-400", fee: 725 }, { form: "Biometrics", fee: 85 }],
    "FAMILY-I130": [{ form: "I-130", fee: 535 }],
    "F-1-OPT": [{ form: "I-765", fee: 410 }],
  };

  const fees = feeSchedule[caseType] || [];
  let total = fees.reduce((sum, f) => sum + f.fee, 0);

  if (options?.premiumProcessing) {
    fees.push({ form: "I-907 Premium Processing", fee: 2805 });
    total += 2805;
  }

  if (options?.concurrentFiling) {
    fees.push({ form: "I-485", fee: 1140 }, { form: "I-131 (Travel)", fee: 0 }, { form: "I-765 (EAD)", fee: 0 });
    total += 1140;
  }

  return { success: true, data: { caseType, fees, total } };
}
