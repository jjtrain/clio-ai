import { db } from "@/lib/db";

function uuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function addAudit(
  currentTrail: string | null,
  action: string,
  details?: any
): string {
  const trail = currentTrail ? JSON.parse(currentTrail) : [];
  trail.push({ action, timestamp: new Date().toISOString(), ...details });
  return JSON.stringify(trail);
}

export async function createSigningRequest(params: {
  title: string;
  documentContent: string;
  signers: any[];
  matterId?: string;
  firmId: string;
  userId: string;
  customMessage?: string;
  legalDisclaimer?: string;
  requireInitials?: boolean;
  requireDateField?: boolean;
  brandColor?: string;
  firmLogo?: string;
  firmName?: string;
  signingOrder?: string;
  saveCompletedToMatter?: boolean;
  autoRemindEnabled?: boolean;
  autoRemindDays?: number;
  expirationDays?: number;
}) {
  const signingToken = uuid();
  const expirationDays = params.expirationDays ?? 7;
  const tokenExpiresAt = new Date(
    Date.now() + expirationDays * 24 * 60 * 60 * 1000
  );
  const auditTrail = addAudit(null, "created", {
    userId: params.userId,
  });

  const request = await db.mobileSignatureRequest.create({
    data: {
      title: params.title, documentContent: params.documentContent,
      documentType: (params as any).documentType || "MSD_GENERAL",
      signers: JSON.stringify(params.signers), signingToken, tokenExpiresAt,
      status: "MSS_DRAFT" as any, matterId: params.matterId, clientId: (params as any).clientId,
      customMessage: params.customMessage, requireInitials: params.requireInitials ?? false,
      requireDateField: params.requireDateField ?? false, brandColor: (params as any).brandColor || "#3B82F6",
      firmName: (params as any).firmName || "Managal", signingOrder: (params.signingOrder || "SO_SEQUENTIAL") as any,
      deliveryMethod: ((params as any).deliveryMethod || "SDM_ESIGN_BOTH") as any,
      autoRemindEnabled: (params as any).autoRemindEnabled ?? true,
      createdBy: (params as any).userId || "system", auditTrail,
    } as any,
  });

  return { ...request, signingUrl: `/sign-mobile/${signingToken}` };
}

export async function sendSigningRequest(requestId: string) {
  const request = await db.mobileSignatureRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  const auditTrail = addAudit(request.auditTrail, "sent");
  const firstRemindDay = request.autoRemindDays ? parseInt(request.autoRemindDays.split(",")[0]) : 1;
  const nextReminderAt = request.autoRemindEnabled
    ? new Date(Date.now() + firstRemindDay * 24 * 60 * 60 * 1000)
    : null;

  await db.mobileSignatureRequest.update({
    where: { id: requestId },
    data: {
      status: "MSS_SENT" as any,
      nextReminderAt, auditTrail,
    } as any,
  });

  return { sent: true, deliveryMethod: "link" };
}

export async function getSigningPage(signingToken: string) {
  const request = await db.mobileSignatureRequest.findFirstOrThrow({
    where: { signingToken },
  });

  if (request.tokenExpiresAt && request.tokenExpiresAt < new Date())
    throw new Error("Signing link has expired");
  if ((request.status as string) === "MSS_CANCELLED")
    throw new Error("Request has been cancelled");
  if ((request.status as string) === "MSS_COMPLETED")
    throw new Error("Request has already been completed");

  if (!request.viewedAt) {
    const auditTrail = addAudit(request.auditTrail, "viewed");
    await db.mobileSignatureRequest.update({
      where: { id: request.id },
      data: { viewedAt: new Date(), status: "MSS_VIEWED" as any, auditTrail },
    });
  }

  const signers = JSON.parse((request.signers as string) || "[]");
  const currentSigner =
    request.signingOrder === "SO_SEQUENTIAL"
      ? signers[request.currentSignerIndex ?? 0]
      : signers.find((s: any) => s.status !== "signed");

  return {
    title: request.title,
    documentContent: request.documentContent,
    signerName: currentSigner?.name,
    firmName: request.firmName,
    firmLogo: request.firmLogo,
    brandColor: request.brandColor,
    customMessage: request.customMessage,
    legalDisclaimer: "By signing electronically, you agree your e-signature is the legal equivalent of your handwritten signature.",
    requireInitials: request.requireInitials,
    requireDateField: request.requireDateField,
    status: request.status,
  };
}

export async function submitSignature(
  signingToken: string,
  params: {
    signerId: string;
    signatureData: string;
    ipAddress?: string;
    userAgent?: string;
  }
) {
  const request = await db.mobileSignatureRequest.findFirstOrThrow({
    where: { signingToken },
  });

  const signers = JSON.parse((request.signers as string) || "[]");
  const signerIndex = signers.findIndex(
    (s: any) => s.id === params.signerId
  );
  if (signerIndex === -1) throw new Error("Signer not found");

  signers[signerIndex].status = "signed";
  signers[signerIndex].signedAt = new Date().toISOString();
  signers[signerIndex].signatureData = params.signatureData;
  signers[signerIndex].ipAddress = params.ipAddress;
  signers[signerIndex].userAgent = params.userAgent;

  const auditTrail = addAudit(request.auditTrail, "signed", {
    signerId: params.signerId,
    signerName: signers[signerIndex].name,
  });

  const allSigned = signers.every((s: any) => s.status === "signed");
  let newStatus = "MSS_PARTIALLY_SIGNED" as any;
  let currentSignerIndex = request.currentSignerIndex ?? 0;

  if (allSigned) {
    newStatus = "MSS_COMPLETED" as any;
  } else if (request.signingOrder === "SO_SEQUENTIAL") {
    currentSignerIndex += 1;
  }

  const updated = await db.mobileSignatureRequest.update({
    where: { id: request.id },
    data: {
      signers: JSON.stringify(signers),
      status: newStatus,
      currentSignerIndex,
      auditTrail,
    },
  });

  if (allSigned) {
    await completeSigningRequest(request.id);
  }

  return updated;
}

