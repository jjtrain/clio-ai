import { db } from "@/lib/db";
import { type EFilingAdapter } from "./base-adapter";
import { NyscefAdapter } from "./nyscef-adapter";
import { PacerCmecfAdapter } from "./pacer-adapter";

export function getAdapter(systemCode: string): EFilingAdapter {
  switch (systemCode) {
    case "NYSCEF": return new NyscefAdapter();
    case "PACER_CMECF": return new PacerCmecfAdapter();
    default: throw new Error(`Unknown e-filing system: ${systemCode}`);
  }
}

export async function getSystemForCourt(courtCode: string): Promise<any> {
  const systems = await db.eFilingPlatform.findMany({ where: { isActive: true } });
  for (const sys of systems) {
    const courts = sys.supportedCourts as any[];
    if (courts?.some((c: any) => c.code === courtCode)) return sys;
  }
  return null;
}

export async function createSubmission(input: {
  matterId: string; courtCode: string; courtName: string; filingType: string; filingTypeName: string;
  description?: string; isNewCase?: boolean; indexNumber?: string; filedByUserId: string; firmId: string;
  documents: Array<{ documentType: string; documentTypeName: string; title: string; fileName: string; fileUrl: string; fileSizeBytes: number; isLeadDocument: boolean }>;
}): Promise<any> {
  const system = await getSystemForCourt(input.courtCode);
  if (!system) throw new Error(`No e-filing system found for court: ${input.courtCode}`);

  const credential = await db.eFilingPlatformCredential.findFirst({
    where: { platformId: system.id, firmId: input.firmId, isActive: true },
  });

  const submission = await db.eFilingSubmissionRecord.create({
    data: {
      matterId: input.matterId, firmId: input.firmId, platformId: system.id,
      credentialId: credential?.id || "", filedByUserId: input.filedByUserId,
      courtCode: input.courtCode, courtName: input.courtName,
      indexNumber: input.indexNumber, filingType: input.filingType,
      filingTypeName: input.filingTypeName, filingCategory: input.isNewCase ? "New Case" : "Existing Case",
      description: input.description, isNewCase: input.isNewCase || false,
      status: "DRAFT",
      documents: {
        create: input.documents.map((doc, i) => ({
          matterId: input.matterId, ...doc, sequenceNumber: i + 1, contentType: "application/pdf",
        })),
      },
    },
    include: { documents: true },
  });

  return submission;
}

export async function validateSubmission(submissionId: string): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const submission = await db.eFilingSubmissionRecord.findUnique({
    where: { id: submissionId }, include: { platform: true, documents: true },
  });
  if (!submission) throw new Error("Submission not found");

  const adapter = getAdapter(submission.platform.code);
  const result = await adapter.validateFiling(submission, submission.documents);

  if (result.valid) {
    await db.eFilingSubmissionRecord.update({ where: { id: submissionId }, data: { status: "READY" } });
  }

  return result;
}

export async function submitSubmission(submissionId: string, userId: string): Promise<any> {
  const submission = await db.eFilingSubmissionRecord.findUnique({
    where: { id: submissionId }, include: { platform: true, documents: true },
  });
  if (!submission) throw new Error("Submission not found");

  const credential = await db.eFilingPlatformCredential.findFirst({
    where: { id: submission.credentialId },
  });

  await db.eFilingSubmissionRecord.update({ where: { id: submissionId }, data: { status: "SUBMITTING" } });

  const adapter = getAdapter(submission.platform.code);

  try {
    const result = await adapter.submitFiling(submission, submission.documents, credential);

    if (result.success) {
      const updated = await db.eFilingSubmissionRecord.update({
        where: { id: submissionId },
        data: {
          status: "SUBMITTED", externalFilingId: result.externalFilingId,
          confirmationNumber: result.confirmationNumber, submittedAt: new Date(),
          rawResponse: result.rawResponse, nextStatusCheck: new Date(Date.now() + 5 * 60 * 1000),
        },
      });

      // Create alert
      await db.eFilingAlert.create({
        data: { submissionId, firmId: submission.firmId, userId, alertType: "STATUS_UPDATE", message: `Filing submitted to ${submission.platform.name}: ${submission.filingTypeName}` },
      });

      return updated;
    } else {
      await db.eFilingSubmissionRecord.update({
        where: { id: submissionId }, data: { status: "ERROR", notes: result.error },
      });
      throw new Error(result.error || "Filing submission failed");
    }
  } catch (error: any) {
    await db.eFilingSubmissionRecord.update({
      where: { id: submissionId }, data: { status: "ERROR", notes: error.message },
    });
    throw error;
  }
}

export async function pollFilingStatuses(firmId: string): Promise<{ checked: number; accepted: number; rejected: number }> {
  const now = new Date();
  const pending = await db.eFilingSubmissionRecord.findMany({
    where: { firmId, status: { in: ["SUBMITTED", "PENDING_REVIEW"] }, nextStatusCheck: { lte: now } },
    include: { platform: true },
  });

  let accepted = 0, rejected = 0;

  for (const sub of pending) {
    const adapter = getAdapter(sub.platform.code);
    const credential = await db.eFilingPlatformCredential.findFirst({ where: { id: sub.credentialId } });
    const result = await adapter.getFilingStatus(sub, credential);

    const nextCheck = new Date(now.getTime() + Math.min(sub.statusCheckCount * 5 * 60 * 1000, 24 * 60 * 60 * 1000));

    if (result.status === "ACCEPTED") {
      await db.eFilingSubmissionRecord.update({
        where: { id: sub.id },
        data: { status: "ACCEPTED", confirmationNumber: result.confirmationNumber, acceptedAt: now, receiptUrl: result.receiptUrl, statusCheckCount: { increment: 1 }, lastStatusCheck: now },
      });
      await db.eFilingAlert.create({ data: { submissionId: sub.id, firmId, userId: sub.filedByUserId, alertType: "ACCEPTED", message: `Filing accepted: ${sub.filingTypeName}. Confirmation: ${result.confirmationNumber}` } });
      accepted++;
    } else if (result.status === "REJECTED") {
      await db.eFilingSubmissionRecord.update({
        where: { id: sub.id },
        data: { status: "REJECTED", rejectionReason: result.rejectionReason, rejectedAt: now, statusCheckCount: { increment: 1 }, lastStatusCheck: now },
      });
      await db.eFilingAlert.create({ data: { submissionId: sub.id, firmId, userId: sub.filedByUserId, alertType: "REJECTED", message: `Filing rejected: ${sub.filingTypeName}. Reason: ${result.rejectionReason}` } });
      rejected++;
    } else {
      await db.eFilingSubmissionRecord.update({
        where: { id: sub.id }, data: { statusCheckCount: { increment: 1 }, lastStatusCheck: now, nextStatusCheck: nextCheck },
      });
    }
  }

  return { checked: pending.length, accepted, rejected };
}
