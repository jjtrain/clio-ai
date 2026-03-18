import { db } from "@/lib/db";
import {
  casemailCreateMailJob,
  casemailValidateAddress,
  casemailGetTrackingStatus,
  casemailGetProofOfMailing,
  casemailGetProofOfDelivery,
  casemailGetReturnReceipt,
} from "./integrations/casemail";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

// ── Helpers ──

async function getMailConfig() {
  return db.mailIntegration.findUnique({ where: { provider: "CASEMAIL" } });
}

async function callAnthropic(system: string, userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 2048, system, messages: [{ role: "user", content: userMessage }] }),
  });
  if (!res.ok) throw new Error(`Anthropic API error: ${res.status}`);
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

// ── Core Functions ──

export async function sendMail(params: {
  matterId: string;
  recipientName: string;
  recipientAddress: string;
  recipientCity?: string;
  recipientState?: string;
  recipientZip?: string;
  documentIds: string[];
  mailClass?: string;
  purpose?: string;
  isColor?: boolean;
  isDuplex?: boolean;
  certifiedMail?: boolean;
  returnReceipt?: boolean;
  senderName?: string;
  senderAddress?: string;
  notes?: string;
  serviceJobId?: string;
}) {
  const config = await getMailConfig();
  const docs = await db.document.findMany({ where: { id: { in: params.documentIds } } });
  const docNames = docs.map(d => d.name).join(", ");

  const jobType = params.certifiedMail
    ? (params.returnReceipt ? "CERTIFIED_RETURN_RECEIPT" : "CERTIFIED")
    : (params.mailClass?.toUpperCase() || "FIRST_CLASS");

  let externalJobId: string | null = null;
  let status = "DRAFT";
  let trackingNumber: string | null = null;
  let totalCost: number | null = null;

  if (config?.isEnabled && config.apiKey) {
    const result = await casemailCreateMailJob({
      recipientName: params.recipientName,
      recipientAddress: params.recipientAddress,
      recipientCity: params.recipientCity,
      recipientState: params.recipientState,
      recipientZip: params.recipientZip,
      documentUrls: docs.map(d => d.path),
      mailClass: params.mailClass,
      isColor: params.isColor,
      isDuplex: params.isDuplex,
      certifiedMail: params.certifiedMail,
      returnReceipt: params.returnReceipt,
      returnName: params.senderName,
      returnAddress: params.senderAddress,
    });
    if (result.success && result.data) {
      externalJobId = result.data.jobId;
      status = "SUBMITTED";
      trackingNumber = result.data.trackingNumber || null;
      totalCost = result.data.estimatedCost ? Number(result.data.estimatedCost) : null;
    }
  }

  const job = await db.mailJob.create({
    data: {
      provider: "CASEMAIL",
      externalJobId,
      matterId: params.matterId,
      serviceJobId: params.serviceJobId || null,
      jobType: jobType as any,
      purpose: (params.purpose || "CORRESPONDENCE") as any,
      status: status as any,
      recipientName: params.recipientName,
      recipientAddress: params.recipientAddress,
      recipientCity: params.recipientCity,
      recipientState: params.recipientState,
      recipientZip: params.recipientZip,
      senderName: params.senderName,
      senderAddress: params.senderAddress,
      documentIds: JSON.stringify(params.documentIds),
      documentNames: docNames,
      totalPages: docs.length,
      isColor: params.isColor ?? false,
      isDuplex: params.isDuplex ?? false,
      trackingNumber,
      totalCost,
      notes: params.notes,
    },
  });

  // Auto-track cost as expense
  if (config?.autoTrackCosts && totalCost) {
    await db.expense.create({
      data: {
        matterId: params.matterId,
        vendorName: "CaseMail",
        category: "POSTAGE",
        description: `Mail: ${jobType} to ${params.recipientName} - ${docNames}`,
        amount: totalCost,
        date: new Date(),
        isBillable: true,
      },
    });
  }

  return job;
}

