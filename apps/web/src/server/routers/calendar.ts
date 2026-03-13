import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import {
  refreshTokenIfNeeded,
  createGoogleEvent,
  updateGoogleEvent,
  deleteGoogleEvent,
} from "@/lib/google-calendar";

const calendarEventInput = z.object({
  matterId: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  startTime: z.string().or(z.date()),
  endTime: z.string().or(z.date()),
  allDay: z.boolean().default(false),
  location: z.string().optional(),
});

async function syncToGoogle(
  db: any,
  action: "create" | "update" | "delete",
  event: { id: string; title: string; description?: string | null; startTime: Date; endTime: Date; allDay: boolean; location?: string | null; googleEventId?: string | null }
) {
  try {
    const sync = await db.googleCalendarSync.findUnique({ where: { id: "default" } });
    if (!sync?.isEnabled || !sync.accessToken || !sync.googleCalendarId) return;
    if (sync.syncDirection === "from_google") return;

    const accessToken = await refreshTokenIfNeeded(sync);

    // Update stored token if refreshed
    if (accessToken !== sync.accessToken) {
      await db.googleCalendarSync.update({
        where: { id: "default" },
        data: {
          accessToken,
          tokenExpiry: new Date(Date.now() + 3600 * 1000),
        },
      });
    }

    const calendarId = sync.googleCalendarId;

    if (action === "create") {
      const googleEventId = await createGoogleEvent(accessToken, calendarId, {
        summary: event.title,
        description: event.description || undefined,
        startTime: event.startTime,
        endTime: event.endTime,
        allDay: event.allDay,
        location: event.location || undefined,
      });
      await db.calendarEvent.update({
        where: { id: event.id },
        data: { googleEventId },
      });
    } else if (action === "update" && event.googleEventId) {
      await updateGoogleEvent(accessToken, calendarId, event.googleEventId, {
        summary: event.title,
        description: event.description || undefined,
        startTime: event.startTime,
        endTime: event.endTime,
        allDay: event.allDay,
        location: event.location || undefined,
      });
    } else if (action === "delete" && event.googleEventId) {
      await deleteGoogleEvent(accessToken, calendarId, event.googleEventId);
    }
  } catch (err) {
    console.error("[Google Sync] Error:", err);
    // Don't throw - Google sync failures shouldn't break local operations
  }
}

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

      // Sync to Google Calendar
      await syncToGoogle(ctx.db, "create", event);

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

      // Sync to Google Calendar
      await syncToGoogle(ctx.db, "update", event);

      return event;
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Get the event first to check for Google event ID
      const event = await ctx.db.calendarEvent.findUnique({
        where: { id: input.id },
      });

      if (event) {
        await syncToGoogle(ctx.db, "delete", event);
      }

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

  // Google Calendar sync settings
  getGoogleSyncStatus: publicProcedure.query(async ({ ctx }) => {
    const sync = await ctx.db.googleCalendarSync.findUnique({
      where: { id: "default" },
    });
    return {
      isConnected: !!sync?.accessToken,
      isEnabled: sync?.isEnabled ?? false,
      syncDirection: sync?.syncDirection ?? "both",
      lastSyncAt: sync?.lastSyncAt ?? null,
      googleCalendarId: sync?.googleCalendarId ?? "primary",
    };
  }),

  updateGoogleSync: publicProcedure
    .input(
      z.object({
        isEnabled: z.boolean().optional(),
        syncDirection: z.enum(["to_google", "from_google", "both"]).optional(),
        googleCalendarId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.googleCalendarSync.upsert({
        where: { id: "default" },
        update: input,
        create: { id: "default", ...input },
      });
    }),

  disconnectGoogle: publicProcedure.mutation(async ({ ctx }) => {
    await ctx.db.googleCalendarSync.upsert({
      where: { id: "default" },
      update: {
        isEnabled: false,
        accessToken: null,
        refreshToken: null,
        tokenExpiry: null,
      },
      create: {
        id: "default",
        isEnabled: false,
      },
    });
    return { success: true };
  }),
});