export async function completeSigningRequest(requestId: string) {
  const request = await db.mobileSignatureRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  const auditTrail = addAudit(request.auditTrail, "completed");

  await db.mobileSignatureRequest.update({
    where: { id: requestId },
    data: {
      status: "MSS_COMPLETED" as any,
      completedAt: new Date(),
      auditTrail,
    },
  });

  if (request.matterId) {
    await db.document.create({
      data: {
        name: `Signed: ${request.title}`,
        filename: `signed_${request.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
        mimeType: "application/pdf",
        size: 0,
        path: "",
        matterId: request.matterId,
      },
    });
  }
}

export async function declineSigningRequest(
  signingToken: string,
  reason?: string
) {
  const request = await db.mobileSignatureRequest.findFirstOrThrow({
    where: { signingToken },
  });
  const auditTrail = addAudit(request.auditTrail, "declined", { reason });

  return db.mobileSignatureRequest.update({
    where: { id: request.id },
    data: {
      status: "MSS_DECLINED" as any,
      declinedReason: reason,
      declinedAt: new Date(),
      auditTrail,
    },
  });
}

export async function sendReminder(requestId: string, signerId?: string) {
  const request = await db.mobileSignatureRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  const auditTrail = addAudit(request.auditTrail, "reminder_sent", {
    signerId,
  });

  return db.mobileSignatureRequest.update({
    where: { id: requestId },
    data: {
      reminderCount: (request.reminderCount ?? 0) + 1,
      lastReminderAt: new Date(),
      auditTrail,
    },
  });
}

export async function cancelRequest(requestId: string, reason?: string) {
  const request = await db.mobileSignatureRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  const auditTrail = addAudit(request.auditTrail, "cancelled", { reason });

  return db.mobileSignatureRequest.update({
    where: { id: requestId },
    data: { status: "MSS_CANCELLED" as any, auditTrail },
  });
}

export async function expireStaleRequests() {
  const result = await db.mobileSignatureRequest.updateMany({
    where: {
      status: {
        in: ["MSS_SENT", "MSS_VIEWED", "MSS_PARTIALLY_SIGNED"] as any,
      },
      tokenExpiresAt: { lt: new Date() },
    },
    data: { status: "MSS_EXPIRED" as any },
  });
  return result.count;
}

export async function checkAutoReminders() {
  const requests = await db.mobileSignatureRequest.findMany({
    where: {
      autoRemindEnabled: true,
      status: { in: ["MSS_SENT", "MSS_VIEWED"] as any },
      nextReminderAt: { lte: new Date() },
    },
  });

  let count = 0;
  for (const req of requests) {
    await sendReminder(req.id);
    const nextDay = req.autoRemindDays ? parseInt(req.autoRemindDays.split(",").pop() || "3") : 3;
    const nextReminderAt = new Date(Date.now() + nextDay * 24 * 60 * 60 * 1000);
    await db.mobileSignatureRequest.update({
      where: { id: req.id },
      data: { nextReminderAt },
    });
    count++;
  }
  return count;
}

export async function generateFromTemplate(
  templateId: string,
  params: {
    fieldValues: Record<string, string>;
    signers: any[];
    matterId?: string;
    firmId: string;
    userId: string;
    title?: string;
  }
) {
  const template = await db.signatureTemplate.findUniqueOrThrow({
    where: { id: templateId },
  });

  let content = template.content as string;
  for (const [key, value] of Object.entries(params.fieldValues)) {
    content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }

  const request = await createSigningRequest({
    title: params.title ?? (template.name as string),
    documentContent: content,
    signers: params.signers,
    matterId: params.matterId,
    firmId: params.firmId,
    userId: params.userId,
  });

  await db.signatureTemplate.update({
    where: { id: templateId },
    data: { usageCount: ((template.usageCount as number) ?? 0) + 1 },
  });

  return request;
}

export function embedSignatures(documentHtml: string, signers: any[]): string {
  let html = documentHtml;
  for (const signer of signers) {
    if (signer.status === "signed" && signer.signatureData) {
      html += `<div style="margin-top:40px"><img src="${signer.signatureData}" style="height:60px"/><p>${signer.name} &mdash; ${signer.signedAt}</p></div>`;
    }
  }
  return html;
}

export async function generateAuditCertificate(
  requestId: string
): Promise<string> {
  const request = await db.mobileSignatureRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  const trail = JSON.parse((request.auditTrail as string) || "[]");

  let html = `<html><head><title>Audit Certificate</title></head><body>`;
  html += `<h1>Audit Certificate</h1>`;
  html += `<h2>${request.title}</h2>`;
  html += `<p>Request ID: ${request.id}</p>`;
  html += `<p>Created: ${request.createdAt}</p>`;
  html += `<table border="1" cellpadding="8"><tr><th>Action</th><th>Timestamp</th><th>Details</th></tr>`;

  for (const entry of trail) {
    const { action, timestamp, ...details } = entry;
    html += `<tr><td>${action}</td><td>${timestamp}</td><td>${JSON.stringify(details)}</td></tr>`;
  }

  html += `</table></body></html>`;
  return html;
}

export async function getSigningUrl(requestId: string) {
  const request = await db.mobileSignatureRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  return `/sign-mobile/${request.signingToken}`;
}