export async function sendBulkMail(params: {
  matterId?: string;
  recipients: Array<{ name: string; address: string; city?: string; state?: string; zip?: string }>;
  documentIds: string[];
  mailClass?: string;
  purpose?: string;
  batchName: string;
  isColor?: boolean;
}) {
  const batch = await db.mailBatch.create({
    data: {
      matterId: params.matterId,
      name: params.batchName,
      status: "SUBMITTED",
      jobCount: params.recipients.length,
      submittedAt: new Date(),
    },
  });

  const jobs = [];
  for (const recipient of params.recipients) {
    const job = await sendMail({
      matterId: params.matterId || "",
      recipientName: recipient.name,
      recipientAddress: recipient.address,
      recipientCity: recipient.city,
      recipientState: recipient.state,
      recipientZip: recipient.zip,
      documentIds: params.documentIds,
      mailClass: params.mailClass,
      purpose: params.purpose,
      isColor: params.isColor,
    });
    await db.mailJob.update({ where: { id: job.id }, data: { batchId: batch.id } });
    jobs.push(job);
  }

  return batch;
}

export async function sendNailAndMailMailing(serviceJobId: string) {
  const serviceJob = await db.serviceJob.findUnique({ where: { id: serviceJobId } });
  if (!serviceJob) throw new Error(`ServiceJob ${serviceJobId} not found`);

  const documentIds: string[] = serviceJob.documentIds ? JSON.parse(serviceJob.documentIds) : [];

  const job = await sendMail({
    matterId: serviceJob.matterId,
    recipientName: serviceJob.recipientName,
    recipientAddress: serviceJob.serviceAddress,
    recipientCity: serviceJob.serviceCity || undefined,
    recipientState: serviceJob.serviceState || undefined,
    recipientZip: serviceJob.serviceZip || undefined,
    documentIds,
    mailClass: "first_class",
    purpose: "NAIL_AND_MAIL_MAILING",
    serviceJobId,
  });

  return job;
}

export async function sendCertifiedMail(params: {
  matterId: string;
  recipientName: string;
  recipientAddress: string;
  recipientCity?: string;
  recipientState?: string;
  recipientZip?: string;
  documentIds: string[];
  purpose?: string;
  returnReceipt?: boolean;
  notes?: string;
}) {
  return sendMail({
    ...params,
    mailClass: "certified",
    certifiedMail: true,
    returnReceipt: params.returnReceipt ?? true,
  });
}

export async function generateCoverLetter(params: {
  templateId?: string;
  variables?: Record<string, string>;
  recipientName?: string;
  senderName?: string;
  firmName?: string;
  matterId?: string;
  purpose?: string;
  documentNames?: string[];
}): Promise<string> {
  if (params.templateId) {
    const template = await db.mailTemplate.findUnique({ where: { id: params.templateId } });
    if (!template?.coverLetterContent) throw new Error("Template not found or has no content");
    let html = template.coverLetterContent;
    const vars = params.variables || {};
    vars.recipientName = vars.recipientName || params.recipientName || "";
    vars.senderName = vars.senderName || params.senderName || "";
    vars.firmName = vars.firmName || params.firmName || "";
    vars.date = vars.date || new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    vars.documentList = vars.documentList || (params.documentNames || []).map(n => `<li>${n}</li>`).join("");
    for (const [key, value] of Object.entries(vars)) {
      html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
    }
    await db.mailTemplate.update({ where: { id: params.templateId }, data: { usageCount: { increment: 1 } } });
    return html;
  }

  // AI-generated cover letter
  const prompt = `Generate a professional legal transmittal/cover letter in HTML format.
Recipient: ${params.recipientName || "Recipient"}
Sender: ${params.senderName || "Attorney"} at ${params.firmName || "the firm"}
Purpose: ${params.purpose || "transmittal of enclosed documents"}
Documents enclosed: ${(params.documentNames || []).join(", ") || "enclosed documents"}
Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
Keep it concise and professional. Return only the HTML body content.`;

  return callAnthropic("You are a legal document assistant. Generate professional cover letters in clean HTML.", prompt);
}

export async function validateAddress(address: { addressLine1: string; addressLine2?: string; city: string; state: string; zip: string; country?: string }) {
  const config = await getMailConfig();
  if (config?.isEnabled && config.apiKey) {
    return casemailValidateAddress(address);
  }
  // Basic format check fallback
  const isValid = !!(address.addressLine1 && address.city && address.state && address.zip && /^\d{5}(-\d{4})?$/.test(address.zip));
  return { success: true, data: { isValid, standardized: null, deliverability: isValid ? "likely" : "unknown", corrections: null } };
}

