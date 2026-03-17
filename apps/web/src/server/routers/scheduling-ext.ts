import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getUnifiedCalendar, syncBookingToBuiltIn, getBookingAnalytics } from "@/lib/scheduling-engine";
import { apptotoTestConnection, apptotoGetAppointments, apptotoGetReminderProfiles, attornifyTestConnection, attornifyGetEventTypes, attornifyGetBookings, lawtapTestConnection, lawtapGetServices, calendlyTestConnection, calendlyGetEventTypes, calendlyGetScheduledEvents } from "@/lib/integrations/scheduling-providers";

const SCHED_PROVIDERS = ["APPTOTO", "ATTORNIFY", "LAWTAP", "CALENDLY"] as const;
function maskKey(k: string | null) { return k ? "****" + k.slice(-4) : null; }

export const schedulingExtRouter = router({
  // ─── Settings ──────────────────────────────────────────────────
  "settings.list": publicProcedure.query(async ({ ctx }) => {
    const all = await ctx.db.schedulingIntegration.findMany({ orderBy: { provider: "asc" } });
    return all.map((i) => ({ ...i, apiKey: maskKey(i.apiKey), apiSecret: maskKey(i.apiSecret), accessToken: i.accessToken ? "***" : null }));
  }),
  "settings.update": publicProcedure
    .input(z.object({ provider: z.enum(SCHED_PROVIDERS), displayName: z.string().optional(), apiKey: z.string().optional().nullable(), apiSecret: z.string().optional().nullable(), baseUrl: z.string().optional().nullable(), accountId: z.string().optional().nullable(), organizationId: z.string().optional().nullable(), userId: z.string().optional().nullable(), isEnabled: z.boolean().optional(), syncWithBuiltIn: z.boolean().optional(), autoCreateLead: z.boolean().optional(), settings: z.string().optional().nullable() }))
    .mutation(async ({ ctx, input }) => {
      const { provider, ...data } = input;
      const clean: any = { ...data };
      if (clean.apiKey?.startsWith("****")) delete clean.apiKey;
      return ctx.db.schedulingIntegration.upsert({ where: { provider }, create: { provider, displayName: input.displayName || provider, ...clean }, update: clean });
    }),
  "settings.test": publicProcedure
    .input(z.object({ provider: z.enum(SCHED_PROVIDERS) }))
    .mutation(async ({ input }) => {
      const tests: Record<string, () => Promise<any>> = { APPTOTO: apptotoTestConnection, ATTORNIFY: attornifyTestConnection, LAWTAP: lawtapTestConnection, CALENDLY: calendlyTestConnection };
      return (tests[input.provider] || (() => ({ success: false, error: "Unknown" })))();
    }),

  // ─── Event Types ───────────────────────────────────────────────
  "eventTypes.list": publicProcedure.query(async ({ ctx }) => ctx.db.externalEventType.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })),
  "eventTypes.sync": publicProcedure
    .input(z.object({ provider: z.enum(SCHED_PROVIDERS) }))
    .mutation(async ({ ctx, input }) => {
      let types: any[] = [];
      if (input.provider === "ATTORNIFY") { const r = await attornifyGetEventTypes(); if (r.success) types = (r as any).data?.event_types || (r as any).data || []; }
      if (input.provider === "LAWTAP") { const r = await lawtapGetServices(); if (r.success) types = (r as any).data?.services || (r as any).data || []; }
      if (input.provider === "CALENDLY") { const r = await calendlyGetEventTypes(); if (r.success) types = (r as any).data?.collection || (r as any).data || []; }

      let synced = 0;
      for (const t of (Array.isArray(types) ? types : [])) {
        const extId = t.id || t.uri || t.service_id || String(Math.random());
        await ctx.db.externalEventType.upsert({
          where: { provider_externalTypeId: { provider: input.provider, externalTypeId: extId } },
          create: { provider: input.provider, externalTypeId: extId, name: t.name || t.title || "Appointment", duration: t.duration || 30, locationType: t.location_type || "IN_PERSON", bookingUrl: t.scheduling_url || t.booking_url, price: t.price },
          update: { name: t.name || t.title, duration: t.duration || 30, bookingUrl: t.scheduling_url || t.booking_url },
        });
        synced++;
      }
      return { synced, total: types.length };
    }),

  // ─── Bookings ──────────────────────────────────────────────────
  "bookings.list": publicProcedure
    .input(z.object({ from: z.string().optional(), to: z.string().optional(), provider: z.string().optional(), status: z.string().optional(), limit: z.number().default(50) }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.provider) where.provider = input.provider;
      if (input?.status) where.status = input.status;
      if (input?.from || input?.to) { where.startTime = {}; if (input?.from) where.startTime.gte = new Date(input.from); if (input?.to) where.startTime.lte = new Date(input.to); }
      return ctx.db.externalBooking.findMany({ where, orderBy: { startTime: "desc" }, take: input?.limit || 50 });
    }),
  "bookings.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.externalBooking.findUniqueOrThrow({ where: { id: input.id } })),
  "bookings.cancel": publicProcedure
    .input(z.object({ id: z.string(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.externalBooking.update({ where: { id: input.id }, data: { status: "CANCELLED", cancellationReason: input.reason, cancelledAt: new Date() } })),
  "bookings.markNoShow": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.externalBooking.update({ where: { id: input.id }, data: { status: "NO_SHOW" } })),
  "bookings.markCompleted": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.externalBooking.update({ where: { id: input.id }, data: { status: "COMPLETED" } })),
  "bookings.linkToMatter": publicProcedure
    .input(z.object({ id: z.string(), matterId: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.externalBooking.update({ where: { id: input.id }, data: { matterId: input.matterId } })),
  "bookings.sync": publicProcedure
    .input(z.object({ provider: z.enum(SCHED_PROVIDERS), from: z.string().optional(), to: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const range = input.from && input.to ? { from: input.from, to: input.to } : undefined;
      let bookings: any[] = [];
      if (input.provider === "APPTOTO") { const r = await apptotoGetAppointments(range); if (r.success) bookings = (r as any).data?.appointments || (r as any).data || []; }
      if (input.provider === "ATTORNIFY") { const r = await attornifyGetBookings(range); if (r.success) bookings = (r as any).data?.bookings || (r as any).data || []; }
      if (input.provider === "CALENDLY") { const r = await calendlyGetScheduledEvents(range); if (r.success) bookings = (r as any).data?.collection || (r as any).data || []; }

      let synced = 0;
      for (const b of (Array.isArray(bookings) ? bookings : [])) {
        const extId = b.id || b.uri || b.booking_id || String(Date.now() + Math.random());
        await ctx.db.externalBooking.upsert({
          where: { provider_externalBookingId: { provider: input.provider, externalBookingId: extId } },
          create: { provider: input.provider, externalBookingId: extId, bookerName: b.invitee?.name || b.client_name || b.name || "Unknown", bookerEmail: b.invitee?.email || b.client_email || b.email || "", eventName: b.name || b.title || b.event_type || "Appointment", startTime: new Date(b.start_time || b.start || b.startTime), endTime: new Date(b.end_time || b.end || b.endTime), duration: b.duration || 30, status: b.status?.toUpperCase() || "SCHEDULED" },
          update: { status: b.status?.toUpperCase() || undefined },
        });
        synced++;
      }
      return { synced };
    }),

  // ─── Calendar ──────────────────────────────────────────────────
  "calendar.unified": publicProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .query(async ({ input }) => getUnifiedCalendar(input)),

  // ─── Availability ──────────────────────────────────────────────
  "availability.rules": publicProcedure.query(async ({ ctx }) => ctx.db.availabilityRule.findMany({ where: { isActive: true }, orderBy: { name: "asc" } })),
  "availability.createRule": publicProcedure
    .input(z.object({ name: z.string(), rules: z.string(), overrides: z.string().optional(), timezone: z.string().optional(), isDefault: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.availabilityRule.create({ data: input })),

  // ─── Reminders ─────────────────────────────────────────────────
  "reminders.list": publicProcedure
    .input(z.object({ bookingId: z.string().optional(), appointmentId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.bookingId) where.bookingId = input.bookingId;
      if (input?.appointmentId) where.appointmentId = input.appointmentId;
      return ctx.db.reminderLog.findMany({ where, orderBy: { scheduledFor: "desc" }, take: 50 });
    }),
  "reminders.stats": publicProcedure.query(async ({ ctx }) => {
    const total = await ctx.db.reminderLog.count();
    const sent = await ctx.db.reminderLog.count({ where: { status: "SENT" } });
    const confirmed = await ctx.db.reminderLog.count({ where: { response: "confirmed" } });
    const cancelled = await ctx.db.reminderLog.count({ where: { response: "cancelled" } });
    return { total, sent, confirmed, cancelled, confirmationRate: sent > 0 ? (confirmed / sent) * 100 : 0 };
  }),

  // ─── Widgets ───────────────────────────────────────────────────
  "widgets.list": publicProcedure.query(async ({ ctx }) => ctx.db.bookingWidget.findMany({ where: { isActive: true } })),
  "widgets.create": publicProcedure
    .input(z.object({ name: z.string(), provider: z.string().optional(), eventTypeId: z.string().optional(), widgetType: z.string().default("LINK"), bookingUrl: z.string(), theme: z.string().optional() }))
    .mutation(async ({ ctx, input }) => ctx.db.bookingWidget.create({ data: input })),

  // ─── Reports ───────────────────────────────────────────────────
  "reports.overview": publicProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .query(async ({ input }) => getBookingAnalytics(input)),

  // ─── Dashboard Stats ───────────────────────────────────────────
  getDashboardStats: publicProcedure.query(async ({ ctx }) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const week = new Date(today); week.setDate(week.getDate() + 7);

    const todayBookings = await ctx.db.externalBooking.count({ where: { startTime: { gte: today, lt: tomorrow }, status: { not: "CANCELLED" } } });
    const weekBookings = await ctx.db.externalBooking.count({ where: { startTime: { gte: today, lt: week }, status: { not: "CANCELLED" } } });
    const pendingReminders = await ctx.db.reminderLog.count({ where: { status: "QUEUED" } });
    const noShows = await ctx.db.externalBooking.count({ where: { status: "NO_SHOW" } });
    const eventTypes = await ctx.db.externalEventType.count({ where: { isActive: true } });
    const providers = await ctx.db.schedulingIntegration.count({ where: { isEnabled: true } });

    return { todayBookings, weekBookings, pendingReminders, noShows, eventTypes, providers };
  }),
});
