import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import * as dw from "@/lib/integrations/docketwise";
import * as engine from "@/lib/immigration-engine";
import { db } from "@/lib/db";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function isDwEnabled() {
  const cfg = await db.immigrationIntegration.findFirst({ where: { provider: "DOCKETWISE", isEnabled: true } });
  return !!cfg;
}

// ─── Router ─────────────────────────────────────────────────────────────────

export const immigrationRouter = router({

  // ═══════════════════════════════════════════════════════════════════════════
  // Settings (3)
  // ═══════════════════════════════════════════════════════════════════════════

  "settings.get": publicProcedure.query(({ ctx }) =>
    ctx.db.immigrationIntegration.findFirst({ where: { provider: "DOCKETWISE" } }),
  ),

  "settings.update": publicProcedure
    .input(z.object({
      isEnabled: z.boolean().optional(),
      apiKey: z.string().optional(),
      apiSecret: z.string().optional(),
      baseUrl: z.string().optional(),
      accountId: z.string().optional(),
      firmId: z.string().optional(),
      autoSyncCases: z.boolean().optional(),
      autoSyncForms: z.boolean().optional(),
      autoCreateDocketEntries: z.boolean().optional(),
      autoTrackReceiptNumbers: z.boolean().optional(),
      defaultPreparer: z.string().optional(),
      webhookUrl: z.string().optional(),
      webhookSecret: z.string().optional(),
      settings: z.string().optional(),
    }))
    .mutation(({ ctx, input }) =>
      ctx.db.immigrationIntegration.upsert({
        where: { provider: "DOCKETWISE" },
        create: { provider: "DOCKETWISE", displayName: "Docketwise", ...input },
        update: input,
      }),
    ),

  "settings.test": publicProcedure.mutation(() => dw.testConnection()),

  // ═══════════════════════════════════════════════════════════════════════════
  // Cases (15)
  // ═══════════════════════════════════════════════════════════════════════════

  "cases.list": publicProcedure
    .input(z.object({
      caseType: z.string().optional(),
      status: z.string().optional(),
      matterId: z.string().optional(),
      clientId: z.string().optional(),
      receiptNumber: z.string().optional(),
    }).optional())
    .query(({ ctx, input }) => {
      const where: any = {};
      if (input?.caseType) where.caseType = input.caseType;
      if (input?.status) where.status = input.status;
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.clientId) where.clientId = input.clientId;
      if (input?.receiptNumber) where.receiptNumber = { contains: input.receiptNumber };
      return ctx.db.immigrationCase.findMany({
        where, include: { matter: true, client: true }, orderBy: { createdAt: "desc" },
      });
    }),

  "cases.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.immigrationCase.findUniqueOrThrow({
        where: { id: input.id },
        include: { forms: true, deadlines: true, documents: true, statusChecks: true, activities: true, matter: true, client: true },
      }),
    ),

  "cases.create": publicProcedure
    .input(z.object({
      matterId: z.string(),
      clientId: z.string(),
      caseType: z.string(),
      beneficiaryName: z.string(),
      petitionerName: z.string().optional(),
      caseSubtype: z.string().optional(),
      beneficiaryNationality: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(({ input }) => engine.createImmigrationCase(input)),

  "cases.update": publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.any()) }))
    .mutation(({ ctx, input }) =>
      ctx.db.immigrationCase.update({ where: { id: input.id }, data: input.data }),
    ),

  "cases.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.immigrationCase.delete({ where: { id: input.id } }),
    ),

  "cases.syncToDocketwise": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .mutation(({ input }) => dw.syncClioAIToDocketwise(input.caseId)),

  "cases.syncFromDocketwise": publicProcedure
    .input(z.object({ docketwiseCaseId: z.string(), matterId: z.string(), clientId: z.string() }))
    .mutation(({ input }) => dw.syncCaseToClioAI(input.docketwiseCaseId, input.matterId, input.clientId)),

  "cases.checkStatus": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .mutation(({ input }) => engine.checkUSCISStatus(input.caseId)),

  "cases.checkAllStatuses": publicProcedure.mutation(() => engine.checkAllCaseStatuses()),

  "cases.getTimeline": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.immigrationActivity.findMany({ where: { caseId: input.caseId }, orderBy: { createdAt: "asc" } }),
    ),

  "cases.getClientPortal": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(({ input }) => dw.getClientPortalLink(input.caseId)),

  "cases.buildStrategy": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(({ input }) => engine.buildCaseStrategy(input.caseId)),

  "cases.trackDependents": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(({ input }) => engine.trackDependents(input.caseId)),

  "cases.calculateFees": publicProcedure
    .input(z.object({ caseType: z.string(), premiumProcessing: z.boolean().optional(), concurrentFiling: z.boolean().optional() }))
    .query(({ input }) => engine.calculateFees(input.caseType, { premiumProcessing: input.premiumProcessing, concurrentFiling: input.concurrentFiling })),

  "cases.assessPremium": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(({ input }) => engine.assessPremiumProcessing(input.caseId)),

  // ═══════════════════════════════════════════════════════════════════════════
  // Forms (10)
  // ═══════════════════════════════════════════════════════════════════════════

  "forms.list": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.immigrationForm.findMany({ where: { caseId: input.caseId }, orderBy: { createdAt: "asc" } }),
    ),

  "forms.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.immigrationForm.findUniqueOrThrow({ where: { id: input.id } }),
    ),

  "forms.getRequired": publicProcedure
    .input(z.object({ caseType: z.string() }))
    .query(({ input }) => engine.getRequiredForms(input.caseType)),

  "forms.start": publicProcedure
    .input(z.object({
      caseId: z.string(), matterId: z.string(), formNumber: z.string(), formTitle: z.string(),
      formEdition: z.string().optional(), preparedBy: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const form = await ctx.db.immigrationForm.create({
        data: { ...input, status: "IN_PROGRESS" },
      });
      if (await isDwEnabled()) {
        await dw.startForm(input.caseId, { formNumber: input.formNumber, formTitle: input.formTitle });
      }
      return form;
    }),

  "forms.updateFields": publicProcedure
    .input(z.object({ id: z.string(), formData: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.immigrationForm.update({ where: { id: input.id }, data: { formData: input.formData } }),
    ),

  "forms.validate": publicProcedure
    .input(z.object({ caseId: z.string(), formId: z.string() }))
    .mutation(async ({ input }) => {
      if (await isDwEnabled()) return dw.validateForm(input.caseId, input.formId);
      return { valid: true, errors: [], warnings: [] };
    }),

  "forms.generate": publicProcedure
    .input(z.object({ caseId: z.string(), formId: z.string() }))
    .mutation(async ({ input }) => {
      if (await isDwEnabled()) return dw.generateFormPDF(input.caseId, input.formId);
      return { error: "Docketwise integration not enabled" };
    }),

  "forms.markFiled": publicProcedure
    .input(z.object({ id: z.string(), filedDate: z.string().optional() }))
    .mutation(({ ctx, input }) =>
      ctx.db.immigrationForm.update({
        where: { id: input.id },
        data: { status: "FILED", filedDate: input.filedDate ? new Date(input.filedDate) : new Date() },
      }),
    ),

  "forms.getEditUrl": publicProcedure
    .input(z.object({ caseId: z.string(), formId: z.string() }))
    .query(async ({ input }) => {
      if (await isDwEnabled()) return dw.getFormEditUrl(input.caseId, input.formId);
      return { url: null, message: "Docketwise integration not enabled" };
    }),

  "forms.sendForSignature": publicProcedure
    .input(z.object({ formId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const form = await ctx.db.immigrationForm.findUniqueOrThrow({ where: { id: input.formId } });
      return { formId: form.id, signatureRequired: form.signatureRequired, status: "pending", message: "Signature workflow not yet implemented" };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Questionnaires (4)
  // ═══════════════════════════════════════════════════════════════════════════

  "questionnaires.list": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(({ input }) => dw.getQuestionnaires(input.caseId)),

  "questionnaires.send": publicProcedure
    .input(z.object({ caseId: z.string(), questionnaireId: z.string() }))
    .mutation(({ input }) => dw.sendQuestionnaire(input.caseId, input.questionnaireId)),

  "questionnaires.getResponses": publicProcedure
    .input(z.object({ caseId: z.string(), questionnaireId: z.string() }))
    .query(({ input }) => dw.getQuestionnaireResponses(input.caseId, input.questionnaireId)),

  "questionnaires.autoPopulate": publicProcedure
    .input(z.object({ caseId: z.string(), questionnaireId: z.string() }))
    .mutation(() => ({ status: "not_implemented", message: "Auto-populate from case data not yet implemented" })),

  // ═══════════════════════════════════════════════════════════════════════════
  // Documents (7)
  // ═══════════════════════════════════════════════════════════════════════════

  "documents.list": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.immigrationDocument.findMany({ where: { caseId: input.caseId }, orderBy: { createdAt: "asc" } }),
    ),

  "documents.getChecklist": publicProcedure
    .input(z.object({ caseType: z.string() }))
    .query(({ input }) => engine.getDocumentChecklist(input.caseType)),

  "documents.create": publicProcedure
    .input(z.object({
      caseId: z.string(), docType: z.string(), title: z.string(),
      description: z.string().optional(), isRequired: z.boolean().optional(),
      expirationDate: z.string().optional(), forBeneficiary: z.boolean().optional(),
      forDependent: z.string().optional(), documentId: z.string().optional(),
    }))
    .mutation(({ ctx, input }) =>
      ctx.db.immigrationDocument.create({
        data: {
          ...input,
          expirationDate: input.expirationDate ? new Date(input.expirationDate) : undefined,
        } as any,
      }),
    ),

  "documents.update": publicProcedure
    .input(z.object({ id: z.string(), data: z.record(z.any()) }))
    .mutation(({ ctx, input }) =>
      ctx.db.immigrationDocument.update({ where: { id: input.id }, data: input.data }),
    ),

  "documents.markObtained": publicProcedure
    .input(z.object({ id: z.string(), obtainedDate: z.string().optional() }))
    .mutation(({ ctx, input }) =>
      ctx.db.immigrationDocument.update({
        where: { id: input.id },
        data: { isObtained: true, obtainedDate: input.obtainedDate ? new Date(input.obtainedDate) : new Date() },
      }),
    ),

  "documents.getExpiring": publicProcedure
    .input(z.object({ days: z.number().default(60) }))
    .query(({ ctx, input }) => {
      const cutoff = new Date(Date.now() + input.days * 24 * 60 * 60 * 1000);
      return ctx.db.immigrationDocument.findMany({
        where: { expirationDate: { lte: cutoff, gte: new Date() }, isObtained: true },
        orderBy: { expirationDate: "asc" },
      });
    }),

  "documents.generateExhibitList": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(({ input }) => engine.generateExhibitList(input.caseId)),

  // ═══════════════════════════════════════════════════════════════════════════
  // Deadlines (8)
  // ═══════════════════════════════════════════════════════════════════════════

  "deadlines.list": publicProcedure
    .input(z.object({
      caseId: z.string().optional(),
      matterId: z.string().optional(),
      status: z.string().optional(),
      deadlineType: z.string().optional(),
    }).optional())
    .query(({ ctx, input }) => {
      const where: any = {};
      if (input?.caseId) where.caseId = input.caseId;
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;
      if (input?.deadlineType) where.deadlineType = input.deadlineType;
      return ctx.db.immigrationDeadline.findMany({ where, orderBy: { dueDate: "asc" } });
    }),

  "deadlines.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.immigrationDeadline.findUniqueOrThrow({ where: { id: input.id } }),
    ),

  "deadlines.calculate": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .mutation(({ input }) => engine.calculateDeadlines(input.caseId)),

  "deadlines.complete": publicProcedure
    .input(z.object({ id: z.string(), completedBy: z.string().optional() }))
    .mutation(({ ctx, input }) =>
      ctx.db.immigrationDeadline.update({
        where: { id: input.id },
        data: { status: "COMPLETED", completedAt: new Date(), completedBy: input.completedBy },
      }),
    ),

  "deadlines.extend": publicProcedure
    .input(z.object({ id: z.string(), extendedTo: z.string(), extensionReason: z.string().optional() }))
    .mutation(({ ctx, input }) =>
      ctx.db.immigrationDeadline.update({
        where: { id: input.id },
        data: { status: "EXTENDED", extendedTo: new Date(input.extendedTo), extensionReason: input.extensionReason },
      }),
    ),

  "deadlines.waive": publicProcedure
    .input(z.object({ id: z.string(), notes: z.string().optional() }))
    .mutation(({ ctx, input }) =>
      ctx.db.immigrationDeadline.update({
        where: { id: input.id },
        data: { status: "WAIVED", notes: input.notes },
      }),
    ),

  "deadlines.getUrgent": publicProcedure.query(({ ctx }) =>
    ctx.db.immigrationDeadline.findMany({
      where: { status: { in: ["URGENT", "OVERDUE"] } },
      orderBy: { dueDate: "asc" },
    }),
  ),

  "deadlines.syncToDocket": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const deadlines = await ctx.db.immigrationDeadline.findMany({ where: { caseId: input.caseId, docketEntryId: null } });
      return { synced: deadlines.length, message: "Docket sync not yet implemented" };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // USCIS Status (4)
  // ═══════════════════════════════════════════════════════════════════════════

  "status.check": publicProcedure
    .input(z.object({ receiptNumber: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const c = await ctx.db.immigrationCase.findFirst({ where: { receiptNumber: input.receiptNumber } });
      if (!c) throw new Error("No case found for receipt number: " + input.receiptNumber);
      return engine.checkUSCISStatus(c.id);
    }),

  "status.checkForCase": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .mutation(({ input }) => engine.checkUSCISStatus(input.caseId)),

  "status.history": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.uSCISStatusCheck.findMany({ where: { caseId: input.caseId }, orderBy: { checkDate: "desc" } }),
    ),

  "status.checkAll": publicProcedure.mutation(() => engine.checkAllCaseStatuses()),

  // ═══════════════════════════════════════════════════════════════════════════
  // Visa Bulletin (5)
  // ═══════════════════════════════════════════════════════════════════════════

  "visaBulletin.getCurrent": publicProcedure.query(() => engine.checkVisaBulletin()),

  "visaBulletin.getHistorical": publicProcedure
    .input(z.object({ month: z.number(), year: z.number() }))
    .query(({ ctx, input }) =>
      ctx.db.visaBulletinEntry.findMany({ where: { bulletinMonth: input.month, bulletinYear: input.year } }),
    ),

  "visaBulletin.checkImpact": publicProcedure.query(async ({ ctx }) => {
    const bulletin = await engine.checkVisaBulletin();
    const cases = await ctx.db.immigrationCase.findMany({
      where: { status: { notIn: ["APPROVED", "DENIED", "WITHDRAWN"] }, priorityDate: { not: null } },
      include: { client: true },
    });
    return { bulletin, affectedCases: cases };
  }),

  "visaBulletin.getForCase": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const c = await ctx.db.immigrationCase.findUniqueOrThrow({ where: { id: input.caseId } });
      const entries = await ctx.db.visaBulletinEntry.findMany({
        where: {
          ...(c.visaBulletinCategory ? { category: c.visaBulletinCategory } : {}),
          ...(c.visaBulletinCountry ? { country: c.visaBulletinCountry } : {}),
        },
        orderBy: [{ bulletinYear: "desc" }, { bulletinMonth: "desc" }],
        take: 12,
      });
      return { case: c, bulletinEntries: entries };
    }),

  "visaBulletin.predictMovement": publicProcedure
    .input(z.object({ category: z.string(), country: z.string() }))
    .query(() => ({ message: "Visa bulletin movement prediction not yet implemented" })),

  // ═══════════════════════════════════════════════════════════════════════════
  // Processing Times (2)
  // ═══════════════════════════════════════════════════════════════════════════

  "processingTimes.get": publicProcedure
    .input(z.object({ formNumber: z.string().optional(), office: z.string().optional() }).optional())
    .query(({ input }) => engine.checkProcessingTimes(input?.formNumber ?? "", input?.office)),

  "processingTimes.forCase": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const c = await ctx.db.immigrationCase.findUniqueOrThrow({ where: { id: input.caseId }, include: { forms: true } });
      const formNumber = c.forms[0]?.formNumber ?? "";
      return engine.checkProcessingTimes(formNumber, c.uscisOffice ?? undefined);
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // RFE (4)
  // ═══════════════════════════════════════════════════════════════════════════

  "rfe.analyze": publicProcedure
    .input(z.object({ caseId: z.string(), rfeText: z.string() }))
    .mutation(({ input }) => engine.analyzeRFE(input.caseId, input.rfeText)),

  "rfe.generateResponse": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .mutation(({ input }) => engine.generateRFEResponse(input.caseId)),

  "rfe.markReceived": publicProcedure
    .input(z.object({ caseId: z.string(), rfeDate: z.string(), rfeDescription: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const rfeDeadline = new Date(new Date(input.rfeDate).getTime() + 87 * 24 * 60 * 60 * 1000);
      const c = await ctx.db.immigrationCase.update({
        where: { id: input.caseId },
        data: { rfeDate: new Date(input.rfeDate), rfeDeadline, rfeDescription: input.rfeDescription, status: "RFE_ISSUED" },
      });
      await ctx.db.immigrationDeadline.create({
        data: {
          caseId: input.caseId, matterId: c.matterId, deadlineType: "RFE_RESPONSE",
          title: "RFE Response Deadline", description: input.rfeDescription,
          dueDate: rfeDeadline, isStatutory: true, consequence: "Case may be denied if not responded to by deadline",
        },
      });
      await ctx.db.immigrationActivity.create({
        data: { caseId: input.caseId, activityType: "RFE_RECEIVED", description: "RFE received: " + input.rfeDescription },
      });
      return c;
    }),

  "rfe.markResponded": publicProcedure
    .input(z.object({ caseId: z.string(), responseDate: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const responseDate = input.responseDate ? new Date(input.responseDate) : new Date();
      const c = await ctx.db.immigrationCase.update({
        where: { id: input.caseId },
        data: { rfeResponseDate: responseDate, status: "RFE_RESPONSE_FILED" },
      });
      await ctx.db.immigrationDeadline.updateMany({
        where: { caseId: input.caseId, deadlineType: "RFE_RESPONSE", status: { notIn: ["COMPLETED", "WAIVED"] } },
        data: { status: "COMPLETED", completedAt: responseDate },
      });
      return c;
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // Filing (4)
  // ═══════════════════════════════════════════════════════════════════════════

  "filing.generateCoverLetter": publicProcedure
    .input(z.object({ caseId: z.string(), formNumbers: z.array(z.string()) }))
    .mutation(({ input }) => engine.generateCoverLetter(input.caseId, input.formNumbers)),

  "filing.generateExhibitList": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(({ input }) => engine.generateExhibitList(input.caseId)),

  "filing.prepareFiling": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .mutation(() => ({ status: "not_implemented", message: "Full filing package preparation not yet implemented" })),

  "filing.calculateFees": publicProcedure
    .input(z.object({ caseType: z.string(), premiumProcessing: z.boolean().optional(), concurrentFiling: z.boolean().optional() }))
    .query(({ input }) => engine.calculateFees(input.caseType, { premiumProcessing: input.premiumProcessing, concurrentFiling: input.concurrentFiling })),

  // ═══════════════════════════════════════════════════════════════════════════
  // Reports (9)
  // ═══════════════════════════════════════════════════════════════════════════

  "reports.caseOverview": publicProcedure.query(({ ctx }) =>
    ctx.db.immigrationCase.groupBy({ by: ["status"], _count: { id: true } }),
  ),

  "reports.deadlineCalendar": publicProcedure
    .input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional())
    .query(({ ctx, input }) => {
      const where: any = {};
      if (input?.from || input?.to) {
        where.dueDate = {};
        if (input?.from) where.dueDate.gte = new Date(input.from);
        if (input?.to) where.dueDate.lte = new Date(input.to);
      }
      return ctx.db.immigrationDeadline.findMany({ where, orderBy: { dueDate: "asc" }, include: { immigrationCase: true } });
    }),

  "reports.statusExpiry": publicProcedure
    .input(z.object({ days: z.number().default(90) }))
    .query(({ ctx, input }) => {
      const cutoff = new Date(Date.now() + input.days * 24 * 60 * 60 * 1000);
      return ctx.db.immigrationCase.findMany({
        where: { beneficiaryStatusExpiry: { lte: cutoff, gte: new Date() } },
        include: { client: true, matter: true },
        orderBy: { beneficiaryStatusExpiry: "asc" },
      });
    }),

  "reports.rfeTracker": publicProcedure.query(({ ctx }) =>
    ctx.db.immigrationCase.findMany({
      where: { rfeDate: { not: null } },
      include: { client: true, matter: true },
      orderBy: { rfeDeadline: "asc" },
    }),
  ),

  "reports.processingTimeline": publicProcedure.query(() => ({
    message: "Processing timeline report not yet implemented",
  })),

  "reports.visaBulletinTrend": publicProcedure
    .input(z.object({ category: z.string(), country: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.visaBulletinEntry.findMany({
        where: { category: input.category, country: input.country },
        orderBy: [{ bulletinYear: "asc" }, { bulletinMonth: "asc" }],
      }),
    ),

  "reports.documentCompleteness": publicProcedure
    .input(z.object({ caseId: z.string() }))
    .query(async ({ ctx, input }) => {
      const docs = await ctx.db.immigrationDocument.findMany({ where: { caseId: input.caseId } });
      const total = docs.length;
      const obtained = docs.filter(d => d.isObtained).length;
      const required = docs.filter(d => d.isRequired).length;
      const requiredObtained = docs.filter(d => d.isRequired && d.isObtained).length;
      return { total, obtained, required, requiredObtained, completionPct: total > 0 ? Math.round((obtained / total) * 100) : 0 };
    }),

  "reports.caseLoad": publicProcedure.query(async ({ ctx }) => {
    const byType = await ctx.db.immigrationCase.groupBy({ by: ["caseType"], _count: { id: true } });
    const byStatus = await ctx.db.immigrationCase.groupBy({ by: ["status"], _count: { id: true } });
    return { byType, byStatus };
  }),

  "reports.export": publicProcedure
    .input(z.object({ format: z.enum(["csv", "pdf", "json"]).default("json"), filters: z.record(z.any()).optional() }))
    .query(() => ({ status: "not_implemented", message: "Report export not yet implemented" })),

  // ═══════════════════════════════════════════════════════════════════════════
  // Case Timeline Milestones
  // ═══════════════════════════════════════════════════════════════════════════

  "milestones.update": publicProcedure
    .input(z.object({
      caseId: z.string(),
      milestone: z.enum([
        "receiptDate", "biometricsDate", "rfeDate", "rfeResponseDate",
        "interviewDate", "interviewCompleted", "approvalDate", "denialDate",
      ]),
      date: z.string().nullable(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const caseData = await ctx.db.immigrationCase.findUniqueOrThrow({ where: { id: input.caseId } });
      const dateVal = input.date ? new Date(input.date) : null;

      // Build update data based on milestone
      const updateData: any = {};
      let activityType: string = "STATUS_CHANGED";
      let activityDesc = "";
      let newStatus: string | null = null;

      switch (input.milestone) {
        case "receiptDate":
          updateData.receiptDate = dateVal;
          activityType = "RECEIPT_RECEIVED";
          activityDesc = `Receipt notice received${dateVal ? ` on ${dateVal.toLocaleDateString()}` : ""}`;
          if (dateVal) newStatus = "RECEIVED";
          break;
        case "biometricsDate":
          updateData.biometricsDate = dateVal;
          activityType = "BIOMETRICS_COMPLETED";
          activityDesc = `Biometrics appointment${dateVal ? ` on ${dateVal.toLocaleDateString()}` : ""}`;
          if (dateVal) newStatus = "BIOMETRICS_COMPLETED";
          break;
        case "rfeDate":
          updateData.rfeDate = dateVal;
          if (dateVal) {
            updateData.rfeDeadline = new Date(dateVal.getTime() + 87 * 86400000);
            updateData.rfeDescription = input.notes || caseData.rfeDescription;
          }
          activityType = "RFE_RECEIVED";
          activityDesc = `RFE issued${dateVal ? ` on ${dateVal.toLocaleDateString()}. Response due by ${new Date(dateVal.getTime() + 87 * 86400000).toLocaleDateString()}` : ""}`;
          if (dateVal) newStatus = "RFE_ISSUED";
          break;
        case "rfeResponseDate":
          updateData.rfeResponseDate = dateVal;
          activityType = "RFE_RESPONDED";
          activityDesc = `RFE response filed${dateVal ? ` on ${dateVal.toLocaleDateString()}` : ""}`;
          if (dateVal) newStatus = "RFE_RESPONSE_FILED";
          break;
        case "interviewDate":
          updateData.interviewDate = dateVal;
          activityType = "INTERVIEW_SCHEDULED";
          activityDesc = `Interview scheduled${dateVal ? ` for ${dateVal.toLocaleDateString()}` : ""}`;
          if (dateVal) newStatus = "INTERVIEW_SCHEDULED";
          break;
        case "interviewCompleted":
          updateData.interviewResult = input.notes || "Completed";
          activityType = "INTERVIEW_COMPLETED";
          activityDesc = `Interview completed${input.notes ? `: ${input.notes}` : ""}`;
          newStatus = "INTERVIEW_COMPLETED";
          break;
        case "approvalDate":
          updateData.approvalDate = dateVal;
          activityType = "APPROVED";
          activityDesc = `Case approved${dateVal ? ` on ${dateVal.toLocaleDateString()}` : ""}`;
          if (dateVal) newStatus = "APPROVED";
          break;
        case "denialDate":
          updateData.denialDate = dateVal;
          updateData.denialReason = input.notes || null;
          activityType = "DENIED";
          activityDesc = `Case denied${dateVal ? ` on ${dateVal.toLocaleDateString()}` : ""}${input.notes ? `. Reason: ${input.notes}` : ""}`;
          if (dateVal) newStatus = "DENIED";
          break;
      }

      if (newStatus) updateData.status = newStatus;
      if (input.notes && input.milestone !== "rfeDate" && input.milestone !== "denialDate") {
        activityDesc += input.notes ? `. Notes: ${input.notes}` : "";
      }

      // Update the case
      const updated = await ctx.db.immigrationCase.update({
        where: { id: input.caseId },
        data: updateData,
      });

      // Post activity to timeline
      if (dateVal && activityDesc) {
        await ctx.db.immigrationActivity.create({
          data: {
            caseId: input.caseId,
            activityType: activityType as any,
            description: activityDesc,
            performedBy: ctx.session?.userId || "system",
          },
        });
      }

      // Auto-create RFE deadline task
      if (input.milestone === "rfeDate" && dateVal) {
        const rfeDeadline = new Date(dateVal.getTime() + 87 * 86400000);
        await ctx.db.task.create({
          data: {
            title: `RFE Response Due — ${caseData.beneficiaryName} (${caseData.caseType})`,
            description: `Request for Evidence received on ${dateVal.toLocaleDateString()}. Response must be filed by ${rfeDeadline.toLocaleDateString()} (87 days).${input.notes ? `\n\nRFE Details: ${input.notes}` : ""}`,
            matterId: caseData.matterId,
            dueDate: rfeDeadline,
            priority: "URGENT",
            status: "NOT_STARTED",
          },
        });
      }

      return updated;
    }),

  "milestones.updateProcessingTime": publicProcedure
    .input(z.object({ caseId: z.string(), processingTimeEstimate: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.immigrationCase.update({
        where: { id: input.caseId },
        data: { processingTimeEstimate: input.processingTimeEstimate },
      });
    }),

  "milestones.updateReceiptNumber": publicProcedure
    .input(z.object({ caseId: z.string(), receiptNumber: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.immigrationCase.update({
        where: { id: input.caseId },
        data: { receiptNumber: input.receiptNumber },
      });
    }),

  "milestones.updateServiceCenter": publicProcedure
    .input(z.object({ caseId: z.string(), uscisOffice: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.immigrationCase.update({
        where: { id: input.caseId },
        data: { uscisOffice: input.uscisOffice },
      });
    }),
});