export async function trackAllActive() {
  const activeJobs = await db.mailJob.findMany({ where: { status: { in: ["IN_TRANSIT", "MAILED"] } } });
  const summary = { total: activeJobs.length, updated: 0, delivered: 0, returned: 0, errors: 0 };

  for (const job of activeJobs) {
    if (!job.externalJobId) continue;
    const result = await casemailGetTrackingStatus(job.externalJobId);
    if (!result.success) { summary.errors++; continue; }

    const status = result.data?.status?.toUpperCase();
    if (status && status !== job.status) {
      const updateData: any = { status };
      if (status === "DELIVERED") {
        updateData.deliveredDate = result.data.delivered_date ? new Date(result.data.delivered_date) : new Date();
        updateData.deliveredTo = result.data.delivered_to || null;
        summary.delivered++;
      }
      if (status === "RETURNED") {
        updateData.returnedDate = new Date();
        updateData.returnReason = result.data.return_reason || "Unknown";
        summary.returned++;
      }
      await db.mailJob.update({ where: { id: job.id }, data: updateData });
      summary.updated++;
    }
  }

  return summary;
}

export async function handleDeliveryConfirmed(jobId: string) {
  const job = await db.mailJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`MailJob ${jobId} not found`);

  await db.mailJob.update({ where: { id: jobId }, data: { status: "DELIVERED", deliveredDate: job.deliveredDate || new Date() } });

  const config = await getMailConfig();
  if (config?.autoSaveProofs && job.externalJobId) {
    // Download and save proof of mailing
    const pomResult = await casemailGetProofOfMailing(job.externalJobId);
    if (pomResult.success && pomResult.data?.url) {
      const doc = await db.document.create({
        data: {
          matterId: job.matterId,
          name: `Proof of Mailing - ${job.recipientName}`,
          filename: `proof-of-mailing-${job.id}.pdf`,
          mimeType: "application/pdf",
          size: 0,
          path: pomResult.data.url,
        },
      });
      await db.mailJob.update({ where: { id: jobId }, data: { proofOfMailingUrl: pomResult.data.url, proofOfMailingDocId: doc.id } });
    }

    // Download and save proof of delivery
    const podResult = await casemailGetProofOfDelivery(job.externalJobId);
    if (podResult.success && podResult.data?.url) {
      const doc = await db.document.create({
        data: {
          matterId: job.matterId,
          name: `Proof of Delivery - ${job.recipientName}`,
          filename: `proof-of-delivery-${job.id}.pdf`,
          mimeType: "application/pdf",
          size: 0,
          path: podResult.data.url,
        },
      });
      await db.mailJob.update({ where: { id: jobId }, data: { proofOfDeliveryUrl: podResult.data.url, proofOfDeliveryDocId: doc.id } });
    }

    // Download and save return receipt if applicable
    if (job.jobType === "CERTIFIED_RETURN_RECEIPT") {
      const rrResult = await casemailGetReturnReceipt(job.externalJobId);
      if (rrResult.success && rrResult.data?.url) {
        const doc = await db.document.create({
          data: {
            matterId: job.matterId,
            name: `Return Receipt - ${job.recipientName}`,
            filename: `return-receipt-${job.id}.pdf`,
            mimeType: "application/pdf",
            size: 0,
            path: rrResult.data.url,
          },
        });
        await db.mailJob.update({ where: { id: jobId }, data: { returnReceiptUrl: rrResult.data.url, returnReceiptDocId: doc.id } });
      }
    }
  }
}

export async function handleReturnToSender(jobId: string) {
  const job = await db.mailJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error(`MailJob ${jobId} not found`);

  await db.mailJob.update({
    where: { id: jobId },
    data: { status: "RETURNED", returnedDate: job.returnedDate || new Date(), returnReason: job.returnReason || "Returned to sender" },
  });

  await db.task.create({
    data: {
      title: `Review returned mail: ${job.recipientName}`,
      description: `Mail to ${job.recipientName} at ${job.recipientAddress} was returned. Reason: ${job.returnReason || "Unknown"}. Please verify the address and determine next steps.`,
      status: "NOT_STARTED",
      priority: "HIGH",
      matterId: job.matterId,
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
    },
  });
}

