import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { LeadGrade, UrgencyLevel, FollowUpTrigger, FollowUpActionType, FollowUpExecStatus } from "@prisma/client";
import { screenLead, screenIntakeSubmission, generateFollowUpEmail } from "@/lib/ai-screening";
import { sendCampaignEmail } from "@/lib/email";

// ─── Starter Sequences ──────────────────────────────────────────

const STARTER_SEQUENCES = [
  {
    name: "New Lead Welcome",
    description: "Automated welcome sequence for new leads. Sends initial email, creates follow-up task, and escalates if no response.",
    triggerEvent: "NEW_LEAD" as const,
    triggerCondition: null,
    steps: [
      { stepNumber: 1, delayDays: 0, delayHours: 0, actionType: "EMAIL" as const, emailSubject: "Thank you for contacting {FIRM_NAME}", emailContent: "<p>Dear {NAME},</p><p>Thank you for reaching out to {FIRM_NAME}. We received your inquiry and a member of our team will be reviewing it shortly.</p><p>If your matter is urgent, please don't hesitate to call our office directly.</p><p>We look forward to assisting you.</p><p>Best regards,<br/>{FIRM_NAME}</p>" },
      { stepNumber: 2, delayDays: 0, delayHours: 1, actionType: "TASK" as const, taskTitle: "Review new lead: {NAME}", taskDescription: "New lead has been received and sent a welcome email. Please review their inquiry and reach out within 24 hours." },
      { stepNumber: 3, delayDays: 1, delayHours: 0, actionType: "NOTIFICATION" as const, notificationMessage: "Lead {NAME} has not been contacted yet. Please follow up." },
    ],
  },
  {
    name: "No Response Follow-up",
    description: "Re-engagement sequence when a lead goes quiet. Sends gentle reminders before closing.",
    triggerEvent: "NO_RESPONSE" as const,
    triggerCondition: JSON.stringify({ daysSinceLastContact: 3 }),
    steps: [
      { stepNumber: 1, delayDays: 0, delayHours: 0, actionType: "EMAIL" as const, emailSubject: "Following up on your inquiry - {FIRM_NAME}", emailContent: "<p>Dear {NAME},</p><p>I wanted to follow up on your recent inquiry with {FIRM_NAME}. We'd love the opportunity to discuss your legal needs.</p><p>Would you be available for a brief phone call this week? Please let us know a convenient time.</p><p>Best regards,<br/>{FIRM_NAME}</p>" },
      { stepNumber: 2, delayDays: 3, delayHours: 0, actionType: "EMAIL" as const, emailSubject: "Still here to help - {FIRM_NAME}", emailContent: "<p>Dear {NAME},</p><p>I understand life gets busy. I just wanted to let you know that we're still here and ready to help whenever you're ready to move forward.</p><p>If your situation has changed or you've found representation elsewhere, no worries at all. We wish you the best.</p><p>Warm regards,<br/>{FIRM_NAME}</p>" },
      { stepNumber: 3, delayDays: 7, delayHours: 0, actionType: "STATUS_CHANGE" as const, newStatus: "ARCHIVED" },
    ],
  },
  {
    name: "High-Value Lead Fast Track",
    description: "Expedited handling for A-grade leads. Immediate notification and rapid follow-up.",
    triggerEvent: "LEAD_QUALIFIED" as const,
    triggerCondition: JSON.stringify({ leadGrade: "A" }),
    steps: [
      { stepNumber: 1, delayDays: 0, delayHours: 0, actionType: "NOTIFICATION" as const, notificationMessage: "HIGH VALUE LEAD: {NAME} scored A-grade. Immediate follow-up recommended." },
      { stepNumber: 2, delayDays: 0, delayHours: 0, actionType: "TASK" as const, taskTitle: "URGENT: Contact A-grade lead {NAME}", taskDescription: "This lead scored A-grade in AI screening. Contact within 1 hour for best conversion rate." },
      { stepNumber: 3, delayDays: 0, delayHours: 2, actionType: "EMAIL" as const, emailSubject: "We'd love to schedule a consultation - {FIRM_NAME}", emailContent: "<p>Dear {NAME},</p><p>Thank you for reaching out to {FIRM_NAME}. After reviewing your inquiry, we believe we can help with your {PRACTICE_AREA} matter.</p><p>I'd like to schedule a consultation at your earliest convenience. Please reply with a few times that work for you, or feel free to call our office directly.</p><p>We look forward to speaking with you.</p><p>Best regards,<br/>{FIRM_NAME}</p>" },
    ],
  },
];

