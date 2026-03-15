import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  extractDeadlinesFromText,
  draftClientUpdate,
  generateInvoiceFromTimeEntries,
  summarizeMatter,
  suggestTasksFromActivity,
} from "@/lib/ai-assistant";

export const aiAssistantRouter = router({
  // ── Settings ──────────────────────────────────────────
  getSettings: publicProcedure.query(async ({ ctx }) => {
    let settings = await ctx.db.aiAssistantSettings.findUnique({ where: { id: "default" } });
    if (!settings) {
      settings = await ctx.db.aiAssistantSettings.create({
        data: { id: "default" },
      });
    }
    return settings;
  }),

  updateSettings: publicProcedure
    .input(
      z.object({
        isEnabled: z.boolean().optional(),
        autoExtractDeadlines: z.boolean().optional(),
        autoSuggestTasks: z.boolean().optional(),
        aiModel: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.aiAssistantSettings.upsert({
        where: { id: "default" },
        create: { id: "default", ...input },
        update: input,
      });
    }),

  // ── Actions CRUD ──────────────────────────────────────
  listActions: publicProcedure
    .input(
      z.object({
        status: z.enum(["PENDING", "APPROVED", "REJECTED", "APPLIED"]).optional(),
        matterId: z.string().optional(),
        type: z.enum(["DEADLINE_EXTRACTION", "CLIENT_UPDATE_DRAFT", "TIME_TO_INVOICE", "MATTER_SUMMARY", "TASK_SUGGESTION"]).optional(),
        limit: z.number().min(1).max(100).default(50),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.status) where.status = input.status;
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.type) where.type = input.type;
      return ctx.db.aiAction.findMany({
        where,
        include: { matter: { select: { id: true, name: true, matterNumber: true } } },
        orderBy: { createdAt: "desc" },
        take: input?.limit || 50,
      });
    }),

  getAction: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.aiAction.findUnique({
        where: { id: input.id },
        include: { matter: { select: { id: true, name: true, matterNumber: true, client: { select: { name: true } } } } },
      });
    }),

  approveAction: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.aiAction.update({
        where: { id: input.id },
        data: { status: "APPROVED", reviewedAt: new Date() },
      });
    }),

  rejectAction: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.aiAction.update({
        where: { id: input.id },
        data: { status: "REJECTED", reviewedAt: new Date() },
      });
    }),

  applyAction: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.aiAction.update({
        where: { id: input.id },
        data: { status: "APPLIED", appliedAt: new Date(), reviewedAt: new Date() },
      });
    }),

  deleteAction: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.aiAction.delete({ where: { id: input.id } });
    }),

  // ── Generation Endpoints ──────────────────────────────
  extractDeadlines: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        documentText: z.string(),
        documentName: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.findUniqueOrThrow({
        where: { id: input.matterId },
        select: { name: true },
      });
      const settings = await ctx.db.aiAssistantSettings.findUnique({ where: { id: "default" } });

      const result = await extractDeadlinesFromText({
        documentName: input.documentName,
        documentText: input.documentText,
        matterName: matter.name,
        model: settings?.aiModel,
      });

      const actions = [];
      for (const deadline of result.deadlines) {
        const action = await ctx.db.aiAction.create({
          data: {
            type: "DEADLINE_EXTRACTION",
            status: "PENDING",
            title: deadline.title,
            description: `Date: ${deadline.date} | Priority: ${deadline.priority}\n${deadline.description}`,
            sourceType: "document",
            sourceId: input.documentName,
            matterId: input.matterId,
            generatedData: JSON.stringify(deadline),
          },
        });
        actions.push(action);
      }
      return { count: actions.length, actions };
    }),

  draftClientUpdate: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.findUniqueOrThrow({
        where: { id: input.matterId },
        include: {
          client: { select: { name: true } },
          activities: { orderBy: { createdAt: "desc" }, take: 10 },
        },
      });
      const settings = await ctx.db.aiAssistantSettings.findUnique({ where: { id: "default" } });

      const result = await draftClientUpdate({
        matterName: matter.name,
        clientName: matter.client.name,
        practiceArea: matter.practiceArea || undefined,
        recentActivities: matter.activities.map((a) => a.description),
        model: settings?.aiModel,
      });

      const action = await ctx.db.aiAction.create({
        data: {
          type: "CLIENT_UPDATE_DRAFT",
          status: "PENDING",
          title: result.subject,
          description: result.body,
          matterId: input.matterId,
          generatedData: JSON.stringify(result),
        },
      });
      return action;
    }),

  generateInvoice: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.findUniqueOrThrow({
        where: { id: input.matterId },
        include: {
          client: { select: { name: true } },
          timeEntries: {
            where: { invoiceLineItemId: null, billable: true },
            orderBy: { date: "desc" },
            take: 100,
          },
        },
      });

      if (matter.timeEntries.length === 0) {
        throw new Error("No unbilled time entries found for this matter");
      }

      const settings = await ctx.db.aiAssistantSettings.findUnique({ where: { id: "default" } });

      const result = await generateInvoiceFromTimeEntries({
        matterName: matter.name,
        clientName: matter.client.name,
        timeEntries: matter.timeEntries.map((e) => ({
          description: e.description,
          duration: e.duration,
          date: e.date.toISOString().split("T")[0],
          rate: e.rate ? Number(e.rate) : undefined,
        })),
        model: settings?.aiModel,
      });

      const action = await ctx.db.aiAction.create({
        data: {
          type: "TIME_TO_INVOICE",
          status: "PENDING",
          title: `Invoice Draft - ${matter.client.name}`,
          description: `${result.lineItems.length} line items, Total: $${result.total.toFixed(2)}`,
          matterId: input.matterId,
          generatedData: JSON.stringify(result),
        },
      });
      return action;
    }),

  summarizeMatter: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.findUniqueOrThrow({
        where: { id: input.matterId },
        include: {
          client: { select: { name: true } },
          activities: { orderBy: { createdAt: "desc" }, take: 20 },
          tasks: { where: { status: { not: "COMPLETED" } }, take: 20 },
          documents: { take: 20, select: { name: true } },
        },
      });
      const settings = await ctx.db.aiAssistantSettings.findUnique({ where: { id: "default" } });

      const result = await summarizeMatter({
        matterName: matter.name,
        clientName: matter.client.name,
        practiceArea: matter.practiceArea || undefined,
        description: matter.description || undefined,
        activities: matter.activities.map((a) => a.description),
        tasks: matter.tasks.map((t) => t.title),
        documents: matter.documents.map((d) => d.name),
        model: settings?.aiModel,
      });

      const action = await ctx.db.aiAction.create({
        data: {
          type: "MATTER_SUMMARY",
          status: "PENDING",
          title: `Summary - ${matter.name}`,
          description: result.summary,
          matterId: input.matterId,
          generatedData: JSON.stringify(result),
        },
      });
      return action;
    }),

  suggestTasks: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.findUniqueOrThrow({
        where: { id: input.matterId },
        include: {
          activities: { orderBy: { createdAt: "desc" }, take: 15 },
          tasks: { where: { status: { not: "COMPLETED" } }, take: 20 },
        },
      });
      const settings = await ctx.db.aiAssistantSettings.findUnique({ where: { id: "default" } });

      const result = await suggestTasksFromActivity({
        matterName: matter.name,
        practiceArea: matter.practiceArea || undefined,
        recentActivities: matter.activities.map((a) => a.description),
        existingTasks: matter.tasks.map((t) => t.title),
        model: settings?.aiModel,
      });

      const actions = [];
      for (const task of result.tasks) {
        const action = await ctx.db.aiAction.create({
          data: {
            type: "TASK_SUGGESTION",
            status: "PENDING",
            title: task.title,
            description: `Priority: ${task.priority} | Due in ${task.suggestedDueInDays} days\n${task.description}`,
            matterId: input.matterId,
            generatedData: JSON.stringify(task),
          },
        });
        actions.push(action);
      }
      return { count: actions.length, actions };
    }),

  // ── Dashboard Stats ───────────────────────────────────
  getStats: publicProcedure.query(async ({ ctx }) => {
    const [pending, approved, applied, recent] = await Promise.all([
      ctx.db.aiAction.count({ where: { status: "PENDING" } }),
      ctx.db.aiAction.count({ where: { status: "APPROVED" } }),
      ctx.db.aiAction.count({ where: { status: "APPLIED" } }),
      ctx.db.aiAction.count({
        where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      }),
    ]);
    return { pending, approved, applied, recentWeek: recent };
  }),
});