export async function getCostReport(dateRange: { start: Date; end: Date }, matterId?: string) {
  const where: any = { createdAt: { gte: dateRange.start, lte: dateRange.end } };
  if (matterId) where.matterId = matterId;

  const jobs = await db.mailJob.findMany({ where, select: { jobType: true, purpose: true, totalCost: true, status: true, matterId: true } });

  const totalCost = jobs.reduce((sum, j) => sum + (j.totalCost ? Number(j.totalCost) : 0), 0);
  const byType: Record<string, { count: number; cost: number }> = {};
  const byPurpose: Record<string, { count: number; cost: number }> = {};

  for (const j of jobs) {
    const t = j.jobType;
    if (!byType[t]) byType[t] = { count: 0, cost: 0 };
    byType[t].count++;
    byType[t].cost += j.totalCost ? Number(j.totalCost) : 0;

    const p = j.purpose;
    if (!byPurpose[p]) byPurpose[p] = { count: 0, cost: 0 };
    byPurpose[p].count++;
    byPurpose[p].cost += j.totalCost ? Number(j.totalCost) : 0;
  }

  return { totalJobs: jobs.length, totalCost, byType, byPurpose, dateRange };
}

export async function getDeliveryReport(dateRange: { start: Date; end: Date }) {
  const where = { createdAt: { gte: dateRange.start, lte: dateRange.end } };
  const jobs = await db.mailJob.findMany({ where, select: { status: true, jobType: true, mailedDate: true, deliveredDate: true } });

  const byStatus: Record<string, number> = {};
  let totalDeliveryDays = 0;
  let deliveredCount = 0;

  for (const j of jobs) {
    byStatus[j.status] = (byStatus[j.status] || 0) + 1;
    if (j.status === "DELIVERED" && j.mailedDate && j.deliveredDate) {
      totalDeliveryDays += (j.deliveredDate.getTime() - j.mailedDate.getTime()) / (1000 * 60 * 60 * 24);
      deliveredCount++;
    }
  }

  return {
    totalJobs: jobs.length,
    byStatus,
    deliveredCount,
    returnedCount: byStatus["RETURNED"] || 0,
    avgDeliveryDays: deliveredCount > 0 ? Math.round((totalDeliveryDays / deliveredCount) * 10) / 10 : null,
    dateRange,
  };
}

export async function getMailingHistory(matterId: string) {
  const jobs = await db.mailJob.findMany({
    where: { matterId },
    orderBy: { createdAt: "desc" },
    include: { trackingEvents: { orderBy: { eventDate: "desc" } } },
  });
  return { matterId, totalJobs: jobs.length, jobs };
}

export function suggestMailClass(params: { purpose: string; urgency: string; needsProof: boolean; needsSignature: boolean }): { suggestion: string; reason: string } {
  if (params.needsSignature) return { suggestion: "CERTIFIED_RETURN_RECEIPT", reason: "Signature confirmation required; certified mail with return receipt provides signed proof of delivery." };
  if (params.needsProof) return { suggestion: "CERTIFIED", reason: "Proof of mailing needed; certified mail provides official USPS proof." };
  if (params.urgency === "URGENT" || params.urgency === "EMERGENCY") return { suggestion: "PRIORITY", reason: "Urgent delivery needed; priority mail typically delivers in 1-3 days." };
  if (params.urgency === "OVERNIGHT") return { suggestion: "EXPRESS", reason: "Overnight delivery requested; express mail guarantees next-day delivery." };
  if (params.purpose === "SERVICE_OF_PROCESS" || params.purpose === "SUBPOENA") return { suggestion: "CERTIFIED_RETURN_RECEIPT", reason: "Legal service requires proof of delivery with recipient signature." };
  if (params.purpose === "DEMAND_LETTER" || params.purpose === "LEGAL_NOTICE") return { suggestion: "CERTIFIED", reason: "Legal notices benefit from certified mail for proof of mailing." };
  if (params.purpose === "COURT_FILING") return { suggestion: "PRIORITY", reason: "Court filings should use priority for timely delivery with tracking." };
  return { suggestion: "FIRST_CLASS", reason: "Standard correspondence; first class mail is cost-effective with delivery in 3-5 business days." };
}

// ── Default Templates ──

