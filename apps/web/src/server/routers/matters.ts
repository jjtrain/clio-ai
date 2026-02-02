import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { MatterStatus } from "@prisma/client";
import { generateMatterNumber } from "@/lib/utils";

const matterInput = z.object({
  clientId: z.string().min(1, "Client is required"),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  practiceArea: z.string().optional(),
});

export const mattersRouter = router({
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.nativeEnum(MatterStatus).optional(),
        clientId: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { search, status, clientId, limit = 50, cursor } = input || {};

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
          matterNumber,
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

      return matter;
    }),
});
