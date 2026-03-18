import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import * as casemail from "@/lib/integrations/casemail";
import * as engine from "@/lib/mail-engine";
import { db } from "@/lib/db";

export const mailRouter = router({
  // ─── Settings ───────────────────────────────────────────────────
  "settings.get": publicProcedure.query(async () => {
    return db.mailIntegration.findUnique({ where: { provider: "CASEMAIL" } });
  }),
  "settings.update": publicProcedure
    .input(z.object({ isEnabled: z.boolean().optional(), displayName: z.string().optional(), apiKey: z.string().optional().nullable(), apiSecret: z.string().optional().nullable(), baseUrl: z.string().optional().nullable(), accountId: z.string().optional().nullable(), firmId: z.string().optional().nullable(), defaultReturnAddress: z.string().optional().nullable(), defaultReturnName: z.string().optional().nullable(), webhookUrl: z.string().optional().nullable(), webhookSecret: z.string().optional().nullable(), autoTrackCosts: z.boolean().optional(), autoSaveProofs: z.boolean().optional(), autoCreateDocketEntry: z.boolean().optional(), defaultMailClass: z.string().optional(), settings: z.string().optional().nullable() }))
    .mutation(async ({ input }) => {
      return db.mailIntegration.upsert({ where: { provider: "CASEMAIL" }, create: { provider: "CASEMAIL", displayName: input.displayName || "CaseMail", ...input }, update: input });
    }),
  "settings.test": publicProcedure.mutation(async () => {
    return casemail.casemailTestConnection();
  }),
  "settings.getMailClasses": publicProcedure.query(async () => {
    return casemail.casemailGetMailClassOptions();
  }),

  // ─── Jobs ───────────────────────────────────────────────────────
  "jobs.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), status: z.string().optional(), jobType: z.string().optional(), purpose: z.string().optional(), recipientName: z.string().optional(), batchId: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;
      if (input?.jobType) where.jobType = input.jobType;
      if (input?.purpose) where.purpose = input.purpose;
      if (input?.recipientName) where.recipientName = { contains: input.recipientName };
      if (input?.batchId) where.batchId = input.batchId;
      return db.mailJob.findMany({ where, orderBy: { createdAt: "desc" }, take: input?.limit || 50, include: { matter: true, trackingEvents: true } });
    }),
  "jobs.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => db.mailJob.findUniqueOrThrow({ where: { id: input.id }, include: { matter: true, trackingEvents: true } })),
  "jobs.create": publicProcedure
    .input(z.object({ matterId: z.string(), recipientName: z.string(), recipientAddress: z.string(), recipientCity: z.string().optional(), recipientState: z.string().optional(), recipientZip: z.string().optional(), documentIds: z.array(z.string()), mailClass: z.string().optional(), purpose: z.string().optional(), isColor: z.boolean().optional(), isDuplex: z.boolean().optional(), senderName: z.string().optional(), senderAddress: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ input }) => engine.sendMail(input)),
  "jobs.createCertified": publicProcedure
    .input(z.object({ matterId: z.string(), recipientName: z.string(), recipientAddress: z.string(), recipientCity: z.string().optional(), recipientState: z.string().optional(), recipientZip: z.string().optional(), documentIds: z.array(z.string()), purpose: z.string().optional(), returnReceipt: z.boolean().optional(), notes: z.string().optional() }))
    .mutation(async ({ input }) => engine.sendCertifiedMail(input)),
  "jobs.createNailAndMail": publicProcedure
    .input(z.object({ serviceJobId: z.string() }))
    .mutation(async ({ input }) => engine.sendNailAndMailMailing(input.serviceJobId)),
  "jobs.cancel": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const job = await db.mailJob.findUniqueOrThrow({ where: { id: input.id } });
      if (job.externalJobId) await casemail.casemailCancelMailJob(job.externalJobId);
      return db.mailJob.update({ where: { id: input.id }, data: { status: "CANCELLED" } });
    }),
  "jobs.track": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const job = await db.mailJob.findUniqueOrThrow({ where: { id: input.id } });
      if (!job.externalJobId) return { success: false, error: "No external job ID" };
      return casemail.casemailGetTrackingStatus(job.externalJobId);
    }),
  "jobs.trackByNumber": publicProcedure
    .input(z.object({ trackingNumber: z.string() }))
    .query(async ({ input }) => casemail.casemailGetTrackingByNumber(input.trackingNumber)),
  "jobs.trackAll": publicProcedure.mutation(async () => engine.trackAllActive()),
  "jobs.getProofOfMailing": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const job = await db.mailJob.findUniqueOrThrow({ where: { id: input.id } });
      if (!job.externalJobId) return { success: false, error: "No external job ID" };
      return casemail.casemailGetProofOfMailing(job.externalJobId);
    }),
  "jobs.getProofOfDelivery": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const job = await db.mailJob.findUniqueOrThrow({ where: { id: input.id } });
      if (!job.externalJobId) return { success: false, error: "No external job ID" };
      return casemail.casemailGetProofOfDelivery(job.externalJobId);
    }),
  "jobs.getReturnReceipt": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const job = await db.mailJob.findUniqueOrThrow({ where: { id: input.id } });
      if (!job.externalJobId) return { success: false, error: "No external job ID" };
      return casemail.casemailGetReturnReceipt(job.externalJobId);
    }),
  "jobs.getCostEstimate": publicProcedure
    .input(z.object({ mailClass: z.string(), pageCount: z.number(), isColor: z.boolean().optional(), isDuplex: z.boolean().optional(), certifiedMail: z.boolean().optional(), returnReceipt: z.boolean().optional(), quantity: z.number().optional() }))
    .query(async ({ input }) => casemail.casemailGetCostEstimate(input)),
  "jobs.suggestMailClass": publicProcedure
    .input(z.object({ purpose: z.string(), urgency: z.string(), needsProof: z.boolean(), needsSignature: z.boolean() }))
    .query(async ({ input }) => engine.suggestMailClass(input)),
  "jobs.resend": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const old = await db.mailJob.findUniqueOrThrow({ where: { id: input.id } });
      return engine.sendMail({ matterId: old.matterId, recipientName: old.recipientName, recipientAddress: old.recipientAddress, recipientCity: old.recipientCity || undefined, recipientState: old.recipientState || undefined, recipientZip: old.recipientZip || undefined, documentIds: JSON.parse(old.documentIds), mailClass: old.jobType, purpose: old.purpose, isColor: old.isColor, isDuplex: old.isDuplex, senderName: old.senderName || undefined, senderAddress: old.senderAddress || undefined, notes: old.notes || undefined });
    }),

  // ─── Batch ──────────────────────────────────────────────────────
  "batch.create": publicProcedure
    .input(z.object({ matterId: z.string().optional(), recipients: z.array(z.object({ name: z.string(), address: z.string(), city: z.string().optional(), state: z.string().optional(), zip: z.string().optional() })), documentIds: z.array(z.string()), mailClass: z.string().optional(), purpose: z.string().optional(), batchName: z.string(), isColor: z.boolean().optional() }))
    .mutation(async ({ input }) => engine.sendBulkMail(input)),
  "batch.list": publicProcedure
    .input(z.object({ matterId: z.string().optional(), status: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;
      return db.mailBatch.findMany({ where, orderBy: { createdAt: "desc" }, take: input?.limit || 50 });
    }),
  "batch.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const batch = await db.mailBatch.findUniqueOrThrow({ where: { id: input.id } });
      const jobs = await db.mailJob.findMany({ where: { batchId: input.id }, orderBy: { createdAt: "desc" } });
      return { ...batch, jobs };
    }),
  "batch.cancel": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      await db.mailJob.updateMany({ where: { batchId: input.id, status: { in: ["DRAFT", "SUBMITTED"] } }, data: { status: "CANCELLED" } });
      return db.mailBatch.update({ where: { id: input.id }, data: { status: "CANCELLED" } });
    }),
  "batch.getStatus": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const batch = await db.mailBatch.findUniqueOrThrow({ where: { id: input.id } });
      const jobs = await db.mailJob.findMany({ where: { batchId: input.id }, select: { status: true } });
      const byStatus: Record<string, number> = {};
      for (const j of jobs) byStatus[j.status] = (byStatus[j.status] || 0) + 1;
      return { ...batch, byStatus, totalJobs: jobs.length };
    }),

  // ─── AddressBook ────────────────────────────────────────────────
  "addressBook.list": publicProcedure
    .input(z.object({ addressType: z.string().optional(), limit: z.number().default(100) }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.addressType) where.addressType = input.addressType;
      return db.addressBook.findMany({ where, orderBy: { name: "asc" }, take: input?.limit || 100 });
    }),
  "addressBook.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => db.addressBook.findUniqueOrThrow({ where: { id: input.id } })),
  "addressBook.create": publicProcedure
    .input(z.object({ name: z.string(), title: z.string().optional(), organization: z.string().optional(), addressLine1: z.string(), addressLine2: z.string().optional(), city: z.string(), state: z.string(), zip: z.string(), country: z.string().optional(), addressType: z.string().optional(), phone: z.string().optional(), fax: z.string().optional(), email: z.string().optional(), linkedClientId: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ input }) => db.addressBook.create({ data: input as any })),
  "addressBook.update": publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), title: z.string().optional(), organization: z.string().optional(), addressLine1: z.string().optional(), addressLine2: z.string().optional(), city: z.string().optional(), state: z.string().optional(), zip: z.string().optional(), country: z.string().optional(), addressType: z.string().optional(), phone: z.string().optional(), fax: z.string().optional(), email: z.string().optional(), notes: z.string().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.addressBook.update({ where: { id }, data: data as any });
    }),
  "addressBook.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => db.addressBook.delete({ where: { id: input.id } })),
  "addressBook.validate": publicProcedure
    .input(z.object({ addressLine1: z.string(), addressLine2: z.string().optional(), city: z.string(), state: z.string(), zip: z.string(), country: z.string().optional() }))
    .mutation(async ({ input }) => engine.validateAddress(input)),
  "addressBook.validateBulk": publicProcedure
    .input(z.object({ addresses: z.array(z.object({ name: z.string().optional(), addressLine1: z.string(), addressLine2: z.string().optional(), city: z.string(), state: z.string(), zip: z.string(), country: z.string().optional() })) }))
    .mutation(async ({ input }) => casemail.casemailValidateAddressBulk(input.addresses)),
  "addressBook.importFromClients": publicProcedure.mutation(async () => {
    const clients = await db.client.findMany({ where: { address: { not: null } } });
    let created = 0;
    for (const c of clients) {
      if (!c.address) continue;
      const exists = await db.addressBook.findFirst({ where: { linkedClientId: c.id } });
      if (exists) continue;
      await db.addressBook.create({ data: { name: c.name, addressLine1: c.address, city: "", state: "", zip: "", addressType: "CLIENT", linkedClientId: c.id, email: c.email || undefined, phone: c.phone || undefined } });
      created++;
    }
    return { imported: created };
  }),
  "addressBook.importFromMatters": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ input }) => {
      const matter = await db.matter.findUniqueOrThrow({ where: { id: input.matterId }, include: { client: true } });
      let created = 0;
      if (matter.client?.address) {
        const exists = await db.addressBook.findFirst({ where: { linkedClientId: matter.client.id } });
        if (!exists) {
          await db.addressBook.create({ data: { name: matter.client.name, addressLine1: matter.client.address, city: "", state: "", zip: "", addressType: "CLIENT", linkedClientId: matter.client.id } });
          created++;
        }
      }
      return { imported: created };
    }),
  "addressBook.search": publicProcedure
    .input(z.object({ query: z.string(), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      return db.addressBook.findMany({ where: { OR: [{ name: { contains: input.query } }, { organization: { contains: input.query } }, { city: { contains: input.query } }] }, orderBy: { name: "asc" }, take: input.limit });
    }),

  // ─── Templates ──────────────────────────────────────────────────
  "templates.list": publicProcedure
    .input(z.object({ purpose: z.string().optional(), isActive: z.boolean().optional() }).optional())
    .query(async ({ input }) => {
      const where: any = {};
      if (input?.purpose) where.purpose = input.purpose;
      if (input?.isActive !== undefined) where.isActive = input.isActive;
      return db.mailTemplate.findMany({ where, orderBy: { name: "asc" } });
    }),
  "templates.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => db.mailTemplate.findUniqueOrThrow({ where: { id: input.id } })),
  "templates.create": publicProcedure
    .input(z.object({ name: z.string(), description: z.string().optional(), purpose: z.string().optional(), defaultMailClass: z.string().optional(), coverLetterContent: z.string().optional(), variables: z.string().optional(), includeReturnEnvelope: z.boolean().optional(), requiresCertified: z.boolean().optional(), requiresReturnReceipt: z.boolean().optional(), practiceArea: z.string().optional() }))
    .mutation(async ({ input }) => db.mailTemplate.create({ data: input as any })),
  "templates.update": publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), description: z.string().optional(), purpose: z.string().optional(), defaultMailClass: z.string().optional(), coverLetterContent: z.string().optional(), variables: z.string().optional(), includeReturnEnvelope: z.boolean().optional(), requiresCertified: z.boolean().optional(), requiresReturnReceipt: z.boolean().optional(), practiceArea: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      return db.mailTemplate.update({ where: { id }, data: data as any });
    }),
  "templates.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => db.mailTemplate.update({ where: { id: input.id }, data: { isActive: false } })),
  "templates.generateCoverLetter": publicProcedure
    .input(z.object({ templateId: z.string().optional(), variables: z.record(z.string()).optional(), recipientName: z.string().optional(), senderName: z.string().optional(), firmName: z.string().optional(), matterId: z.string().optional(), purpose: z.string().optional(), documentNames: z.array(z.string()).optional() }))
    .mutation(async ({ input }) => engine.generateCoverLetter(input)),
  "templates.initialize": publicProcedure.mutation(async () => engine.initializeDefaultTemplates()),

  // ─── Tracking ───────────────────────────────────────────────────
  "tracking.getEvents": publicProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ input }) => db.mailTrackingEvent.findMany({ where: { jobId: input.jobId }, orderBy: { eventDate: "desc" } })),
  "tracking.getByNumber": publicProcedure
    .input(z.object({ trackingNumber: z.string() }))
    .query(async ({ input }) => casemail.casemailGetTrackingByNumber(input.trackingNumber)),
  "tracking.getActive": publicProcedure
    .input(z.object({ limit: z.number().default(50) }).optional())
    .query(async ({ input }) => db.mailJob.findMany({ where: { status: { in: ["IN_TRANSIT", "MAILED"] } }, orderBy: { createdAt: "desc" }, take: input?.limit || 50 })),
  "tracking.getDelivered": publicProcedure
    .input(z.object({ start: z.string(), end: z.string() }))
    .query(async ({ input }) => db.mailJob.findMany({ where: { status: "DELIVERED", deliveredDate: { gte: new Date(input.start), lte: new Date(input.end) } }, orderBy: { deliveredDate: "desc" } })),
  "tracking.getReturned": publicProcedure
    .input(z.object({ limit: z.number().default(50) }).optional())
    .query(async ({ input }) => db.mailJob.findMany({ where: { status: "RETURNED" }, orderBy: { returnedDate: "desc" }, take: input?.limit || 50 })),

  // ─── Reports ────────────────────────────────────────────────────
  "reports.costs": publicProcedure
    .input(z.object({ start: z.string(), end: z.string(), matterId: z.string().optional() }))
    .query(async ({ input }) => engine.getCostReport({ start: new Date(input.start), end: new Date(input.end) }, input.matterId)),
  "reports.delivery": publicProcedure
    .input(z.object({ start: z.string(), end: z.string() }))
    .query(async ({ input }) => engine.getDeliveryReport({ start: new Date(input.start), end: new Date(input.end) })),
  "reports.matterHistory": publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => engine.getMailingHistory(input.matterId)),
  "reports.certifiedMailLog": publicProcedure
    .input(z.object({ start: z.string().optional(), end: z.string().optional(), limit: z.number().default(100) }).optional())
    .query(async ({ input }) => {
      const where: any = { jobType: { in: ["CERTIFIED", "CERTIFIED_RETURN_RECEIPT"] } };
      if (input?.start || input?.end) {
        where.createdAt = {};
        if (input?.start) where.createdAt.gte = new Date(input.start);
        if (input?.end) where.createdAt.lte = new Date(input.end);
      }
      return db.mailJob.findMany({ where, orderBy: { createdAt: "desc" }, take: input?.limit || 100, include: { trackingEvents: true } });
    }),
  "reports.returnedMail": publicProcedure
    .input(z.object({ start: z.string().optional(), end: z.string().optional(), limit: z.number().default(100) }).optional())
    .query(async ({ input }) => {
      const where: any = { status: "RETURNED" };
      if (input?.start || input?.end) {
        where.returnedDate = {};
        if (input?.start) where.returnedDate.gte = new Date(input.start);
        if (input?.end) where.returnedDate.lte = new Date(input.end);
      }
      return db.mailJob.findMany({ where, orderBy: { returnedDate: "desc" }, take: input?.limit || 100 });
    }),
  "reports.export": publicProcedure
    .input(z.object({ reportType: z.string(), start: z.string().optional(), end: z.string().optional(), matterId: z.string().optional(), format: z.string().default("csv") }))
    .query(async ({ input }) => {
      return { status: "not_implemented", reportType: input.reportType, format: input.format, message: "Export functionality coming soon." };
    }),
});
