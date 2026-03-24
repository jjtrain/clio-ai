import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { getAvailableSlots, createBooking, processReminders, generateICSFile } from "@/lib/appointment-engine";

const DEFAULT_FIRM_ID = "demo-firm";
const DEFAULT_USER_ID = "demo-user";

export const appointmentSchedulingRouter = router({
  // TYPES
  getAppointmentTypes: publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), isPublic: z.boolean().optional(), isActive: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.practiceArea) where.practiceArea = input.practiceArea;
      if (input.isPublic !== undefined) where.isPublic = input.isPublic;
      if (input.isActive !== undefined) where.isActive = input.isActive;
      else where.isActive = true;
      return ctx.db.appointmentType.findMany({ where, orderBy: { sortOrder: "asc" } });
    }),

  createAppointmentType: publicProcedure
    .input(z.object({ name: z.string(), description: z.string().optional(), practiceArea: z.string().optional(), duration: z.number(), bufferAfter: z.number().optional(), locationType: z.string().optional(), virtualPlatform: z.string().optional(), price: z.number().optional(), requiresPayment: z.boolean().optional(), allowedBookers: z.string().optional(), requiresMatter: z.boolean().optional(), maxAdvanceDays: z.number().optional(), minAdvanceHours: z.number().optional(), maxPerDay: z.number().optional(), autoConfirm: z.boolean().optional(), preparationInstructions: z.string().optional(), followUpActions: z.any().optional(), isPublic: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.appointmentType.create({ data: { ...input, isActive: true, firmId: DEFAULT_FIRM_ID } });
    }),

  // AVAILABILITY
  getAvailability: publicProcedure.input(z.object({ attorneyId: z.string() })).query(async ({ ctx, input }) => {
    const rules = await ctx.db.attorneyAvailability.findMany({ where: { attorneyId: input.attorneyId, firmId: DEFAULT_FIRM_ID }, orderBy: { dayOfWeek: "asc" } });
    const exceptions = await ctx.db.availabilityException.findMany({ where: { attorneyId: input.attorneyId, firmId: DEFAULT_FIRM_ID, date: { gte: new Date() } }, orderBy: { date: "asc" } });
    return { rules, exceptions };
  }),

  setAvailability: publicProcedure
    .input(z.object({ attorneyId: z.string(), dayOfWeek: z.number().optional(), startTime: z.string(), endTime: z.string(), isAvailable: z.boolean().optional(), locationType: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.attorneyAvailability.create({ data: { ...input, isAvailable: input.isAvailable ?? true, locationType: input.locationType || "both", recurrenceType: "weekly", firmId: DEFAULT_FIRM_ID } });
    }),

  addException: publicProcedure
    .input(z.object({ attorneyId: z.string(), date: z.date(), allDay: z.boolean().optional(), reason: z.string(), reasonDetail: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.availabilityException.create({ data: { ...input, allDay: input.allDay ?? true, firmId: DEFAULT_FIRM_ID } });
    }),

  // SLOTS
  getAvailableSlots: publicProcedure
    .input(z.object({ attorneyId: z.string().optional(), appointmentTypeId: z.string(), month: z.number(), year: z.number() }))
    .query(async ({ input }) => {
      return getAvailableSlots({ ...input, firmId: DEFAULT_FIRM_ID });
    }),

  // BOOKING
  bookAppointment: publicProcedure
    .input(z.object({ appointmentTypeId: z.string(), attorneyId: z.string().optional(), startTime: z.date(), locationType: z.string(), clientName: z.string(), clientEmail: z.string(), clientPhone: z.string().optional(), matterId: z.string().optional(), clientNotes: z.string().optional(), bookingSource: z.string().optional() }))
    .mutation(async ({ input }) => {
      return createBooking({ ...input, firmId: DEFAULT_FIRM_ID, userId: DEFAULT_USER_ID });
    }),

  // MANAGEMENT
  getAppointments: publicProcedure
    .input(z.object({ attorneyId: z.string().optional(), matterId: z.string().optional(), status: z.string().optional(), limit: z.number().optional().default(30) }))
    .query(async ({ ctx, input }) => {
      const where: any = { firmId: DEFAULT_FIRM_ID };
      if (input.attorneyId) where.attorneyId = input.attorneyId;
      if (input.matterId) where.matterId = input.matterId;
      if (input.status) where.status = input.status;
      return ctx.db.scheduledAppointment.findMany({ where, include: { type: { select: { name: true, duration: true } } }, orderBy: { startTime: "desc" }, take: input.limit });
    }),

  getAppointment: publicProcedure.input(z.object({ appointmentId: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.scheduledAppointment.findUnique({ where: { id: input.appointmentId }, include: { type: true, reminders: true } });
  }),

  getUpcoming: publicProcedure.input(z.object({ limit: z.number().optional().default(10) })).query(async ({ ctx, input }) => {
    return ctx.db.scheduledAppointment.findMany({
      where: { firmId: DEFAULT_FIRM_ID, startTime: { gte: new Date() }, status: { in: ["confirmed", "pending"] } },
      include: { type: { select: { name: true } } }, orderBy: { startTime: "asc" }, take: input.limit,
    });
  }),

  getTodaysAppointments: publicProcedure.query(async ({ ctx }) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    return ctx.db.scheduledAppointment.findMany({
      where: { firmId: DEFAULT_FIRM_ID, startTime: { gte: today, lt: tomorrow }, status: { in: ["confirmed", "pending", "in_progress"] } },
      include: { type: { select: { name: true, duration: true, color: true } } }, orderBy: { startTime: "asc" },
    });
  }),

  completeAppointment: publicProcedure
    .input(z.object({ appointmentId: z.string(), billingDuration: z.number().optional(), attorneyNotes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.scheduledAppointment.update({ where: { id: input.appointmentId }, data: { status: "completed", completedAt: new Date(), billingDuration: input.billingDuration, attorneyNotes: input.attorneyNotes } });
    }),

  cancelAppointment: publicProcedure
    .input(z.object({ appointmentId: z.string(), reason: z.string().optional(), cancelledBy: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.scheduledAppointment.update({ where: { id: input.appointmentId }, data: { status: "cancelled", cancellationReason: input.reason, cancelledAt: new Date(), cancelledBy: input.cancelledBy || "attorney" } });
    }),

  markNoShow: publicProcedure.input(z.object({ appointmentId: z.string() })).mutation(async ({ ctx, input }) => {
    return ctx.db.scheduledAppointment.update({ where: { id: input.appointmentId }, data: { status: "no_show", noShowAt: new Date() } });
  }),

  reschedule: publicProcedure
    .input(z.object({ appointmentId: z.string(), newStartTime: z.date() }))
    .mutation(async ({ ctx, input }) => {
      const appt = await ctx.db.scheduledAppointment.findUnique({ where: { id: input.appointmentId }, include: { type: true } });
      if (!appt) throw new Error("Appointment not found");
      const newEnd = new Date(input.newStartTime.getTime() + appt.duration * 60 * 1000);
      return ctx.db.scheduledAppointment.update({ where: { id: input.appointmentId }, data: { startTime: input.newStartTime, endTime: newEnd, status: "confirmed" } });
    }),

  // PUBLIC BOOKING PAGE
  getBookingPageConfig: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ ctx, input }) => {
    return ctx.db.bookingPageConfig.findUnique({ where: { slug: input.slug } });
  }),

  // ICS
  getCalendarFile: publicProcedure.input(z.object({ appointmentId: z.string() })).query(async ({ ctx, input }) => {
    const appt = await ctx.db.scheduledAppointment.findUnique({ where: { id: input.appointmentId } });
    if (!appt) throw new Error("Not found");
    return { ics: generateICSFile(appt) };
  }),

  // REMINDERS
  processReminders: publicProcedure.mutation(async () => { return { sent: await processReminders(DEFAULT_FIRM_ID) }; }),

  // STATS
  getSchedulingStats: publicProcedure.query(async ({ ctx }) => {
    const total = await ctx.db.scheduledAppointment.count({ where: { firmId: DEFAULT_FIRM_ID } });
    const completed = await ctx.db.scheduledAppointment.count({ where: { firmId: DEFAULT_FIRM_ID, status: "completed" } });
    const noShows = await ctx.db.scheduledAppointment.count({ where: { firmId: DEFAULT_FIRM_ID, status: "no_show" } });
    const cancelled = await ctx.db.scheduledAppointment.count({ where: { firmId: DEFAULT_FIRM_ID, status: "cancelled" } });
    const upcoming = await ctx.db.scheduledAppointment.count({ where: { firmId: DEFAULT_FIRM_ID, status: { in: ["confirmed", "pending"] }, startTime: { gte: new Date() } } });
    return { total, completed, noShows, cancelled, upcoming, completionRate: total > 0 ? Math.round((completed / total) * 100) : 100, noShowRate: total > 0 ? Math.round((noShows / total) * 100) : 0 };
  }),
});
