import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { ensureDefaultUser } from "./users";

const timeEntryInput = z.object({
  matterId: z.string().min(1, "Matter is required"),
  userId: z.string().min(1, "User is required"),
  description: z.string().min(1, "Description is required"),
  duration: z.number().min(1, "Duration must be at least 1 minute"),
  date: z.string().or(z.date()),
  billable: z.boolean().default(true),
  rate: z.number().optional(),
});

export const timeEntriesRouter = router({
  list: publicProcedure
    .input(
      z.object({
        matterId: z.string().optional(),
        userId: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { matterId, userId, startDate, endDate, limit = 50, cursor } = input || {};

      const timeEntries = await ctx.db.timeEntry.findMany({
        where: {
          AND: [
            matterId ? { matterId } : {},
            userId ? { userId } : {},
            startDate ? { date: { gte: new Date(startDate) } } : {},
            endDate ? { date: { lte: new Date(endDate) } } : {},
          ],
        },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { date: "desc" },
        include: {
          matter: {
            select: {
              id: true,
              name: true,
              matterNumber: true,
              client: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      let nextCursor: string | undefined = undefined;
      if (timeEntries.length > limit) {
        const nextItem = timeEntries.pop();
        nextCursor = nextItem!.id;
      }

      return { timeEntries, nextCursor };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const timeEntry = await ctx.db.timeEntry.findUnique({
        where: { id: input.id },
        include: {
          matter: {
            include: {
              client: true,
            },
          },
          user: true,
        },
      });

      if (!timeEntry) {
        throw new Error("Time entry not found");
      }

      return timeEntry;
    }),

  create: publicProcedure
    .input(timeEntryInput)
    .mutation(async ({ ctx, input }) => {
      // Resolve userId: verify it exists, otherwise fall back to default user
      let userId = input.userId;
      const userExists = await ctx.db.user.findUnique({ where: { id: userId } });
      if (!userExists) {
        const defaultUser = await ensureDefaultUser(ctx.db);
        userId = defaultUser.id;
      }

      const timeEntry = await ctx.db.timeEntry.create({
        data: {
          matterId: input.matterId,
          userId,
          description: input.description,
          duration: input.duration,
          date: new Date(input.date),
          billable: input.billable,
          rate: input.rate,
        },
      });

      return timeEntry;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: timeEntryInput.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const timeEntry = await ctx.db.timeEntry.update({
        where: { id: input.id },
        data: {
          ...input.data,
          date: input.data.date ? new Date(input.data.date) : undefined,
        },
      });

      return timeEntry;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.timeEntry.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  summary: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { startDate, endDate } = input || {};
      
      const where = {
        AND: [
          startDate ? { date: { gte: new Date(startDate) } } : {},
          endDate ? { date: { lte: new Date(endDate) } } : {},
        ],
      };

      const [totalMinutes, billableMinutes, entryCount] = await Promise.all([
        ctx.db.timeEntry.aggregate({
          where,
          _sum: { duration: true },
        }),
        ctx.db.timeEntry.aggregate({
          where: { ...where, billable: true },
          _sum: { duration: true },
        }),
        ctx.db.timeEntry.count({ where }),
      ]);

      return {
        totalMinutes: totalMinutes._sum.duration || 0,
        billableMinutes: billableMinutes._sum.duration || 0,
        entryCount,
      };
    }),
});
