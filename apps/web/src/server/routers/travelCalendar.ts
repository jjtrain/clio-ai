import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as travelEngine from "@/lib/travel-engine";

export const travelCalendarRouter = router({
  getDayView: publicProcedure
    .input(z.object({ date: z.string(), userId: z.string().optional(), firmId: z.string().optional() }))
    .query(async ({ input }) => {
      const date = new Date(input.date);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);

      // Attempt sync from matters/courts/SOL
      if (input.userId && input.firmId) {
        try { await travelEngine.fullCalendarSync(input.userId, input.firmId, dayStart, dayEnd); } catch {}
      }

      let events = await db.calendarEvent.findMany({
        where: { startTime: { gte: dayStart, lt: dayEnd } },
        orderBy: { startTime: "asc" },
      });

      if (events.length === 0) {
        events = travelEngine.getSampleEvents(dayStart) as any;
      }

      const prefs = await db.userTravelPreference.findFirst({ where: { userId: input.userId || "default" } }) as any;
      const preferences = {
        defaultMode: prefs?.defaultMode || "driving",
        bufferMinutes: prefs?.bufferMinutes || 15,
        alertThreshold: prefs?.alertThreshold || 30,
        geofenceBuffer: prefs?.geofenceBuffer || 10,
      };
      const travelAnalysis = travelEngine.analyzeDaySchedule(events, preferences);
      const conflicts = travelEngine.detectConflicts(travelAnalysis);

      // Separate SOL/deadline banners from timeline events
      const allDayEvents = (events as any[]).filter((e: any) => e.isAllDay || e.eventType === "statute_tracker");
      const timelineEvents = (events as any[]).filter((e: any) => !e.isAllDay && e.eventType !== "statute_tracker");
      const deadlineEvents = (events as any[]).filter((e: any) => ["matter_deadline", "court_filing"].includes(e.eventType));

      return {
        date: input.date, events, timelineEvents, allDayEvents, deadlineEvents,
        travelSegments: travelAnalysis, conflicts, conflictCount: conflicts.length,
      };
    }),

  getWeekView: publicProcedure
    .input(z.object({ startDate: z.string(), userId: z.string().optional() }))
    .query(async ({ input }) => {
      const start = new Date(input.startDate);
      const days = [];
      for (let i = 0; i < 7; i++) {
        const day = new Date(start.getTime() + i * 86400000);
        const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
        const dayEnd = new Date(dayStart.getTime() + 86400000);
        const events = await db.calendarEvent.findMany({ where: { startTime: { gte: dayStart, lt: dayEnd } }, orderBy: { startTime: "asc" } });
        const prefs = { defaultMode: "driving", bufferMinutes: 15, alertThreshold: 30, geofenceBuffer: 10 };
        const travelSegments = travelEngine.analyzeDaySchedule(events, prefs);
        const hasDeadlines = events.some((e: any) => ["matter_deadline", "court_filing", "statute_tracker"].includes(e.eventType));
        days.push({
          date: dayStart.toISOString().split("T")[0], events, travelSegments,
          conflictCount: travelEngine.detectConflicts(travelSegments).length,
          eventCount: events.length, hasDeadlines,
        });
      }
      return { startDate: input.startDate, days };
    }),

  getMonthView: publicProcedure
    .input(z.object({ month: z.number(), year: z.number() }))
    .query(async ({ input }) => {
      const monthStart = new Date(input.year, input.month - 1, 1);
      const monthEnd = new Date(input.year, input.month, 0, 23, 59, 59);
      const events = await db.calendarEvent.findMany({ where: { startTime: { gte: monthStart, lte: monthEnd } }, orderBy: { startTime: "asc" } });
      const days: Record<string, { count: number; hasConflict: boolean; hasDeadline: boolean; types: string[] }> = {};
      for (const evt of events) {
        const key = new Date(evt.startTime).toISOString().split("T")[0];
        if (!days[key]) days[key] = { count: 0, hasConflict: false, hasDeadline: false, types: [] };
        days[key].count++;
        const et = (evt as any).eventType || "appointment";
        if (!days[key].types.includes(et)) days[key].types.push(et);
        if (["matter_deadline", "court_filing", "statute_tracker"].includes(et)) days[key].hasDeadline = true;
      }
      return { month: input.month, year: input.year, days };
    }),

  calculateTravel: publicProcedure
    .input(z.object({ fromEventId: z.string(), toEventId: z.string(), mode: z.string().optional() }))
    .query(async ({ input }) => {
      const fromEvent = await db.calendarEvent.findUnique({ where: { id: input.fromEventId } });
      const toEvent = await db.calendarEvent.findUnique({ where: { id: input.toEventId } });
      if (!fromEvent || !toEvent) return null;
      const fromCoords = travelEngine.geocodeAddress(fromEvent.location || (fromEvent as any).address || "");
      const toCoords = travelEngine.geocodeAddress(toEvent.location || (toEvent as any).address || "");
      if (!fromCoords || !toCoords) return { durationMinutes: 0, distanceMeters: 0, summary: "Locations unknown" };
      const travel = travelEngine.calculateTravelTime(fromCoords, toCoords, input.mode || "driving");
      const geofence = travelEngine.getGeofenceForEvent(toEvent);
      return { ...travel, summary: `${travel.durationMinutes} min ${input.mode || "driving"}`, hasGeofence: !!geofence, geofenceInfo: geofence };
    }),

  getConflicts: publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string(), userId: z.string().optional() }))
    .query(async ({ input }) => {
      const events = await db.calendarEvent.findMany({ where: { startTime: { gte: new Date(input.startDate), lte: new Date(input.endDate) } }, orderBy: { startTime: "asc" } });
      const prefs = { defaultMode: "driving", bufferMinutes: 15, alertThreshold: 30, geofenceBuffer: 10 };
      return travelEngine.detectConflicts(travelEngine.analyzeDaySchedule(events, prefs));
    }),

  addEvent: publicProcedure
    .input(z.object({
      title: z.string(), startTime: z.string(), endTime: z.string(),
      location: z.string().optional(), eventType: z.string().optional(),
      matterId: z.string().optional(), courtId: z.string().optional(),
      userId: z.string().optional(), firmId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const coords = input.location ? travelEngine.geocodeAddress(input.location) : null;
      const geofence = input.location ? travelEngine.getGeofenceForEvent({ location: input.location, eventType: input.eventType, courtId: input.courtId }) : null;
      return db.calendarEvent.create({
        data: {
          title: input.title, startTime: new Date(input.startTime), endTime: new Date(input.endTime),
          location: input.location, eventType: input.eventType || "appointment",
          matterId: input.matterId, courtId: input.courtId,
          latitude: coords?.lat, longitude: coords?.lng,
          geofenceId: geofence?.geofenceId, checkinStatus: geofence ? "pending" : null,
          userId: input.userId, firmId: input.firmId,
        } as any,
      });
    }),

  updateEvent: publicProcedure
    .input(z.object({ eventId: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      if (input.data.location) {
        const c = travelEngine.geocodeAddress(input.data.location);
        if (c) { input.data.latitude = c.lat; input.data.longitude = c.lng; }
        const geo = travelEngine.getGeofenceForEvent({ location: input.data.location, eventType: input.data.eventType });
        if (geo) { input.data.geofenceId = geo.geofenceId; input.data.checkinStatus = "pending"; }
      }
      if (input.data.startTime) input.data.startTime = new Date(input.data.startTime);
      if (input.data.endTime) input.data.endTime = new Date(input.data.endTime);
      return db.calendarEvent.update({ where: { id: input.eventId }, data: input.data as any });
    }),

  deleteEvent: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ input }) => {
      return db.calendarEvent.delete({ where: { id: input.eventId } });
    }),

  getTravelPreference: publicProcedure
    .input(z.object({ userId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const pref = await db.userTravelPreference.findFirst({ where: { userId: input?.userId || "default" } });
      return pref || { defaultMode: "driving", bufferMinutes: 15, alertThreshold: 30, geofenceBuffer: 10, autoSyncMatters: true, autoSyncCourt: true, homeAddress: null, officeAddress: null };
    }),

  updateTravelPreference: publicProcedure
    .input(z.object({
      userId: z.string(), defaultMode: z.string().optional(), bufferMinutes: z.number().optional(),
      homeAddress: z.string().optional(), officeAddress: z.string().optional(),
      alertThreshold: z.number().optional(), geofenceBuffer: z.number().optional(),
      autoSyncMatters: z.boolean().optional(), autoSyncCourt: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { userId, ...data } = input;
      if (data.homeAddress) { const c = travelEngine.geocodeAddress(data.homeAddress); if (c) { (data as any).homeLatitude = c.lat; (data as any).homeLongitude = c.lng; } }
      if (data.officeAddress) { const c = travelEngine.geocodeAddress(data.officeAddress); if (c) { (data as any).officeLatitude = c.lat; (data as any).officeLongitude = c.lng; } }
      return db.userTravelPreference.upsert({ where: { userId }, create: { userId, ...data } as any, update: data as any });
    }),

  syncFromMatters: publicProcedure
    .input(z.object({ userId: z.string(), firmId: z.string(), startDate: z.string().optional(), endDate: z.string().optional() }))
    .mutation(async ({ input }) => {
      const start = input.startDate ? new Date(input.startDate) : new Date();
      const end = input.endDate ? new Date(input.endDate) : new Date(start.getTime() + 30 * 86400000);
      await travelEngine.fullCalendarSync(input.userId, input.firmId, start, end);
      return { synced: true, syncedAt: new Date() };
    }),

  getGeofenceStatus: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .query(async ({ input }) => {
      const event = await db.calendarEvent.findUnique({ where: { id: input.eventId } });
      if (!event) return null;
      const geofence = travelEngine.getGeofenceForEvent(event);
      return {
        eventId: input.eventId,
        checkinStatus: (event as any).checkinStatus || "pending",
        geofenceInfo: geofence,
        syncStatus: travelEngine.syncGeofenceStatus(input.eventId),
      };
    }),

  getMatterEvents: publicProcedure
    .input(z.object({ matterId: z.string() }))
    .query(async ({ input }) => {
      return db.calendarEvent.findMany({
        where: { matterId: input.matterId },
        orderBy: { startTime: "asc" },
      });
    }),

  getUpcomingDeadlines: publicProcedure
    .input(z.object({ days: z.number().default(7) }))
    .query(async ({ input }) => {
      const now = new Date();
      const end = new Date(now.getTime() + input.days * 86400000);
      return db.calendarEvent.findMany({
        where: {
          startTime: { gte: now, lte: end },
          eventType: { in: ["matter_deadline", "court_filing", "statute_tracker"] },
        },
        orderBy: { startTime: "asc" },
      });
    }),
});