async function ensureStarterSequences(db: any) {
  const count = await db.followUpSequence.count();
  if (count > 0) return;

  for (const seq of STARTER_SEQUENCES) {
    await db.followUpSequence.create({
      data: {
        name: seq.name,
        description: seq.description,
        triggerEvent: seq.triggerEvent,
        triggerCondition: seq.triggerCondition,
        isActive: true,
        steps: {
          create: seq.steps.map((s) => ({
            stepNumber: s.stepNumber,
            delayDays: s.delayDays,
            delayHours: s.delayHours,
            actionType: s.actionType,
            emailSubject: (s as any).emailSubject || null,
            emailContent: (s as any).emailContent || null,
            taskTitle: (s as any).taskTitle || null,
            taskDescription: (s as any).taskDescription || null,
            newStatus: (s as any).newStatus || null,
            notificationMessage: (s as any).notificationMessage || null,
          })),
        },
      },
    });
  }
}

// ─── Helper: execute a single follow-up step ────────────────────

async function executeFollowUpStep(db: any, executionId: string) {
  const execution = await db.followUpExecution.findUnique({
    where: { id: executionId },
    include: { step: true, lead: true, sequence: true },
  });
  if (!execution || execution.status !== "SCHEDULED") return;

  try {
    const lead = execution.lead;
    const step = execution.step;

    // Get firm info for placeholder replacement
    const firmSettings = await db.settings.findUnique({ where: { id: "default" } });
    const firmName = firmSettings?.firmName || "Our Law Firm";

    const replacePlaceholders = (text: string) =>
      text
        .replace(/\{NAME\}/g, lead.name || "there")
        .replace(/\{FIRM_NAME\}/g, firmName)
        .replace(/\{PRACTICE_AREA\}/g, lead.practiceArea || "your legal matter")
        .replace(/\{EMAIL\}/g, lead.email || "");

    switch (step.actionType) {
      case "EMAIL": {
        if (!lead.email) {
          await db.followUpExecution.update({ where: { id: executionId }, data: { status: "FAILED", executedAt: new Date(), errorMessage: "Lead has no email" } });
          return;
        }
        const subject = replacePlaceholders(step.emailSubject || "Follow-up");
        const html = replacePlaceholders(step.emailContent || "");
        await sendCampaignEmail({
          to: lead.email,
          name: lead.name,
          subject,
          htmlContent: html,
          fromEmail: firmSettings?.email || "noreply@example.com",
          firmName,
        });
        await db.leadActivity.create({
          data: { leadId: lead.id, type: "EMAIL_SENT", description: `Follow-up email sent: ${subject}` },
        });
        break;
      }
      case "TASK": {
        const title = replacePlaceholders(step.taskTitle || "Follow up");
        const desc = replacePlaceholders(step.taskDescription || "");
        await db.task.create({
          data: {
            title,
            description: desc,
            status: "TODO",
            priority: "HIGH",
            matterId: lead.matterId || undefined,
          },
        });
        break;
      }
      case "STATUS_CHANGE": {
        if (step.newStatus) {
          await db.lead.update({ where: { id: lead.id }, data: { status: step.newStatus } });
          await db.leadActivity.create({
            data: { leadId: lead.id, type: "STATUS_CHANGED", description: `Status auto-changed to ${step.newStatus} by follow-up sequence` },
          });
        }
        break;
      }
      case "NOTIFICATION": {
        const msg = replacePlaceholders(step.notificationMessage || "");
        console.log(`[FollowUp Notification] Lead ${lead.name}: ${msg}`);
        break;
      }
    }

    await db.followUpExecution.update({
      where: { id: executionId },
      data: { status: "COMPLETED", executedAt: new Date() },
    });
  } catch (err: any) {
    await db.followUpExecution.update({
      where: { id: executionId },
      data: { status: "FAILED", executedAt: new Date(), errorMessage: err.message?.slice(0, 500) },
    });
  }
}

// ─── Router ─────────────────────────────────────────────────────

