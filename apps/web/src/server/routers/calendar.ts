import { z } from "zod";
import { router, publicProcedure } from "../trpc";

const calendarEventInput = z.object({
  matterId: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startTime: z.string().or(z.date()),
  endTime: z.string().or(z.date()),
  allDay: z.boolean().default(false),
  location: z.string().optional(),
});

export const calendarRouter = router({
  list: publicProcedure
    .input(
      z.object({
        matterId: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const { matterId, startDate, endDate, limit = 50, cursor } = input || {};

      const events = await ctx.db.calendarEvent.findMany({
        where: {
          AND: [
            matterId ? { matterId } : {},
            startDate ? { startTime: { gte: new Date(startDate) } } : {},
            endDate ? { endTime: { lte: new Date(endDate) } } : {},
          ],
        },
        take: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: { startTime: "asc" },
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
        },
      });

      let nextCursor: string | undefined = undefined;
      if (events.length > limit) {
        const nextItem = events.pop();
        nextCursor = nextItem!.id;
      }

      return { events, nextCursor };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.calendarEvent.findUnique({
        where: { id: input.id },
        include: {
          matter: {
            include: {
              client: true,
            },
          },
        },
      });

      if (!event) {
        throw new Error("Event not found");
      }

      return event;
    }),

  create: publicProcedure
    .input(calendarEventInput)
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.calendarEvent.create({
        data: {
          matterId: input.matterId || null,
          title: input.title,
          description: input.description || null,
          startTime: new Date(input.startTime),
          endTime: new Date(input.endTime),
          allDay: input.allDay,
          location: input.location || null,
        },
      });

      return event;
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        data: calendarEventInput.partial(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.db.calendarEvent.update({
        where: { id: input.id },
        data: {
          ...input.data,
          startTime: input.data.startTime ? new Date(input.data.startTime) : undefined,
          endTime: input.data.endTime ? new Date(input.data.endTime) : undefined,
        },
      });

      return event;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.calendarEvent.delete({
        where: { id: input.id },
      });

      return { success: true };
    }),

  upcoming: publicProcedure
    .input(z.object({ limit: z.number().default(5) }).optional())
    .query(async ({ ctx, input }) => {
      const { limit = 5 } = input || {};

      const events = await ctx.db.calendarEvent.findMany({
        where: {
          startTime: { gte: new Date() },
        },
        take: limit,
        orderBy: { startTime: "asc" },
        include: {
          matter: {
            select: {
              id: true,
              name: true,
              matterNumber: true,
            },
          },
        },
      });

      return events;
    }),
});
