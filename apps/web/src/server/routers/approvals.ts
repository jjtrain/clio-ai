import { z } from "zod";
import { router, publicProcedure } from "../trpc";

const TRIGGER_ENUM = ["ALL_INVOICES", "AMOUNT_THRESHOLD", "PRACTICE_AREA", "CLIENT", "MATTER_TYPE"] as const;
const STATUS_ENUM = ["PENDING", "APPROVED", "REJECTED", "ESCALATED", "AUTO_APPROVED", "CANCELLED"] as const;

export const approvalsRouter = router({
  // ─── Workflows ─────────────────────────────────────────────────

  listWorkflows: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.approvalWorkflow.findMany({
      include: { _count: { select: { requests: true } } },
      orderBy: { createdAt: "desc" },
    });
  }),

  getWorkflow: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.approvalWorkflow.findUniqueOrThrow({ where: { id: input.id } });
    }),

  createWorkflow: publicProcedure
    .input(z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      triggerType: z.enum(TRIGGER_ENUM),
      triggerCondition: z.string().optional(),
      steps: z.string(),
      isActive: z.boolean().optional(),
      requireAllApprovers: z.boolean().optional(),
      autoApproveEnabled: z.boolean().optional(),
      autoApproveAfterDays: z.number().optional(),
      escalationEnabled: z.boolean().optional(),
      escalationAfterDays: z.number().optional(),
      escalationEmail: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.approvalWorkflow.create({ data: input });
    }),

  updateWorkflow: publicProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional().nullable(),
      triggerType: z.enum(TRIGGER_ENUM).optional(),
      triggerCondition: z.string().optional().nullable(),
      steps: z.string().optional(),
      isActive: z.boolean().optional(),
      requireAllApprovers: z.boolean().optional(),
      autoApproveEnabled: z.boolean().optional(),
      autoApproveAfterDays: z.number().optional().nullable(),
      escalationEnabled: z.boolean().optional(),
      escalationAfterDays: z.number().optional().nullable(),
      escalationEmail: z.string().optional().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.approvalWorkflow.update({ where: { id }, data });
    }),

  deleteWorkflow: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const pending = await ctx.db.approvalRequest.count({ where: { workflowId: input.id, status: "PENDING" } });
      if (pending > 0) throw new Error("Cannot delete workflow with pending requests");
      return ctx.db.approvalWorkflow.delete({ where: { id: input.id } });
    }),

  toggleActive: publicProcedure
    .input(z.object({ id: z.string(), isActive: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.approvalWorkflow.update({ where: { id: input.id }, data: { isActive: input.isActive } });
    }),

  duplicateWorkflow: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const wf = await ctx.db.approvalWorkflow.findUniqueOrThrow({ where: { id: input.id } });
      const { id: _id, createdAt: _c, updatedAt: _u, ...data } = wf;
      return ctx.db.approvalWorkflow.create({ data: { ...data, name: `Copy of ${data.name}`, isActive: false } });
    }),

  // ─── Requests ──────────────────────────────────────────────────

  listRequests: publicProcedure
    .input(z.object({
      status: z.enum(STATUS_ENUM).optional(),
      workflowId: z.string().optional(),
      limit: z.number().min(1).max(100).default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.status) where.status = input.status;
      if (input?.workflowId) where.workflowId = input.workflowId;
      return ctx.db.approvalRequest.findMany({
        where,
        include: {
          invoice: { include: { matter: { include: { client: true } } } },
          workflow: true,
          actions: { orderBy: { actedAt: "desc" }, take: 1 },
        },
        orderBy: { submittedAt: "asc" },
        take: input?.limit || 50,
      });
    }),

  getRequest: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.approvalRequest.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          invoice: { include: { matter: { include: { client: true } }, lineItems: { take: 5 } } },
          workflow: true,
          actions: { orderBy: { actedAt: "asc" } },
        },
      });
    }),

  submitForApproval: publicProcedure
    .input(z.object({ invoiceId: z.string(), submittedBy: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const invoice = await ctx.db.invoice.findUniqueOrThrow({
        where: { id: input.invoiceId },
        include: { matter: { include: { client: true } } },
      });

      // Find matching workflow
      const workflows = await ctx.db.approvalWorkflow.findMany({ where: { isActive: true }, orderBy: { triggerType: "asc" } });
      let matched: any = null;

      for (const wf of workflows) {
        const cond = wf.triggerCondition ? JSON.parse(wf.triggerCondition) : {};
        switch (wf.triggerType) {
          case "ALL_INVOICES":
            if (!matched) matched = wf; // lowest priority
            break;
          case "AMOUNT_THRESHOLD":
            if (cond.minAmount && Number(invoice.total) >= cond.minAmount) matched = wf;
            if (cond.maxAmount && Number(invoice.total) <= cond.maxAmount) matched = wf;
            if (cond.minAmount && cond.maxAmount && Number(invoice.total) >= cond.minAmount && Number(invoice.total) <= cond.maxAmount) matched = wf;
            break;
          case "PRACTICE_AREA":
            if (cond.practiceAreas?.includes(invoice.matter.practiceArea)) matched = wf;
            break;
          case "CLIENT":
            if (cond.clientIds?.includes(invoice.matter.clientId)) matched = wf;
            break;
          case "MATTER_TYPE":
            if (cond.matterTypes?.includes(invoice.matter.practiceArea)) matched = wf;
            break;
        }
      }

      if (!matched) {
        // No workflow matches — auto-approve
        return { autoApproved: true, message: "No matching workflow — invoice approved automatically" };
      }

      return ctx.db.approvalRequest.create({
        data: {
          invoiceId: input.invoiceId,
          workflowId: matched.id,
          currentStep: 1,
          status: "PENDING",
          submittedBy: input.submittedBy || "System",
          submittedAt: new Date(),
        },
        include: { workflow: true, invoice: true },
      });
    }),

  approve: publicProcedure
    .input(z.object({ requestId: z.string(), comment: z.string().optional(), approverName: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.approvalRequest.findUniqueOrThrow({
        where: { id: input.requestId },
        include: { workflow: true },
      });

      const steps: any[] = JSON.parse(req.workflow.steps);
      const currentStep = steps.find((s: any) => s.stepNumber === req.currentStep);

      await ctx.db.approvalAction.create({
        data: {
          requestId: input.requestId,
          stepNumber: req.currentStep,
          approverName: input.approverName || currentStep?.approverName || "Approver",
          action: "APPROVED",
          comment: input.comment,
        },
      });

      const nextStep = steps.find((s: any) => s.stepNumber > req.currentStep && s.required);
      const allDone = !nextStep || !req.workflow.requireAllApprovers;

      if (allDone) {
        return ctx.db.approvalRequest.update({
          where: { id: input.requestId },
          data: { status: "APPROVED", completedAt: new Date() },
          include: { invoice: true, workflow: true },
        });
      } else {
        return ctx.db.approvalRequest.update({
          where: { id: input.requestId },
          data: { currentStep: nextStep.stepNumber },
          include: { invoice: true, workflow: true },
        });
      }
    }),

  reject: publicProcedure
    .input(z.object({ requestId: z.string(), comment: z.string().min(1), approverName: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.approvalRequest.findUniqueOrThrow({
        where: { id: input.requestId },
        include: { workflow: true },
      });

      const steps: any[] = JSON.parse(req.workflow.steps);
      const currentStep = steps.find((s: any) => s.stepNumber === req.currentStep);

      await ctx.db.approvalAction.create({
        data: {
          requestId: input.requestId,
          stepNumber: req.currentStep,
          approverName: input.approverName || currentStep?.approverName || "Approver",
          action: "REJECTED",
          comment: input.comment,
        },
      });

      return ctx.db.approvalRequest.update({
        where: { id: input.requestId },
        data: { status: "REJECTED", completedAt: new Date() },
        include: { invoice: true, workflow: true },
      });
    }),

  escalate: publicProcedure
    .input(z.object({ requestId: z.string(), comment: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.approvalRequest.findUniqueOrThrow({
        where: { id: input.requestId },
        include: { workflow: true },
      });

      const steps: any[] = JSON.parse(req.workflow.steps);
      const nextStep = steps.find((s: any) => s.stepNumber > req.currentStep);

      await ctx.db.approvalAction.create({
        data: {
          requestId: input.requestId,
          stepNumber: req.currentStep,
          approverName: "System",
          action: "ESCALATED",
          comment: input.comment || "Escalated due to no response",
        },
      });

      return ctx.db.approvalRequest.update({
        where: { id: input.requestId },
        data: {
          status: nextStep ? "PENDING" : "ESCALATED",
          currentStep: nextStep ? nextStep.stepNumber : req.currentStep,
        },
      });
    }),

  cancel: publicProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.approvalRequest.update({
        where: { id: input.requestId },
        data: { status: "CANCELLED", completedAt: new Date() },
      });
    }),

  resubmit: publicProcedure
    .input(z.object({ requestId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.approvalRequest.update({
        where: { id: input.requestId },
        data: { status: "PENDING", currentStep: 1, completedAt: null, submittedAt: new Date() },
      });
    }),

  addComment: publicProcedure
    .input(z.object({ requestId: z.string(), comment: z.string().min(1), authorName: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const req = await ctx.db.approvalRequest.findUniqueOrThrow({ where: { id: input.requestId } });
      return ctx.db.approvalAction.create({
        data: {
          requestId: input.requestId,
          stepNumber: req.currentStep,
          approverName: input.authorName || "User",
          action: "COMMENTED",
          comment: input.comment,
        },
      });
    }),

  getMyPendingApprovals: publicProcedure.query(async ({ ctx }) => {
    const pending = await ctx.db.approvalRequest.findMany({
      where: { status: "PENDING" },
      include: {
        invoice: { include: { matter: { include: { client: true } } } },
        workflow: true,
      },
      orderBy: { submittedAt: "asc" },
    });
    return { count: pending.length, requests: pending };
  }),

  bulkApprove: publicProcedure
    .input(z.object({ requestIds: z.array(z.string()), approverName: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      let approved = 0;
      for (const id of input.requestIds) {
        try {
          const req = await ctx.db.approvalRequest.findUnique({ where: { id }, include: { workflow: true } });
          if (!req || req.status !== "PENDING") continue;

          const steps: any[] = JSON.parse(req.workflow.steps);
          const currentStep = steps.find((s: any) => s.stepNumber === req.currentStep);

          await ctx.db.approvalAction.create({
            data: {
              requestId: id,
              stepNumber: req.currentStep,
              approverName: input.approverName || currentStep?.approverName || "Bulk Approver",
              action: "APPROVED",
            },
          });

          await ctx.db.approvalRequest.update({
            where: { id },
            data: { status: "APPROVED", completedAt: new Date() },
          });
          approved++;
        } catch {}
      }
      return { approved };
    }),

  // ─── Auto-Processing ──────────────────────────────────────────

  processAutoApprovals: publicProcedure.mutation(async ({ ctx }) => {
    const pending = await ctx.db.approvalRequest.findMany({
      where: { status: "PENDING" },
      include: { workflow: true },
    });

    let count = 0;
    for (const req of pending) {
      if (!req.workflow.autoApproveEnabled || !req.workflow.autoApproveAfterDays) continue;
      const daysSince = Math.floor((Date.now() - new Date(req.submittedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= req.workflow.autoApproveAfterDays) {
        await ctx.db.approvalAction.create({
          data: { requestId: req.id, stepNumber: req.currentStep, approverName: "System", action: "AUTO_APPROVED", comment: `Auto-approved after ${daysSince} days` },
        });
        await ctx.db.approvalRequest.update({
          where: { id: req.id },
          data: { status: "AUTO_APPROVED", completedAt: new Date() },
        });
        count++;
      }
    }
    return { processed: count };
  }),

  processEscalations: publicProcedure.mutation(async ({ ctx }) => {
    const pending = await ctx.db.approvalRequest.findMany({
      where: { status: "PENDING" },
      include: { workflow: true },
    });

    let count = 0;
    for (const req of pending) {
      if (!req.workflow.escalationEnabled || !req.workflow.escalationAfterDays) continue;
      const daysSince = Math.floor((Date.now() - new Date(req.submittedAt).getTime()) / (1000 * 60 * 60 * 24));
      if (daysSince >= req.workflow.escalationAfterDays) {
        const steps: any[] = JSON.parse(req.workflow.steps);
        const nextStep = steps.find((s: any) => s.stepNumber > req.currentStep);

        await ctx.db.approvalAction.create({
          data: { requestId: req.id, stepNumber: req.currentStep, approverName: "System", action: "ESCALATED", comment: `Escalated after ${daysSince} days` },
        });
        await ctx.db.approvalRequest.update({
          where: { id: req.id },
          data: { currentStep: nextStep ? nextStep.stepNumber : req.currentStep, status: nextStep ? "PENDING" : "ESCALATED" },
        });
        count++;
      }
    }
    return { processed: count };
  }),

  // ─── Stats ─────────────────────────────────────────────────────

  getApprovalStats: publicProcedure.query(async ({ ctx }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pending = await ctx.db.approvalRequest.count({ where: { status: "PENDING" } });
    const approvedToday = await ctx.db.approvalRequest.count({ where: { status: { in: ["APPROVED", "AUTO_APPROVED"] }, completedAt: { gte: today } } });
    const rejectedToday = await ctx.db.approvalRequest.count({ where: { status: "REJECTED", completedAt: { gte: today } } });
    const autoApproved = await ctx.db.approvalRequest.count({ where: { status: "AUTO_APPROVED" } });

    const completed = await ctx.db.approvalRequest.findMany({
      where: { completedAt: { not: null } },
      select: { submittedAt: true, completedAt: true },
    });
    const avgHours = completed.length > 0
      ? completed.reduce((s, r) => s + (new Date(r.completedAt!).getTime() - new Date(r.submittedAt).getTime()) / (1000 * 60 * 60), 0) / completed.length
      : 0;

    const total = await ctx.db.approvalRequest.count();
    const approved = await ctx.db.approvalRequest.count({ where: { status: { in: ["APPROVED", "AUTO_APPROVED"] } } });

    return {
      pending,
      approvedToday,
      rejectedToday,
      avgApprovalTime: Math.round(avgHours * 10) / 10,
      approvalRate: total > 0 ? Math.round((approved / total) * 100 * 10) / 10 : 0,
      autoApproved,
    };
  }),

  // ─── Seed Starter Workflows ────────────────────────────────────

  seedWorkflows: publicProcedure.mutation(async ({ ctx }) => {
    const existing = await ctx.db.approvalWorkflow.count();
    if (existing > 0) return { seeded: false };

    await ctx.db.approvalWorkflow.createMany({
      data: [
        {
          name: "High Value Invoice Review",
          triggerType: "AMOUNT_THRESHOLD",
          triggerCondition: JSON.stringify({ minAmount: 5000 }),
          steps: JSON.stringify([{ stepNumber: 1, approverType: "specific_user", approverName: "Managing Attorney", required: true }]),
          isActive: true,
          autoApproveEnabled: true,
          autoApproveAfterDays: 5,
          escalationEnabled: true,
          escalationAfterDays: 3,
        },
        {
          name: "Standard Invoice Approval",
          triggerType: "ALL_INVOICES",
          triggerCondition: null,
          steps: JSON.stringify([{ stepNumber: 1, approverType: "specific_user", approverName: "Billing Manager", required: true }]),
          isActive: false,
          autoApproveEnabled: true,
          autoApproveAfterDays: 7,
        },
      ],
    });

    return { seeded: true };
  }),
});
