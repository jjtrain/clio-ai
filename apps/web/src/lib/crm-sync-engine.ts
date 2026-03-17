import { db } from "@/lib/db";

export async function findDuplicate(params: { email?: string; phone?: string; firstName?: string; lastName?: string }) {
  if (params.email) {
    const client = await db.client.findFirst({ where: { email: params.email } });
    if (client) return { type: "client" as const, id: client.id, name: client.name, score: 100 };
    const lead = await db.lead.findFirst({ where: { email: params.email } });
    if (lead) return { type: "lead" as const, id: lead.id, name: lead.name, score: 100 };
  }
  if (params.phone) {
    const clean = params.phone.replace(/\D/g, "").slice(-10);
    if (clean.length >= 7) {
      const client = await db.client.findFirst({ where: { phone: { contains: clean } } });
      if (client) return { type: "client" as const, id: client.id, name: client.name, score: 90 };
      const lead = await db.lead.findFirst({ where: { phone: { contains: clean } } });
      if (lead) return { type: "lead" as const, id: lead.id, name: lead.name, score: 90 };
    }
  }
  return null;
}

export async function syncInbound(provider: string, data: { externalId: string; firstName?: string; lastName?: string; email?: string; phone?: string; source?: string; customFields?: any }) {
  const dup = await findDuplicate({ email: data.email, phone: data.phone, firstName: data.firstName, lastName: data.lastName });

  const extContact = await db.externalContact.upsert({
    where: { provider_externalId: { provider, externalId: data.externalId } },
    create: { provider, externalId: data.externalId, firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone, source: data.source, customFields: data.customFields ? JSON.stringify(data.customFields) : undefined, clientId: dup?.type === "client" ? dup.id : undefined, leadId: dup?.type === "lead" ? dup.id : undefined, syncStatus: "SYNCED", lastSyncedAt: new Date() },
    update: { firstName: data.firstName, lastName: data.lastName, email: data.email, phone: data.phone, source: data.source, customFields: data.customFields ? JSON.stringify(data.customFields) : undefined, syncStatus: "SYNCED", lastSyncedAt: new Date() },
  });

  if (dup) return { action: "updated" as const, recordId: dup.id, recordType: dup.type, externalContactId: extContact.id };

  // Create new lead
  const name = [data.firstName, data.lastName].filter(Boolean).join(" ") || data.email || "Unknown";
  const lead = await db.lead.create({
    data: { name, email: data.email, phone: data.phone, source: "OTHER", status: "NEW", priority: "MEDIUM" },
  });
  await db.externalContact.update({ where: { id: extContact.id }, data: { leadId: lead.id } });

  return { action: "created" as const, recordId: lead.id, recordType: "lead" as const, externalContactId: extContact.id };
}

export async function syncFormSubmission(provider: string, submission: { externalFormId?: string; formName: string; fields: Record<string, any>; respondentName?: string; respondentEmail?: string; respondentPhone?: string }) {
  const formSub = await db.externalFormSubmission.create({
    data: {
      provider, externalFormId: submission.externalFormId, formName: submission.formName,
      submittedAt: new Date(), respondentName: submission.respondentName,
      respondentEmail: submission.respondentEmail, respondentPhone: submission.respondentPhone,
      fields: JSON.stringify(submission.fields), processingStatus: "RECEIVED",
    },
  });

  // Check for field mapping
  const mapping = submission.externalFormId
    ? await db.formFieldMapping.findUnique({ where: { provider_externalFormId: { provider, externalFormId: submission.externalFormId } } })
    : null;

  if (mapping?.autoCreateLead) {
    const name = submission.respondentName || [submission.fields.firstName, submission.fields.lastName].filter(Boolean).join(" ") || submission.respondentEmail || "Form Submission";
    const lead = await db.lead.create({
      data: { name, email: submission.respondentEmail, phone: submission.respondentPhone, source: "INTAKE_FORM", status: "NEW", priority: "MEDIUM" },
    });
    await db.externalFormSubmission.update({ where: { id: formSub.id }, data: { mappedToLeadId: lead.id, processingStatus: "MAPPED" } });
    return { formSubmissionId: formSub.id, leadId: lead.id, action: "lead_created" };
  }

  await db.externalFormSubmission.update({ where: { id: formSub.id }, data: { processingStatus: "PROCESSED" } });
  return { formSubmissionId: formSub.id, action: "processed" };
}

export async function getSyncReport(provider?: string) {
  const where: any = {};
  if (provider) where.provider = provider;
  const contacts = await db.externalContact.count({ where });
  const synced = await db.externalContact.count({ where: { ...where, syncStatus: "SYNCED" } });
  const errors = await db.externalContact.count({ where: { ...where, syncStatus: "ERROR" } });
  const forms = await db.externalFormSubmission.count({ where });
  const mapped = await db.externalFormSubmission.count({ where: { ...where, processingStatus: "MAPPED" } });
  return { totalContacts: contacts, synced, errors, totalForms: forms, formsMapped: mapped };
}
