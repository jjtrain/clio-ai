import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { validateFiling, suggestServiceList, generateCoverSheet, checkFilingRequirements } from "@/lib/ai-efiling";

const STARTER_COURTS = [
  { name: "U.S. District Court, Eastern District of New York", state: "NY", courtType: "FEDERAL_DISTRICT" as const, efilingProvider: "CM/ECF", efilingUrl: "https://ecf.nyed.uscourts.gov" },
  { name: "U.S. District Court, Southern District of New York", state: "NY", courtType: "FEDERAL_DISTRICT" as const, efilingProvider: "CM/ECF" },
  { name: "U.S. Bankruptcy Court, Eastern District of New York", state: "NY", courtType: "BANKRUPTCY" as const, efilingProvider: "CM/ECF" },
  { name: "Supreme Court, Nassau County", state: "NY", county: "Nassau", courtType: "STATE_TRIAL" as const, efilingProvider: "NYSCEF", efilingUrl: "https://iapps.courts.state.ny.us/nyscef" },
  { name: "Supreme Court, Queens County", state: "NY", county: "Queens", courtType: "STATE_TRIAL" as const, efilingProvider: "NYSCEF" },
  { name: "Supreme Court, Kings County", state: "NY", county: "Kings", courtType: "STATE_TRIAL" as const, efilingProvider: "NYSCEF" },
  { name: "Supreme Court, Suffolk County", state: "NY", county: "Suffolk", courtType: "STATE_TRIAL" as const, efilingProvider: "NYSCEF" },
  { name: "Family Court, Nassau County", state: "NY", county: "Nassau", courtType: "FAMILY" as const, efilingProvider: "NYSCEF" },
  { name: "Family Court, Queens County", state: "NY", county: "Queens", courtType: "FAMILY" as const, efilingProvider: "NYSCEF" },
  { name: "Civil Court, City of New York", state: "NY", courtType: "STATE_TRIAL" as const, efilingProvider: "NYSCEF" },
  { name: "Appellate Division, Second Department", state: "NY", courtType: "STATE_APPELLATE" as const, efilingProvider: "NYSCEF" },
  { name: "Superior Court, Bergen County", state: "NJ", county: "Bergen", courtType: "STATE_TRIAL" as const, efilingProvider: "eCourts", efilingUrl: "https://www.njcourts.gov/attorneys/ecourts" },
  { name: "Superior Court, Essex County", state: "NJ", county: "Essex", courtType: "STATE_TRIAL" as const, efilingProvider: "eCourts" },
  { name: "Superior Court, Hudson County", state: "NJ", county: "Hudson", courtType: "STATE_TRIAL" as const, efilingProvider: "eCourts" },
];

async function ensureStarterCourts(db: any) {
  const count = await db.court.count();
  if (count > 0) return;
  for (const court of STARTER_COURTS) {
    await db.court.create({ data: court as any });
  }
}

