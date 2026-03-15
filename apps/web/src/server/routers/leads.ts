import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { LeadStatus, LeadSource, LeadPriority } from "@prisma/client";

export const leadsRouter = router({
  list: publicProcedure
    .input(
      z.object({
        status: z.nativeEnum(LeadStatus).optional(),
        source: z.nativeEnum(LeadSource).optional(),
        priority: z.nativeEnum(LeadPriority).optional(),
        search: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { status, source, priority, search, startDate, endDate, limit = 50, offset = 0 } = input || {};

      const where: any = {};
      if (status) where.status = status;
      if (source) where.source = source;
      if (priority) where.priority = priority;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ];
      }
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [leads, total] = await Promise.all([
        ctx.db.lead.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
          include: {
            _count: { select: { activities: true } },
          },
        }),
        ctx.db.lead.count({ where }),
      ]);

      return { leads, total };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.findUnique({
        where: { id: input.id },
        include: {
          activities: { orderBy: { createdAt: "desc" } },
          chatSession: {
            include: {
              _count: { select: { messages: true } },
            },
          },
        },
      });
      if (!lead) throw new Error("Lead not found");
      return lead;
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().optional(),
        phone: z.string().optional(),
        source: z.nativeEnum(LeadSource).default("MANUAL"),
        priority: z.nativeEnum(LeadPriority).default("MEDIUM"),
        practiceArea: z.string().optional(),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.create({
        data: {
          name: input.name,
          email: input.email || null,
          phone: input.phone || null,
          source: input.source,
          priority: input.priority,
          practiceArea: input.practiceArea || null,
          description: input.description || null,
        },
      });

      await ctx.db.leadActivity.create({
        data: {
          leadId: lead.id,
          type: "CREATED",
          description: `Lead created manually`,
        },
      });

      // Auto-screen if enabled
      try {
        const settings = await ctx.db.intakeScreeningSettings.findUnique({ where: { id: "default" } });
        if (settings?.isEnabled && settings?.autoScreenNewLeads) {
          const { screeningRouter } = await import("./screening");
          const caller = screeningRouter.createCaller(ctx);
          await caller.screenLead({ leadId: lead.id });
        }
      } catch (err) {
        console.error("[Leads] Auto-screen failed:", err);
      }

      // Trigger follow-up sequences for NEW_LEAD
      try {
        const { screeningRouter } = await import("./screening");
        const caller = screeningRouter.createCaller(ctx);
        await caller.checkAndTrigger({ event: "NEW_LEAD", leadId: lead.id });
      } catch (err) {
        console.error("[Leads] Follow-up trigger failed:", err);
      }

      return lead;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        practiceArea: z.string().optional(),
        description: z.string().optional(),
        priority: z.nativeEnum(LeadPriority).optional(),
        assignedTo: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.lead.update({ where: { id }, data });
    }),

  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.nativeEnum(LeadStatus),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.update({
        where: { id: input.id },
        data: {
          status: input.status,
          lastContactedAt: ["CONTACTED", "QUALIFYING", "QUALIFIED", "PROPOSAL_SENT"].includes(input.status)
            ? new Date()
            : undefined,
        },
      });

      const oldStatus = (await ctx.db.lead.findUnique({ where: { id: input.id }, select: { status: true } }))?.status;

      await ctx.db.leadActivity.create({
        data: {
          leadId: input.id,
          type: "STATUS_CHANGED",
          description: `Status changed to ${input.status}`,
        },
      });

      // Trigger follow-up sequences for LEAD_QUALIFIED
      if (input.status === "QUALIFIED") {
        try {
          const { screeningRouter } = await import("./screening");
          const caller = screeningRouter.createCaller(ctx);
          const qual = await ctx.db.leadQualification.findUnique({ where: { leadId: input.id } });
          await caller.checkAndTrigger({ event: "LEAD_QUALIFIED", leadId: input.id, condition: qual ? { leadGrade: qual.grade } : undefined });
        } catch (err) {
          console.error("[Leads] Follow-up trigger failed:", err);
        }
      }

      // Fire campaign triggers for lead status change
      if (lead.email) {
        try {
          const { campaignsRouter } = await import("./campaigns");
          const caller = campaignsRouter.createCaller(ctx);
          await caller.checkTrigger({
            event: "LEAD_STATUS_CHANGE",
            conditionData: { fromStatus: oldStatus, toStatus: input.status },
            recipientEmail: lead.email,
            recipientName: lead.name,
          });
        } catch (err) {
          console.error("[Leads] Trigger check failed:", err);
        }
      }

      return lead;
    }),

  addNote: publicProcedure
    .input(
      z.object({
        id: z.string(),
        notes: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.update({
        where: { id: input.id },
        data: { notes: input.notes },
      });

      await ctx.db.leadActivity.create({
        data: {
          leadId: input.id,
          type: "NOTE_ADDED",
          description: input.notes.length > 100 ? input.notes.slice(0, 100) + "..." : input.notes,
        },
      });

      return lead;
    }),

  logActivity: publicProcedure
    .input(
      z.object({
        leadId: z.string(),
        type: z.enum(["EMAIL_SENT", "CALL_LOGGED", "CHAT_MESSAGE"]),
        description: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const activity = await ctx.db.leadActivity.create({
        data: {
          leadId: input.leadId,
          type: input.type,
          description: input.description,
        },
      });

      await ctx.db.lead.update({
        where: { id: input.leadId },
        data: { lastContactedAt: new Date() },
      });

      return activity;
    }),

  convertToClient: publicProcedure
    .input(
      z.object({
        id: z.string(),
        createMatter: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const lead = await ctx.db.lead.findUnique({ where: { id: input.id } });
      if (!lead) throw new Error("Lead not found");

      const client = await ctx.db.client.create({
        data: {
          name: lead.name,
          email: lead.email,
          phone: lead.phone,
          notes: lead.description,
        },
      });

      const updateData: any = {
        status: "CONVERTED" as const,
        clientId: client.id,
        convertedAt: new Date(),
      };

      if (input.createMatter) {
        const year = new Date().getFullYear();
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
        const matter = await ctx.db.matter.create({
          data: {
            clientId: client.id,
            name: `${lead.practiceArea || "New Matter"} - ${lead.name}`,
            matterNumber: `${year}-${random}`,
            practiceArea: lead.practiceArea,
            pipelineStage: "NEW",
          },
        });

        await ctx.db.matterActivity.create({
          data: {
            matterId: matter.id,
            type: "LEAD_CONVERTED",
            description: `Matter created from lead: ${lead.name}`,
          },
        });

        updateData.matterId = matter.id;
      }

      await ctx.db.lead.update({ where: { id: input.id }, data: updateData });

      await ctx.db.leadActivity.create({
        data: {
          leadId: input.id,
          type: "CONVERTED",
          description: `Converted to client: ${client.name}`,
        },
      });

      return client;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.lead.update({
        where: { id: input.id },
        data: { status: "ARCHIVED" },
      });
    }),

  getStats: publicProcedure.query(async ({ ctx }) => {
    const [byStatus, bySource] = await Promise.all([
      ctx.db.lead.groupBy({ by: ["status"], _count: true }),
      ctx.db.lead.groupBy({ by: ["source"], _count: true }),
    ]);
    return {
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      bySource: Object.fromEntries(bySource.map((s) => [s.source, s._count])),
    };
  }),

  getRecent: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(20).default(5) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.lead.findMany({
        orderBy: { createdAt: "desc" },
        take: input?.limit || 5,
      });
    }),
});
