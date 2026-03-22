import { router, publicProcedure } from "../trpc";
import { z } from "zod";
import { db } from "@/lib/db";
import * as travelEngine from "@/lib/travel-engine";

export const travelCalendarRouter = router({
  getDayView: publicProcedure
    .input(z.object({ date: z.string(), userId: z.string().optional() }))
    .query(async ({ input }) => {
      const date = new Date(input.date);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);

      let events = await db.calendarEvent.findMany({
        where: { startTime: { gte: dayStart, lt: dayEnd } },
        orderBy: { startTime: "asc" },
      });

      // If no events, use sample data
      if (events.length === 0) {
        events = travelEngine.getSampleEvents(dayStart) as any;
      }

      const prefs = await db.userTravelPreference.findFirst({ where: { userId: input.userId || "default" } });
      const preferences = { defaultMode: prefs?.defaultMode || "driving", bufferMinutes: prefs?.bufferMinutes || 15, alertThreshold: prefs?.alertThreshold || 30 };
      const travelAnalysis = travelEngine.analyzeDaySchedule(events, preferences);
      const conflicts = travelEngine.detectConflicts(travelAnalysis);

      return { date: input.date, events, travelSegments: travelAnalysis, conflicts, conflictCount: conflicts.length };
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
        const prefs = { defaultMode: "driving", bufferMinutes: 15, alertThreshold: 30 };
        const travelSegments = travelEngine.analyzeDaySchedule(events, prefs);
        days.push({ date: dayStart.toISOString().split("T")[0], events, travelSegments, conflictCount: travelEngine.detectConflicts(travelSegments).length });
      }
      return { startDate: input.startDate, days };
    }),

  getMonthView: publicProcedure
    .input(z.object({ month: z.number(), year: z.number() }))
    .query(async ({ input }) => {
      const monthStart = new Date(input.year, input.month - 1, 1);
      const monthEnd = new Date(input.year, input.month, 0, 23, 59, 59);
      const events = await db.calendarEvent.findMany({ where: { startTime: { gte: monthStart, lte: monthEnd } }, orderBy: { startTime: "asc" } });
      const days: Record<string, { count: number; hasConflict: boolean }> = {};
      for (const evt of events) {
        const key = new Date(evt.startTime).toISOString().split("T")[0];
        if (!days[key]) days[key] = { count: 0, hasConflict: false };
        days[key].count++;
      }
      return { month: input.month, year: input.year, days };
    }),

  calculateTravel: publicProcedure
    .input(z.object({ fromEventId: z.string(), toEventId: z.string(), mode: z.string().optional() }))
    .query(async ({ input }) => {
      const fromEvent = await db.calendarEvent.findUnique({ where: { id: input.fromEventId } });
      const toEvent = await db.calendarEvent.findUnique({ where: { id: input.toEventId } });
      if (!fromEvent || !toEvent) return null;
      const fromCoords = travelEngine.geocodeAddress(fromEvent.location || fromEvent.address || "");
      const toCoords = travelEngine.geocodeAddress(toEvent.location || toEvent.address || "");
      if (!fromCoords || !toCoords) return { durationMinutes: 0, distanceMeters: 0, summary: "Locations unknown" };
      const travel = travelEngine.calculateTravelTime(fromCoords, toCoords, input.mode || "driving");
      return { ...travel, summary: `${travel.durationMinutes} min ${input.mode || "driving"}` };
    }),

  getTravelPreference: publicProcedure
    .input(z.object({ userId: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const pref = await db.userTravelPreference.findFirst({ where: { userId: input?.userId || "default" } });
      return pref || { defaultMode: "driving", bufferMinutes: 15, alertThreshold: 30, homeAddress: null, officeAddress: null };
    }),

  updateTravelPreference: publicProcedure
    .input(z.object({ userId: z.string(), defaultMode: z.string().optional(), bufferMinutes: z.number().optional(), homeAddress: z.string().optional(), officeAddress: z.string().optional(), alertThreshold: z.number().optional() }))
    .mutation(async ({ input }) => {
      const { userId, ...data } = input;
      return db.userTravelPreference.upsert({ where: { userId }, create: { userId, ...data } as any, update: data as any });
    }),

  getConflicts: publicProcedure
    .input(z.object({ startDate: z.string(), endDate: z.string(), userId: z.string().optional() }))
    .query(async ({ input }) => {
      const events = await db.calendarEvent.findMany({ where: { startTime: { gte: new Date(input.startDate), lte: new Date(input.endDate) } }, orderBy: { startTime: "asc" } });
      const prefs = { defaultMode: "driving", bufferMinutes: 15, alertThreshold: 30 };
      return travelEngine.detectConflicts(travelEngine.analyzeDaySchedule(events, prefs));
    }),

  addEvent: publicProcedure
    .input(z.object({ title: z.string(), startTime: z.string(), endTime: z.string(), location: z.string().optional(), eventType: z.string().optional(), matterId: z.string().optional(), courtId: z.string().optional(), userId: z.string().optional() }))
    .mutation(async ({ input }) => {
      const coords = input.location ? travelEngine.geocodeAddress(input.location) : null;
      return db.calendarEvent.create({ data: { title: input.title, startTime: new Date(input.startTime), endTime: new Date(input.endTime), location: input.location, eventType: input.eventType || "appointment", matterId: input.matterId, courtId: input.courtId, latitude: coords?.lat, longitude: coords?.lng, userId: input.userId } as any });
    }),

  updateEvent: publicProcedure
    .input(z.object({ eventId: z.string(), data: z.record(z.any()) }))
    .mutation(async ({ input }) => {
      if (input.data.location) { const c = travelEngine.geocodeAddress(input.data.location); if (c) { input.data.latitude = c.lat; input.data.longitude = c.lng; } }
      if (input.data.startTime) input.data.startTime = new Date(input.data.startTime);
      if (input.data.endTime) input.data.endTime = new Date(input.data.endTime);
      return db.calendarEvent.update({ where: { id: input.eventId }, data: input.data as any });
    }),

  deleteEvent: publicProcedure
    .input(z.object({ eventId: z.string() }))
    .mutation(async ({ input }) => {
      return db.calendarEvent.delete({ where: { id: input.eventId } });
    }),
});
