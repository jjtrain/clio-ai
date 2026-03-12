import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { MatterStatus, PipelineStage, MatterActivityType } from "@prisma/client";
import { generateMatterNumber } from "@/lib/utils";

const matterInput = z.object({
  clientId: z.string().min(1, "Client is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  practiceArea: z.string().optional(),
  pipelineStage: z.nativeEnum(PipelineStage).default("NEW"),
});

export const mattersRouter = router({
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.nativeEnum(MatterStatus).optional(),
        pipelineStage: z.nativeEnum(PipelineStage).optional(),
        clientId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { search, status, pipelineStage, clientId, limit = 50, cursor } = input || {};

      const matters = await ctx.db.matter.findMany({
        where: {
          AND: [
            search
              ? {
                  OR: [
                    { name: { contains: search, mode: "insensitive" } },
                    { matterNumber: { contains: search, mode: "insensitive" } },
                  ],
                }
              : {},
            status ? { status } : {},
            pipelineStage ? { pipelineStage } : {},
            clientId ? { clientId } : {},
          ],
        },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          client: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              timeEntries: true,
              documents: true,
            },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (matters.length > limit) {
        const nextItem = matters.pop();
        nextCursor = nextItem!.id;
      }

      return { matters, nextCursor };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.findUnique({
        where: { id: input.id },
        include: {
          client: true,
          timeEntries: {
            orderBy: { date: "desc" },
            take: 10,
          },
          documents: {
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });

      if (!matter) {
        throw new Error("Matter not found");
      }

      return matter;
    }),

  create: publicProcedure
    .input(matterInput)
    .mutation(async ({ ctx, input }) => {
      // Generate unique matter number
      let matterNumber = generateMatterNumber();
      let attempts = 0;

      while (attempts < 10) {
        const existing = await ctx.db.matter.findUnique({
          where: { matterNumber },
        });

        if (!existing) break;

        matterNumber = generateMatterNumber();
        attempts++;
      }

      const matter = await ctx.db.matter.create({
        data: {
          clientId: input.clientId,
          name: input.name,
          description: input.description || null,
          practiceArea: input.practiceArea || null,
          pipelineStage: input.pipelineStage,
          matterNumber,
        },
      });

      await ctx.db.matterActivity.create({
        data: {
          matterId: matter.id,
          type: "CREATED",
          description: `Matter "${matter.name}" created`,
        },
      });

      return matter;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: matterInput.omit({ clientId: true }).partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.update({
        where: { id: input.id },
        data: input.data,
      });

      return matter;
    }),

  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.nativeEnum(MatterStatus),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.update({
        where: { id: input.id },
        data: {
          status: input.status,
          closeDate: input.status === "CLOSED" ? new Date() : null,
        },
      });

      await ctx.db.matterActivity.create({
        data: {
          matterId: input.id,
          type: "STATUS_CHANGED",
          description: `Status changed to ${input.status}`,
        },
      });

      return matter;
    }),

  close: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.update({
        where: { id: input.id },
        data: {
          status: "CLOSED",
          closeDate: new Date(),
        },
      });

      await ctx.db.matterActivity.create({
        data: {
          matterId: input.id,
          type: "STATUS_CHANGED",
          description: "Matter closed",
        },
      });

      return matter;
    }),

  reopen: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.update({
        where: { id: input.id },
        data: {
          status: "OPEN",
          closeDate: null,
        },
      });

      await ctx.db.matterActivity.create({
        data: {
          matterId: input.id,
          type: "STATUS_CHANGED",
          description: "Matter reopened",
        },
      });

      return matter;
    }),

  // ========== Pipeline Procedures ==========

  updatePipelineStage: publicProcedure
    .input(
      z.object({
        id: z.string(),
        stage: z.nativeEnum(PipelineStage),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const current = await ctx.db.matter.findUnique({ where: { id: input.id } });
      if (!current) throw new Error("Matter not found");

      const statusForStage = ["RETAINED", "ACTIVE"].includes(input.stage) ? "OPEN" : current.status;

      const matter = await ctx.db.matter.update({
        where: { id: input.id },
        data: {
          pipelineStage: input.stage,
          status: statusForStage,
        },
      });

      await ctx.db.matterActivity.create({
        data: {
          matterId: input.id,
          type: "STAGE_CHANGED",
          description: `Pipeline stage changed from ${current.pipelineStage} to ${input.stage}`,
          metadata: JSON.stringify({ from: current.pipelineStage, to: input.stage }),
        },
      });

      return matter;
    }),

  getByPipelineStage: publicProcedure
    .input(z.object({ search: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {
        status: { not: "CLOSED" },
      };

      if (input?.search) {
        where.OR = [
          { name: { contains: input.search, mode: "insensitive" } },
          { matterNumber: { contains: input.search, mode: "insensitive" } },
          { client: { name: { contains: input.search, mode: "insensitive" } } },
        ];
      }

      const matters = await ctx.db.matter.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        include: {
          client: { select: { id: true, name: true } },
          _count: { select: { timeEntries: true, documents: true } },
        },
      });

      const grouped: Record<string, typeof matters> = {
        NEW: [],
        CONSULTATION: [],
        CONFLICT_CHECK: [],
        RETAINER_SENT: [],
        RETAINED: [],
        ACTIVE: [],
      };

      for (const matter of matters) {
        if (grouped[matter.pipelineStage]) {
          grouped[matter.pipelineStage].push(matter);
        }
      }

      return grouped;
    }),

  getPipelineStats: publicProcedure.query(async ({ ctx }) => {
    const counts = await ctx.db.matter.groupBy({
      by: ["pipelineStage"],
      where: { status: { not: "CLOSED" } },
      _count: true,
    });
    return Object.fromEntries(counts.map((c) => [c.pipelineStage, c._count]));
  }),

  getActivities: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.matterActivity.findMany({
        where: { matterId: input.matterId },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  logActivity: publicProcedure
    .input(
      z.object({
        matterId: z.string(),
        type: z.nativeEnum(MatterActivityType),
        description: z.string(),
        metadata: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.matterActivity.create({
        data: {
          matterId: input.matterId,
          type: input.type,
          description: input.description,
          metadata: input.metadata,
        },
      });
    }),

  convertLeadToMatter: publicProcedure
    .input(
      z.object({
        leadId: z.string(),
        clientId: z.string(),
        name: z.string(),
        practiceArea: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let matterNumber = generateMatterNumber();
      let attempts = 0;
      while (attempts < 10) {
        const existing = await ctx.db.matter.findUnique({ where: { matterNumber } });
        if (!existing) break;
        matterNumber = generateMatterNumber();
        attempts++;
      }

      const matter = await ctx.db.matter.create({
        data: {
          clientId: input.clientId,
          name: input.name,
          matterNumber,
          practiceArea: input.practiceArea || null,
          pipelineStage: "NEW",
        },
      });

      await ctx.db.matterActivity.create({
        data: {
          matterId: matter.id,
          type: "LEAD_CONVERTED",
          description: `Matter created from lead`,
        },
      });

      await ctx.db.lead.update({
        where: { id: input.leadId },
        data: { matterId: matter.id, status: "CONVERTED", convertedAt: new Date() },
      });

      return matter;
    }),
});