export const screeningRouter = router({
  // ── Screening ─────────────────────────────────────────────────

  screenLead: publicProcedure
    .input(z.object({ leadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.findUnique({ where: { id: input.leadId } });
      if (!lead) throw new Error("Lead not found");

      const settings = await ctx.db.intakeScreeningSettings.upsert({
        where: { id: "default" },
        create: {},
        update: {},
      });

      let firmCriteria: any = undefined;
      if (settings.screeningCriteria) {
        try { firmCriteria = JSON.parse(settings.screeningCriteria); } catch {}
      }

      const result = await screenLead(
        { name: lead.name, email: lead.email, phone: lead.phone, source: lead.source, practiceArea: lead.practiceArea, description: lead.description },
        firmCriteria
      );

      const qualification = await ctx.db.leadQualification.upsert({
        where: { leadId: input.leadId },
        create: {
          leadId: input.leadId,
          score: result.score,
          grade: result.grade as LeadGrade,
          aiAnalysis: result.analysis,
          practiceAreaMatch: result.practiceAreaMatch,
          urgencyLevel: result.urgency as UrgencyLevel,
          estimatedValue: result.estimatedValue ?? null,
          redFlags: JSON.stringify(result.redFlags),
          strengths: JSON.stringify(result.strengths),
          recommendedAction: result.recommendedAction,
          autoScreened: false,
        },
        update: {
          score: result.score,
          grade: result.grade as LeadGrade,
          aiAnalysis: result.analysis,
          practiceAreaMatch: result.practiceAreaMatch,
          urgencyLevel: result.urgency as UrgencyLevel,
          estimatedValue: result.estimatedValue ?? null,
          redFlags: JSON.stringify(result.redFlags),
          strengths: JSON.stringify(result.strengths),
          recommendedAction: result.recommendedAction,
          screenedAt: new Date(),
        },
      });

      // Auto-decline if below threshold
      if (result.score < settings.autoDeclineScore) {
        await ctx.db.lead.update({ where: { id: input.leadId }, data: { status: "DECLINED" } });
        await ctx.db.leadActivity.create({
          data: { leadId: input.leadId, type: "STATUS_CHANGED", description: `Auto-declined: AI screening score ${result.score} below threshold ${settings.autoDeclineScore}` },
        });
      }

      // Notify on high value
      if (result.grade === "A" && settings.notifyOnHighValue) {
        console.log(`[Screening] HIGH VALUE LEAD: ${lead.name} scored ${result.score} (Grade A)`);
      }

      await ctx.db.leadActivity.create({
        data: { leadId: input.leadId, type: "NOTE_ADDED", description: `AI screening completed: Grade ${result.grade}, Score ${result.score}` },
      });

      return qualification;
    }),

  screenIntakeSubmission: publicProcedure
    .input(z.object({ submissionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.intakeFormSubmission.findUnique({
        where: { id: input.submissionId },
        include: { template: true },
      });
      if (!submission) throw new Error("Submission not found");

      const settings = await ctx.db.intakeScreeningSettings.upsert({ where: { id: "default" }, create: {}, update: {} });
      let firmCriteria: any = undefined;
      if (settings.screeningCriteria) { try { firmCriteria = JSON.parse(settings.screeningCriteria); } catch {} }

      const submissionData = typeof submission.data === "string" ? JSON.parse(submission.data) : submission.data;
      const result = await screenIntakeSubmission(submissionData, submission.template.name, firmCriteria);

      // Find lead linked to this submission
      const lead = await ctx.db.lead.findUnique({ where: { intakeSubmissionId: input.submissionId } });
      if (lead) {
        const qualification = await ctx.db.leadQualification.upsert({
          where: { leadId: lead.id },
          create: {
            leadId: lead.id,
            score: result.score,
            grade: result.grade as LeadGrade,
            aiAnalysis: result.analysis,
            practiceAreaMatch: result.practiceAreaMatch,
            urgencyLevel: result.urgency as UrgencyLevel,
            estimatedValue: result.estimatedValue ?? null,
            redFlags: JSON.stringify(result.redFlags),
            strengths: JSON.stringify(result.strengths),
            recommendedAction: result.recommendedAction,
            autoScreened: true,
          },
          update: {
            score: result.score,
            grade: result.grade as LeadGrade,
            aiAnalysis: result.analysis,
            practiceAreaMatch: result.practiceAreaMatch,
            urgencyLevel: result.urgency as UrgencyLevel,
            estimatedValue: result.estimatedValue ?? null,
            redFlags: JSON.stringify(result.redFlags),
            strengths: JSON.stringify(result.strengths),
            recommendedAction: result.recommendedAction,
            screenedAt: new Date(),
          },
        });

        await ctx.db.leadActivity.create({
          data: { leadId: lead.id, type: "NOTE_ADDED", description: `AI intake screening: Grade ${result.grade}, Score ${result.score}` },
        });

        return qualification;
      }

      return result;
    }),

  batchScreen: publicProcedure.mutation(async ({ ctx }) => {
    const unscreened = await ctx.db.lead.findMany({
      where: { qualification: null, status: { notIn: ["CONVERTED", "ARCHIVED", "DECLINED"] } },
      take: 10,
      orderBy: { createdAt: "desc" },
    });

    let processed = 0;
    for (const lead of unscreened) {
      try {
        const settings = await ctx.db.intakeScreeningSettings.upsert({ where: { id: "default" }, create: {}, update: {} });
        let firmCriteria: any;
        if (settings.screeningCriteria) { try { firmCriteria = JSON.parse(settings.screeningCriteria); } catch {} }

        const result = await screenLead(
          { name: lead.name, email: lead.email, phone: lead.phone, source: lead.source, practiceArea: lead.practiceArea, description: lead.description },
          firmCriteria
        );

        await ctx.db.leadQualification.upsert({
          where: { leadId: lead.id },
          create: {
            leadId: lead.id,
            score: result.score,
            grade: result.grade as LeadGrade,
            aiAnalysis: result.analysis,
            practiceAreaMatch: result.practiceAreaMatch,
            urgencyLevel: result.urgency as UrgencyLevel,
            estimatedValue: result.estimatedValue ?? null,
            redFlags: JSON.stringify(result.redFlags),
            strengths: JSON.stringify(result.strengths),
            recommendedAction: result.recommendedAction,
            autoScreened: true,
          },
          update: {},
        });

        if (result.score < settings.autoDeclineScore) {
          await ctx.db.lead.update({ where: { id: lead.id }, data: { status: "DECLINED" } });
        }

        processed++;
      } catch (err) {
        console.error(`[BatchScreen] Failed for lead ${lead.id}:`, err);
      }
    }

    return { processed, total: unscreened.length };
  }),

  getQualification: publicProcedure
    .input(z.object({ leadId: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.leadQualification.findUnique({
        where: { leadId: input.leadId },
        include: { lead: { select: { name: true, email: true, source: true, practiceArea: true } } },
      });
    }),

  listQualifications: publicProcedure
    .input(z.object({
      grade: z.nativeEnum(LeadGrade).optional(),
      urgency: z.nativeEnum(UrgencyLevel).optional(),
      minScore: z.number().optional(),
      maxScore: z.number().optional(),
      sortBy: z.enum(["score", "screenedAt", "urgencyLevel"]).default("screenedAt"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.grade) where.grade = input.grade;
      if (input?.urgency) where.urgencyLevel = input.urgency;
      if (input?.minScore !== undefined || input?.maxScore !== undefined) {
        where.score = {};
        if (input?.minScore !== undefined) where.score.gte = input.minScore;
        if (input?.maxScore !== undefined) where.score.lte = input.maxScore;
      }

      return ctx.db.leadQualification.findMany({
        where,
        include: { lead: { select: { id: true, name: true, email: true, source: true, practiceArea: true, status: true, createdAt: true } } },
        orderBy: { [input?.sortBy || "screenedAt"]: input?.sortOrder || "desc" },
      });
    }),

  // ── Follow-Up Sequences ────────────────────────────────────────

  listSequences: publicProcedure.query(async ({ ctx }) => {
    await ensureStarterSequences(ctx.db);
    return ctx.db.followUpSequence.findMany({
      include: {
        _count: { select: { steps: true, executions: true } },
        executions: { where: { status: "SCHEDULED" }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }),

  getSequence: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const seq = await ctx.db.followUpSequence.findUnique({
        where: { id: input.id },
        include: { steps: { orderBy: { stepNumber: "asc" } } },
      });
      if (!seq) throw new Error("Sequence not found");
      return seq;
    }),

  createSequence: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      triggerEvent: z.nativeEnum(FollowUpTrigger),
      triggerCondition: z.string().optional(),
      steps: z.array(z.object({
        stepNumber: z.number(),
        delayDays: z.number().min(0),
        delayHours: z.number().min(0).default(0),
        actionType: z.nativeEnum(FollowUpActionType),
        emailSubject: z.string().optional(),
        emailContent: z.string().optional(),
        taskTitle: z.string().optional(),
        taskDescription: z.string().optional(),
        newStatus: z.string().optional(),
        notificationMessage: z.string().optional(),
      })).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.followUpSequence.create({
        data: {
          name: input.name,
          description: input.description,
          triggerEvent: input.triggerEvent,
          triggerCondition: input.triggerCondition,
          steps: input.steps ? { create: input.steps } : undefined,
        },
        include: { steps: true },
      });
    }),

  updateSequence: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      triggerEvent: z.nativeEnum(FollowUpTrigger).optional(),
      triggerCondition: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.followUpSequence.update({ where: { id }, data });
    }),

  deleteSequence: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.followUpSequence.delete({ where: { id: input.id } });
    }),

  addStep: publicProcedure
    .input(z.object({
      sequenceId: z.string(),
      stepNumber: z.number(),
      delayDays: z.number().min(0),
      delayHours: z.number().min(0).default(0),
      actionType: z.nativeEnum(FollowUpActionType),
      emailSubject: z.string().optional(),
      emailContent: z.string().optional(),
      taskTitle: z.string().optional(),
      taskDescription: z.string().optional(),
      newStatus: z.string().optional(),
      notificationMessage: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.followUpStep.create({ data: input });
    }),

  updateStep: publicProcedure
    .input(z.object({
      id: z.string(),
      delayDays: z.number().min(0).optional(),
      delayHours: z.number().min(0).optional(),
      actionType: z.nativeEnum(FollowUpActionType).optional(),
      emailSubject: z.string().optional(),
      emailContent: z.string().optional(),
      taskTitle: z.string().optional(),
      taskDescription: z.string().optional(),
      newStatus: z.string().optional(),
      notificationMessage: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.followUpStep.update({ where: { id }, data });
    }),

  removeStep: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const step = await ctx.db.followUpStep.findUnique({ where: { id: input.id } });
      if (!step) throw new Error("Step not found");
      await ctx.db.followUpStep.delete({ where: { id: input.id } });
      // Reorder remaining steps
      const remaining = await ctx.db.followUpStep.findMany({
        where: { sequenceId: step.sequenceId },
        orderBy: { stepNumber: "asc" },
      });
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].stepNumber !== i + 1) {
          await ctx.db.followUpStep.update({ where: { id: remaining[i].id }, data: { stepNumber: i + 1 } });
        }
      }
    }),

  reorderSteps: publicProcedure
    .input(z.object({
      sequenceId: z.string(),
      stepIds: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      for (let i = 0; i < input.stepIds.length; i++) {
        await ctx.db.followUpStep.update({ where: { id: input.stepIds[i] }, data: { stepNumber: i + 1 } });
      }
    }),

  // ── Follow-Up Execution ────────────────────────────────────────

  startSequence: publicProcedure
    .input(z.object({ sequenceId: z.string(), leadId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sequence = await ctx.db.followUpSequence.findUnique({
        where: { id: input.sequenceId },
        include: { steps: { where: { isActive: true }, orderBy: { stepNumber: "asc" } } },
      });
      if (!sequence) throw new Error("Sequence not found");

      let scheduledFor = new Date();
      const executions = [];

      for (const step of sequence.steps) {
        scheduledFor = new Date(scheduledFor.getTime() + step.delayDays * 86400000 + step.delayHours * 3600000);
        executions.push({
          sequenceId: input.sequenceId,
          stepId: step.id,
          leadId: input.leadId,
          status: "SCHEDULED" as const,
          scheduledFor: new Date(scheduledFor),
        });
      }

      const created = [];
      for (const exec of executions) {
        created.push(await ctx.db.followUpExecution.create({ data: exec }));
      }

      return created;
    }),

  cancelSequenceForLead: publicProcedure
    .input(z.object({ leadId: z.string(), sequenceId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const where: any = { leadId: input.leadId, status: "SCHEDULED" };
      if (input.sequenceId) where.sequenceId = input.sequenceId;
      return ctx.db.followUpExecution.updateMany({
        where,
        data: { status: "CANCELLED" },
      });
    }),

  listExecutions: publicProcedure
    .input(z.object({
      leadId: z.string().optional(),
      status: z.nativeEnum(FollowUpExecStatus).optional(),
      sequenceId: z.string().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.leadId) where.leadId = input.leadId;
      if (input?.status) where.status = input.status;
      if (input?.sequenceId) where.sequenceId = input.sequenceId;

      return ctx.db.followUpExecution.findMany({
        where,
        include: {
          lead: { select: { name: true, email: true } },
          sequence: { select: { name: true } },
          step: { select: { stepNumber: true, actionType: true } },
        },
        orderBy: { scheduledFor: "desc" },
        take: input?.limit || 50,
      });
    }),

  executeStep: publicProcedure
    .input(z.object({ executionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await executeFollowUpStep(ctx.db, input.executionId);
    }),

  // ── Settings ──────────────────────────────────────────────────

  getSettings: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.intakeScreeningSettings.upsert({
      where: { id: "default" },
      create: {},
      update: {},
    });
  }),

  updateSettings: publicProcedure
    .input(z.object({
      isEnabled: z.boolean().optional(),
      autoScreenNewLeads: z.boolean().optional(),
      autoScreenIntakeSubmissions: z.boolean().optional(),
      minimumQualifyScore: z.number().min(0).max(100).optional(),
      autoDeclineScore: z.number().min(0).max(100).optional(),
      notifyOnHighValue: z.boolean().optional(),
      screeningCriteria: z.string().optional(),
      followUpEnabled: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.intakeScreeningSettings.upsert({
        where: { id: "default" },
        create: input,
        update: input,
      });
    }),

  // ── Trigger Integration ────────────────────────────────────────

  checkAndTrigger: publicProcedure
    .input(z.object({
      event: z.nativeEnum(FollowUpTrigger),
      leadId: z.string(),
      condition: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const settings = await ctx.db.intakeScreeningSettings.upsert({ where: { id: "default" }, create: {}, update: {} });
      if (!settings.followUpEnabled) return { triggered: 0 };

      const sequences = await ctx.db.followUpSequence.findMany({
        where: { triggerEvent: input.event, isActive: true },
        include: { steps: { where: { isActive: true }, orderBy: { stepNumber: "asc" } } },
      });

      let triggered = 0;
      for (const seq of sequences) {
        // Check trigger condition match
        if (seq.triggerCondition && input.condition) {
          try {
            const cond = JSON.parse(seq.triggerCondition);
            let matches = true;
            for (const [key, val] of Object.entries(cond)) {
              if (input.condition[key] !== undefined && input.condition[key] !== val) {
                matches = false;
                break;
              }
            }
            if (!matches) continue;
          } catch {}
        }

        // Check if this sequence is already running for this lead
        const existing = await ctx.db.followUpExecution.findFirst({
          where: { sequenceId: seq.id, leadId: input.leadId, status: "SCHEDULED" },
        });
        if (existing) continue;

        // Start the sequence
        let scheduledFor = new Date();
        for (const step of seq.steps) {
          scheduledFor = new Date(scheduledFor.getTime() + step.delayDays * 86400000 + step.delayHours * 3600000);
          await ctx.db.followUpExecution.create({
            data: {
              sequenceId: seq.id,
              stepId: step.id,
              leadId: input.leadId,
              status: "SCHEDULED",
              scheduledFor: new Date(scheduledFor),
            },
          });
        }
        triggered++;
      }

      return { triggered };
    }),

  // ── AI Generate Email ──────────────────────────────────────────

  aiGenerateEmail: publicProcedure
    .input(z.object({
      leadName: z.string(),
      leadEmail: z.string(),
      practiceArea: z.string().optional(),
      stepPurpose: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const firmSettings = await ctx.db.settings.findUnique({ where: { id: "default" } });
      return generateFollowUpEmail({
        leadName: input.leadName,
        leadEmail: input.leadEmail,
        practiceArea: input.practiceArea,
        firmName: firmSettings?.firmName || "Our Law Firm",
        stepPurpose: input.stepPurpose,
      });
    }),
});