export async function initializeDefaultTemplates() {
  const defaults = [
    {
      name: "General Transmittal Letter",
      description: "Standard cover letter for document transmittals",
      purpose: "CORRESPONDENCE" as const,
      coverLetterContent: `<p>{{date}}</p><p>{{recipientName}}</p><p>Re: Enclosed Documents</p><p>Dear {{recipientName}},</p><p>Please find enclosed the following document(s) for your review:</p><ul>{{documentList}}</ul><p>Should you have any questions regarding the enclosed, please do not hesitate to contact our office.</p><p>Sincerely,</p><p>{{senderName}}<br/>{{firmName}}</p>`,
      variables: JSON.stringify(["recipientName", "senderName", "firmName", "date", "documentList"]),
    },
    {
      name: "Demand Letter Cover",
      description: "Cover letter for demand letter mailings",
      purpose: "DEMAND_LETTER" as const,
      defaultMailClass: "certified",
      requiresCertified: true,
      coverLetterContent: `<p>{{date}}</p><p>VIA CERTIFIED MAIL</p><p>{{recipientName}}</p><p>Re: {{matterReference}}</p><p>Dear {{recipientName}},</p><p>Enclosed please find the following:</p><ul>{{documentList}}</ul><p>Please review the enclosed correspondence carefully and respond within the time frame specified therein.</p><p>Sincerely,</p><p>{{senderName}}<br/>{{firmName}}</p>`,
      variables: JSON.stringify(["recipientName", "senderName", "firmName", "date", "documentList", "matterReference"]),
    },
    {
      name: "Court Filing Cover Sheet",
      description: "Transmittal for court filings and courtesy copies",
      purpose: "COURT_FILING" as const,
      defaultMailClass: "first_class",
      coverLetterContent: `<p>{{date}}</p><p>{{recipientName}}<br/>{{courtName}}</p><p>Re: {{caseCaption}}<br/>Case No. {{caseNumber}}</p><p>Dear Clerk of Court,</p><p>Enclosed please find the following documents for filing:</p><ul>{{documentList}}</ul><p>Thank you for your attention to this matter.</p><p>Respectfully submitted,</p><p>{{senderName}}<br/>{{firmName}}</p>`,
      variables: JSON.stringify(["recipientName", "senderName", "firmName", "date", "documentList", "courtName", "caseCaption", "caseNumber"]),
    },
    {
      name: "Discovery Cover Letter",
      description: "Cover letter for discovery document productions",
      purpose: "DISCOVERY" as const,
      defaultMailClass: "first_class",
      coverLetterContent: `<p>{{date}}</p><p>{{recipientName}}</p><p>Re: {{caseCaption}}<br/>Case No. {{caseNumber}}</p><p>Dear {{recipientName}},</p><p>In accordance with the applicable rules of discovery, please find enclosed the following:</p><ul>{{documentList}}</ul><p>This production is made subject to and without waiver of any applicable objections or privileges.</p><p>Sincerely,</p><p>{{senderName}}<br/>{{firmName}}</p>`,
      variables: JSON.stringify(["recipientName", "senderName", "firmName", "date", "documentList", "caseCaption", "caseNumber"]),
    },
    {
      name: "Settlement Offer Cover",
      description: "Cover letter for settlement communications",
      purpose: "SETTLEMENT" as const,
      defaultMailClass: "certified",
      requiresCertified: true,
      coverLetterContent: `<p>{{date}}</p><p>VIA CERTIFIED MAIL - RETURN RECEIPT REQUESTED</p><p>{{recipientName}}</p><p>Re: {{caseCaption}}</p><p>Dear {{recipientName}},</p><p>Enclosed please find the following settlement-related documents:</p><ul>{{documentList}}</ul><p>Please review the enclosed and respond at your earliest convenience. This communication is made pursuant to applicable settlement privilege rules.</p><p>Sincerely,</p><p>{{senderName}}<br/>{{firmName}}</p>`,
      variables: JSON.stringify(["recipientName", "senderName", "firmName", "date", "documentList", "caseCaption"]),
      requiresReturnReceipt: true,
    },
    {
      name: "Nail and Mail Notice",
      description: "Cover letter for nail-and-mail service mailings",
      purpose: "NAIL_AND_MAIL_MAILING" as const,
      defaultMailClass: "first_class",
      coverLetterContent: `<p>{{date}}</p><p>{{recipientName}}</p><p>Re: {{caseCaption}}<br/>Case No. {{caseNumber}}</p><p>Dear {{recipientName}},</p><p>In accordance with the court's order for substitute service, the following documents are being served upon you by mail:</p><ul>{{documentList}}</ul><p>These documents were previously affixed to the door of your last known address on {{affixDate}}.</p><p>{{senderName}}<br/>{{firmName}}</p>`,
      variables: JSON.stringify(["recipientName", "senderName", "firmName", "date", "documentList", "caseCaption", "caseNumber", "affixDate"]),
    },
  ];

  for (const tmpl of defaults) {
    const existing = await db.mailTemplate.findFirst({ where: { name: tmpl.name } });
    if (!existing) {
      await db.mailTemplate.create({ data: tmpl as any });
    }
  }

  return { initialized: defaults.length, message: "Default mail templates initialized." };
}