export const efilingRouter = router({
  // ==================== COURTS ====================

  listCourts: publicProcedure
    .input(z.object({
      state: z.string().optional(),
      courtType: z.string().optional(),
      search: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      await ensureStarterCourts(ctx.db);
      const where: any = { isActive: true };
      if (input?.state) where.state = input.state;
      if (input?.courtType) where.courtType = input.courtType;
      if (input?.search) where.name = { contains: input.search, mode: "insensitive" };
      return ctx.db.court.findMany({
        where,
        include: { _count: { select: { submissions: true } } },
        orderBy: [{ state: "asc" }, { name: "asc" }],
      });
    }),

  getCourt: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.court.findUniqueOrThrow({
        where: { id: input.id },
        include: { _count: { select: { submissions: true, templates: true } } },
      });
    }),

  createCourt: publicProcedure
    .input(z.object({
      name: z.string(),
      state: z.string(),
      county: z.string().optional(),
      courtType: z.string(),
      efilingUrl: z.string().optional(),
      efilingProvider: z.string().optional(),
      filingRules: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.court.create({ data: input as any });
    }),

  updateCourt: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      state: z.string().optional(),
      county: z.string().optional(),
      courtType: z.string().optional(),
      efilingUrl: z.string().optional(),
      efilingProvider: z.string().optional(),
      filingRules: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.court.update({ where: { id }, data: data as any });
    }),

  // ==================== FILING TEMPLATES ====================

  listFilingTemplates: publicProcedure
    .input(z.object({ courtId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { isActive: true };
      if (input?.courtId) where.courtId = input.courtId;
      return ctx.db.eFilingTemplate.findMany({ where, include: { court: true }, orderBy: { name: "asc" } });
    }),

  getFilingTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.eFilingTemplate.findUniqueOrThrow({ where: { id: input.id }, include: { court: true } });
    }),

  createFilingTemplate: publicProcedure
    .input(z.object({
      name: z.string(),
      courtId: z.string().optional(),
      filingType: z.string(),
      documentTypes: z.string(),
      instructions: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.eFilingTemplate.create({ data: input as any });
    }),

  updateFilingTemplate: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      courtId: z.string().optional(),
      filingType: z.string().optional(),
      documentTypes: z.string().optional(),
      instructions: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.eFilingTemplate.update({ where: { id }, data: data as any });
    }),

  deleteFilingTemplate: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.eFilingTemplate.delete({ where: { id: input.id } });
    }),

  // ==================== SUBMISSIONS ====================

  list: publicProcedure
    .input(z.object({
      matterId: z.string().optional(),
      status: z.string().optional(),
      courtId: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;
      if (input?.courtId) where.courtId = input.courtId;
      if (input?.dateFrom || input?.dateTo) {
        where.createdAt = {};
        if (input?.dateFrom) where.createdAt.gte = new Date(input.dateFrom);
        if (input?.dateTo) where.createdAt.lte = new Date(input.dateTo);
      }
      return ctx.db.eFilingSubmission.findMany({
        where,
        include: {
          matter: { select: { id: true, name: true, matterNumber: true } },
          court: { select: { id: true, name: true, state: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.eFilingSubmission.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          matter: { select: { id: true, name: true, matterNumber: true, client: { select: { name: true, email: true } } } },
          court: true,
          activities: { orderBy: { createdAt: "desc" } },
        },
      });
    }),

  create: publicProcedure
    .input(z.object({
      matterId: z.string(),
      courtId: z.string(),
      filingType: z.string(),
      title: z.string(),
      description: z.string().optional(),
      caseNumber: z.string().optional(),
      filerName: z.string(),
      filerEmail: z.string(),
      documents: z.string().default("[]"),
      serviceList: z.string().optional(),
      feeWaived: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.eFilingSubmission.create({ data: input as any });
      await ctx.db.eFilingActivity.create({
        data: {
          submissionId: submission.id,
          action: "Created",
          description: `Filing "${input.title}" created for ${input.filingType} filing`,
        },
      });
      return submission;
    }),

  update: publicProcedure
    .input(z.object({
      id: z.string(),
      title: z.string().optional(),
      description: z.string().optional(),
      caseNumber: z.string().optional(),
      filingType: z.string().optional(),
      documents: z.string().optional(),
      serviceList: z.string().optional(),
      filerName: z.string().optional(),
      filerEmail: z.string().optional(),
      feeWaived: z.boolean().optional(),
      filingFee: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.eFilingSubmission.findUniqueOrThrow({ where: { id: input.id } });
      if (existing.status !== "DRAFT" && existing.status !== "REJECTED") {
        throw new Error("Can only edit filings in DRAFT or REJECTED status");
      }
      const { id, ...data } = input;
      return ctx.db.eFilingSubmission.update({ where: { id }, data: data as any });
    }),

  addDocument: publicProcedure
    .input(z.object({
      submissionId: z.string(),
      draftDocumentId: z.string().optional(),
      filename: z.string(),
      documentType: z.string(),
      isLeadDocument: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const sub = await ctx.db.eFilingSubmission.findUniqueOrThrow({ where: { id: input.submissionId } });
      const docs = JSON.parse(sub.documents);
      docs.push({
        draftDocumentId: input.draftDocumentId,
        filename: input.filename,
        documentType: input.documentType,
        isLeadDocument: input.isLeadDocument,
      });
      await ctx.db.eFilingSubmission.update({
        where: { id: input.submissionId },
        data: { documents: JSON.stringify(docs) },
      });
      await ctx.db.eFilingActivity.create({
        data: {
          submissionId: input.submissionId,
          action: "Document Added",
          description: `Added document: ${input.filename} (${input.documentType})`,
        },
      });
      return { documents: docs };
    }),

  removeDocument: publicProcedure
    .input(z.object({ submissionId: z.string(), index: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const sub = await ctx.db.eFilingSubmission.findUniqueOrThrow({ where: { id: input.submissionId } });
      const docs = JSON.parse(sub.documents);
      const removed = docs.splice(input.index, 1);
      await ctx.db.eFilingSubmission.update({
        where: { id: input.submissionId },
        data: { documents: JSON.stringify(docs) },
      });
      if (removed.length) {
        await ctx.db.eFilingActivity.create({
          data: {
            submissionId: input.submissionId,
            action: "Document Removed",
            description: `Removed document: ${removed[0].filename}`,
          },
        });
      }
      return { documents: docs };
    }),

  validate: publicProcedure
    .input(z.object({ submissionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sub = await ctx.db.eFilingSubmission.findUniqueOrThrow({
        where: { id: input.submissionId },
        include: { court: true },
      });
      const docs = JSON.parse(sub.documents);
      let courtRules = null;
      try { courtRules = sub.court.filingRules ? JSON.parse(sub.court.filingRules) : null; } catch {}

      const result = await validateFiling(docs, courtRules, sub.filingType);

      if (result.isValid && result.errors.length === 0) {
        await ctx.db.eFilingSubmission.update({ where: { id: input.submissionId }, data: { status: "READY" } });
        await ctx.db.eFilingActivity.create({
          data: { submissionId: input.submissionId, action: "Validated", description: "Filing passed validation and is ready to submit" },
        });
      } else {
        await ctx.db.eFilingActivity.create({
          data: {
            submissionId: input.submissionId,
            action: "Validation Failed",
            description: `Validation found ${result.errors.length} error(s) and ${result.warnings.length} warning(s)`,
            metadata: JSON.stringify(result),
          },
        });
      }
      return result;
    }),

  submit: publicProcedure
    .input(z.object({ submissionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sub = await ctx.db.eFilingSubmission.findUniqueOrThrow({ where: { id: input.submissionId } });
      if (sub.status !== "READY") throw new Error("Filing must be validated (READY status) before submission");

      // TODO: Real integration with Tyler Odyssey / NYSCEF / PACER / CM-ECF APIs
      // For now, simulate the submission flow
      const confirmationNumber = `EF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      await ctx.db.eFilingSubmission.update({
        where: { id: input.submissionId },
        data: { status: "SUBMITTED", filedAt: new Date(), confirmationNumber },
      });
      await ctx.db.eFilingActivity.create({
        data: { submissionId: input.submissionId, action: "Submitted", description: `Filing submitted to court. Confirmation: ${confirmationNumber}` },
      });

      // Simulate acceptance after a brief delay (in production, this would be a webhook/polling)
      setTimeout(async () => {
        try {
          await ctx.db.eFilingSubmission.update({
            where: { id: input.submissionId },
            data: { status: "ACCEPTED", acceptedAt: new Date() },
          });
          await ctx.db.eFilingActivity.create({
            data: { submissionId: input.submissionId, action: "Accepted", description: "Filing accepted by the court" },
          });
        } catch (e) {
          console.error("[E-Filing] Error simulating acceptance:", e);
        }
      }, 3000);

      return { confirmationNumber, status: "SUBMITTED" };
    }),

  checkStatus: publicProcedure
    .input(z.object({ submissionId: z.string() }))
    .query(async ({ ctx, input }) => {
      const sub = await ctx.db.eFilingSubmission.findUniqueOrThrow({
        where: { id: input.submissionId },
        select: { status: true, confirmationNumber: true, filedAt: true, acceptedAt: true, rejectedAt: true, rejectionReason: true },
      });
      return sub;
    }),

  reject: publicProcedure
    .input(z.object({ submissionId: z.string(), reason: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.eFilingSubmission.update({
        where: { id: input.submissionId },
        data: { status: "REJECTED", rejectionReason: input.reason, rejectedAt: new Date() },
      });
      await ctx.db.eFilingActivity.create({
        data: { submissionId: input.submissionId, action: "Rejected", description: `Filing rejected: ${input.reason}` },
      });
    }),

  getFilingRequirements: publicProcedure
    .input(z.object({ courtId: z.string(), filingType: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const court = await ctx.db.court.findUniqueOrThrow({ where: { id: input.courtId } });
      return checkFilingRequirements(court.name, input.filingType);
    }),

  generateCoverSheet: publicProcedure
    .input(z.object({ submissionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sub = await ctx.db.eFilingSubmission.findUniqueOrThrow({
        where: { id: input.submissionId },
        include: { court: true },
      });
      const docs = JSON.parse(sub.documents);
      return generateCoverSheet({
        court: sub.court.name,
        caseNumber: sub.caseNumber ?? undefined,
        title: sub.title,
        filingType: sub.filingType,
        filerName: sub.filerName,
        documents: docs,
      });
    }),

  getStats: publicProcedure.query(async ({ ctx }) => {
    const [total, accepted, rejected, submitted, draft] = await Promise.all([
      ctx.db.eFilingSubmission.count(),
      ctx.db.eFilingSubmission.count({ where: { status: "ACCEPTED" } }),
      ctx.db.eFilingSubmission.count({ where: { status: "REJECTED" } }),
      ctx.db.eFilingSubmission.count({ where: { status: "SUBMITTED" } }),
      ctx.db.eFilingSubmission.count({ where: { status: { in: ["DRAFT", "VALIDATING", "READY", "SUBMITTING"] } } }),
    ]);
    return { total, accepted, rejected, submitted, pending: draft };
  }),

  suggestServiceList: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.findUniqueOrThrow({
        where: { id: input.matterId },
        include: { relatedParties: true },
      });
      return suggestServiceList({
        parties: matter.relatedParties,
        opposingCounsel: matter.relatedParties.find((rp: any) => rp.role === "OPPOSING_COUNSEL"),
      });
    }),
});
