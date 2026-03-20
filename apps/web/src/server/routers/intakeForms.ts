import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as intakeEngine from "@/lib/intake-form-engine";

export const intakeFormsRouter = router({
  // ── Forms (81-92) ──────────────────────────────────────────────────

  "forms.list": publicProcedure
    .input(z.object({
      practiceArea: z.string().optional(),
      isActive: z.boolean().optional(),
      isPublished: z.boolean().optional(),
    }).optional())
    .query(async ({ input }) => {
      return db.publicIntakeForm.findMany({
        where: {
          practiceArea: input?.practiceArea as any,
          isActive: input?.isActive,
          isPublished: input?.isPublished,
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  "forms.get": publicProcedure
    .input(z.object({ formId: z.string() }))
    .query(async ({ input }) => {
      return db.publicIntakeForm.findUnique({
        where: { id: input.formId },
        include: { _count: { select: { submissions: true } } },
      });
    }),

  "forms.create": publicProcedure
    .input(z.object({
      practiceArea: z.string(),
      name: z.string(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return intakeEngine.createForm(input);
    }),

  "forms.createAI": publicProcedure
    .input(z.object({ practiceArea: z.string() }))
    .mutation(async ({ input }) => {
      const config = await intakeEngine.generateFormFromPracticeArea(input.practiceArea);
      return config;
    }),

  "forms.update": publicProcedure
    .input(z.object({ formId: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      return db.publicIntakeForm.update({
        where: { id: input.formId },
        data: input.data,
      });
    }),

  "forms.publish": publicProcedure
    .input(z.object({ formId: z.string() }))
    .mutation(async ({ input }) => {
      return db.publicIntakeForm.update({
        where: { id: input.formId },
        data: { isPublished: true },
      });
    }),

  "forms.unpublish": publicProcedure
    .input(z.object({ formId: z.string() }))
    .mutation(async ({ input }) => {
      return db.publicIntakeForm.update({
        where: { id: input.formId },
        data: { isPublished: false },
      });
    }),

  "forms.delete": publicProcedure
    .input(z.object({ formId: z.string() }))
    .mutation(async ({ input }) => {
      return db.publicIntakeForm.delete({ where: { id: input.formId } });
    }),

  "forms.duplicate": publicProcedure
    .input(z.object({ formId: z.string(), newName: z.string() }))
    .mutation(async ({ input }) => {
      return intakeEngine.duplicateForm(input.formId, input.newName);
    }),

  "forms.getEmbedCode": publicProcedure
    .input(z.object({ formId: z.string() }))
    .query(async ({ input }) => {
      return intakeEngine.generateEmbedCode(input.formId);
    }),

  "forms.getQRCode": publicProcedure
    .input(z.object({ formId: z.string() }))
    .query(async ({ input }) => {
      return intakeEngine.generateQRCode(input.formId);
    }),

  "forms.preview": publicProcedure
    .input(z.object({ formId: z.string() }))
    .query(async ({ input }) => {
      return db.publicIntakeForm.findUnique({ where: { id: input.formId } });
    }),

  // ── Submissions (93-101) ───────────────────────────────────────────

  "submissions.list": publicProcedure
    .input(z.object({
      formId: z.string().optional(),
      status: z.string().optional(),
      dateRange: z.object({ from: z.string(), to: z.string() }).optional(),
      page: z.number().optional(),
    }).optional())
    .query(async ({ input }) => {
      const page = input?.page ?? 1;
      const take = 25;
      return db.intakeSubmission.findMany({
        where: {
          formId: input?.formId,
          status: input?.status as any,
          createdAt: input?.dateRange
            ? { gte: new Date(input.dateRange.from), lte: new Date(input.dateRange.to) }
            : undefined,
        },
        orderBy: { createdAt: "desc" },
        take,
        skip: (page - 1) * take,
        include: { form: true },
      });
    }),

  "submissions.get": publicProcedure
    .input(z.object({ submissionId: z.string() }))
    .query(async ({ input }) => {
      return db.intakeSubmission.findUnique({
        where: { id: input.submissionId },
        include: { form: true },
      });
    }),

  "submissions.updateStatus": publicProcedure
    .input(z.object({ submissionId: z.string(), status: z.string() }))
    .mutation(async ({ input }) => {
      return db.intakeSubmission.update({
        where: { id: input.submissionId },
        data: { status: input.status as any },
      });
    }),

  "submissions.markContacted": publicProcedure
    .input(z.object({
      submissionId: z.string(),
      contactedBy: z.string(),
      contactMethod: z.string(),
    }))
    .mutation(async ({ input }) => {
      return db.intakeSubmission.update({
        where: { id: input.submissionId },
        data: {
          contactedAt: new Date(),
          contactedBy: input.contactedBy,
          contactMethod: input.contactMethod,
          status: "INTAKE_CONTACTED" as any,
        },
      });
    }),

  "submissions.reject": publicProcedure
    .input(z.object({ submissionId: z.string(), reason: z.string() }))
    .mutation(async ({ input }) => {
      return db.intakeSubmission.update({
        where: { id: input.submissionId },
        data: { status: "INTAKE_REJECTED" as any, rejectedReason: input.reason },
      });
    }),

  "submissions.convertToMatter": publicProcedure
    .input(z.object({
      submissionId: z.string(),
      practiceArea: z.string().optional(),
      assignedTo: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      return intakeEngine.convertSubmissionToMatter(input.submissionId, {
        practiceArea: input.practiceArea,
        assignedTo: input.assignedTo,
      });
    }),

  "submissions.assessQuality": publicProcedure
    .input(z.object({ submissionId: z.string() }))
    .mutation(async ({ input }) => {
      return intakeEngine.assessSubmissionQuality(input.submissionId);
    }),

  "submissions.export": publicProcedure
    .input(z.object({ formId: z.string(), format: z.string().optional() }))
    .mutation(async ({ input }) => {
      return intakeEngine.batchExportSubmissions(input.formId, { from: new Date(0), to: new Date() }, input.format || "csv");
    }),

  "submissions.getUnreviewed": publicProcedure
    .query(async () => {
      return db.intakeSubmission.findMany({
        where: { status: "INTAKE_NEW" as any },
        orderBy: { qualityScore: "desc" },
      });
    }),

  // ── Analytics (102-106) ────────────────────────────────────────────

  "analytics.getForForm": publicProcedure
    .input(z.object({
      formId: z.string(),
      dateRange: z.object({ from: z.string(), to: z.string() }),
    }))
    .query(async ({ input }) => {
      return intakeEngine.getFormAnalytics(input.formId, { from: new Date(input.dateRange.from), to: new Date(input.dateRange.to) });
    }),

  "analytics.getFieldDropoff": publicProcedure
    .input(z.object({ formId: z.string() }))
    .query(async ({ input }) => {
      return intakeEngine.detectFieldDropoff(input.formId);
    }),

  "analytics.optimize": publicProcedure
    .input(z.object({ formId: z.string() }))
    .mutation(async ({ input }) => {
      return intakeEngine.optimizeForm(input.formId);
    }),

  "analytics.getFunnel": publicProcedure
    .input(z.object({
      formId: z.string(),
      dateRange: z.object({ from: z.string(), to: z.string() }),
    }))
    .query(async ({ input }) => {
      return intakeEngine.getSubmissionFunnel(input.formId, { from: new Date(input.dateRange.from), to: new Date(input.dateRange.to) });
    }),

  "analytics.compareForms": publicProcedure
    .input(z.object({ formId1: z.string(), formId2: z.string() }))
    .query(async ({ input }) => {
      const [form1, form2] = await Promise.all([
        db.publicIntakeForm.findUnique({
          where: { id: input.formId1 },
          include: { _count: { select: { submissions: true } } },
        }),
        db.publicIntakeForm.findUnique({
          where: { id: input.formId2 },
          include: { _count: { select: { submissions: true } } },
        }),
      ]);
      return { form1, form2 };
    }),

  // ── A/B Testing (107-112) ─────────────────────────────────────────

  "abTest.create": publicProcedure
    .input(z.object({
      controlFormId: z.string(),
      variantFormId: z.string(),
      name: z.string(),
      trafficSplit: z.number(),
    }))
    .mutation(async ({ input }) => {
      return intakeEngine.createABTest(input);
    }),

  "abTest.start": publicProcedure
    .input(z.object({ testId: z.string() }))
    .mutation(async ({ input }) => {
      return db.intakeFormABTest.update({
        where: { id: input.testId },
        data: { status: "AB_RUNNING" as any, startDate: new Date() },
      });
    }),

  "abTest.pause": publicProcedure
    .input(z.object({ testId: z.string() }))
    .mutation(async ({ input }) => {
      return db.intakeFormABTest.update({
        where: { id: input.testId },
        data: { status: "AB_PAUSED" as any },
      });
    }),

  "abTest.resolve": publicProcedure
    .input(z.object({ testId: z.string() }))
    .mutation(async ({ input }) => {
      return intakeEngine.resolveABTest(input.testId);
    }),

  "abTest.list": publicProcedure
    .query(async () => {
      return db.intakeFormABTest.findMany();
    }),

  "abTest.get": publicProcedure
    .input(z.object({ testId: z.string() }))
    .query(async ({ input }) => {
      return db.intakeFormABTest.findUnique({ where: { id: input.testId } });
    }),
});
