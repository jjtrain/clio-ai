import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { Decimal } from "@prisma/client/runtime/library";
import {
  getHelcimCredentials,
  initializeCheckout,
  verifyTransactionResponse,
} from "@/lib/helcim";

// Default availability: Mon-Fri 9am-5pm
const DEFAULT_AVAILABILITY = JSON.stringify([
  { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 2, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 3, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 4, startTime: "09:00", endTime: "17:00" },
  { dayOfWeek: 5, startTime: "09:00", endTime: "17:00" },
]);

const DEFAULT_PRACTICE_AREAS = JSON.stringify([
  "Family Law",
  "Divorce",
  "Child Custody",
  "Estate Planning",
  "Wills & Trusts",
  "Business Law",
  "Real Estate",
  "Personal Injury",
  "Criminal Defense",
  "Immigration",
  "Other",
]);

const availabilitySchema = z.array(
  z.object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
  })
);

export const schedulerRouter = router({
  // Get scheduler settings
  getSettings: publicProcedure.query(async ({ ctx }) => {
    let settings = await ctx.db.schedulerSettings.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      // Create default settings
      settings = await ctx.db.schedulerSettings.create({
        data: {
          id: "default",
          isEnabled: false,
          availability: DEFAULT_AVAILABILITY,
          practiceAreas: DEFAULT_PRACTICE_AREAS,
        },
      });
    }

    return {
      ...settings,
      availability: settings.availability
        ? JSON.parse(settings.availability)
        : JSON.parse(DEFAULT_AVAILABILITY),
      practiceAreas: settings.practiceAreas
        ? JSON.parse(settings.practiceAreas)
        : JSON.parse(DEFAULT_PRACTICE_AREAS),
      consultationFee: settings.consultationFee
        ? Number(settings.consultationFee)
        : 150,
    };
  }),

  // Update scheduler settings
  updateSettings: publicProcedure
    .input(
      z.object({
        isEnabled: z.boolean().optional(),
        availability: availabilitySchema.optional(),
        consultationDuration: z.number().min(15).max(180).optional(),
        consultationFee: z.number().min(0).optional(),
        bufferTime: z.number().min(0).max(60).optional(),
        minAdvanceBooking: z.number().min(0).optional(),
        maxAdvanceBooking: z.number().min(1).max(365).optional(),
        preventSameDayBooking: z.boolean().optional(),
        requirePaymentUpfront: z.boolean().optional(),
        practiceAreas: z.array(z.string()).optional(),
        confirmationMessage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: any = {};

      if (input.isEnabled !== undefined) data.isEnabled = input.isEnabled;
      if (input.availability) data.availability = JSON.stringify(input.availability);
      if (input.consultationDuration !== undefined)
        data.consultationDuration = input.consultationDuration;
      if (input.consultationFee !== undefined)
        data.consultationFee = new Decimal(input.consultationFee);
      if (input.bufferTime !== undefined) data.bufferTime = input.bufferTime;
      if (input.minAdvanceBooking !== undefined)
        data.minAdvanceBooking = input.minAdvanceBooking;
      if (input.maxAdvanceBooking !== undefined)
        data.maxAdvanceBooking = input.maxAdvanceBooking;
      if (input.preventSameDayBooking !== undefined)
        data.preventSameDayBooking = input.preventSameDayBooking;
      if (input.requirePaymentUpfront !== undefined)
        data.requirePaymentUpfront = input.requirePaymentUpfront;
      if (input.practiceAreas) data.practiceAreas = JSON.stringify(input.practiceAreas);
      if (input.confirmationMessage !== undefined)
        data.confirmationMessage = input.confirmationMessage;

      const settings = await ctx.db.schedulerSettings.upsert({
        where: { id: "default" },
        update: data,
        create: {
          id: "default",
          ...data,
          availability: data.availability || DEFAULT_AVAILABILITY,
          practiceAreas: data.practiceAreas || DEFAULT_PRACTICE_AREAS,
        },
      });

      return settings;
    }),

  // Get available time slots for a specific date
  getAvailableSlots: publicProcedure
    .input(z.object({ date: z.string() }))
    .query(async ({ ctx, input }) => {
      const settings = await ctx.db.schedulerSettings.findUnique({
        where: { id: "default" },
      });

      if (!settings?.isEnabled) {
        return { slots: [], message: "Online booking is not currently available" };
      }

      const requestedDate = new Date(input.date);
      const now = new Date();
      const dayOfWeek = requestedDate.getDay();

      // Check minimum advance booking
      const minAdvanceMs = settings.minAdvanceBooking * 60 * 60 * 1000;
      if (requestedDate.getTime() - now.getTime() < minAdvanceMs) {
        return { slots: [], message: "This date is too soon to book" };
      }

      // Check maximum advance booking
      const maxAdvanceMs = settings.maxAdvanceBooking * 24 * 60 * 60 * 1000;
      if (requestedDate.getTime() - now.getTime() > maxAdvanceMs) {
        return { slots: [], message: "This date is too far in advance" };
      }

      // Check same-day booking
      if (settings.preventSameDayBooking) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const reqDay = new Date(requestedDate);
        reqDay.setHours(0, 0, 0, 0);
        if (reqDay.getTime() === today.getTime()) {
          return { slots: [], message: "Same-day booking is not available" };
        }
      }

      // Get availability for this day of week
      const availability = settings.availability
        ? JSON.parse(settings.availability)
        : [];
      const dayAvailability = availability.find(
        (a: any) => a.dayOfWeek === dayOfWeek
      );

      if (!dayAvailability) {
        return { slots: [], message: "No availability on this day" };
      }

      // Get existing calendar events for this day
      const startOfDay = new Date(requestedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(requestedDate);
      endOfDay.setHours(23, 59, 59, 999);

      const existingEvents = await ctx.db.calendarEvent.findMany({
        where: {
          startTime: { gte: startOfDay },
          endTime: { lte: endOfDay },
        },
      });

      // Get existing appointments for this day
      const existingAppointments = await ctx.db.appointment.findMany({
        where: {
          startTime: { gte: startOfDay },
          endTime: { lte: endOfDay },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      });

      // Generate time slots
      const slots: { time: string; available: boolean }[] = [];
      const [startHour, startMin] = dayAvailability.startTime.split(":").map(Number);
      const [endHour, endMin] = dayAvailability.endTime.split(":").map(Number);

      const slotDuration = settings.consultationDuration;
      const buffer = settings.bufferTime;

      let currentTime = new Date(requestedDate);
      currentTime.setHours(startHour, startMin, 0, 0);

      const endTime = new Date(requestedDate);
      endTime.setHours(endHour, endMin, 0, 0);

      while (currentTime < endTime) {
        const slotEnd = new Date(currentTime.getTime() + slotDuration * 60 * 1000);

        if (slotEnd > endTime) break;

        // Check if slot conflicts with existing events
        const hasConflict = [...existingEvents, ...existingAppointments].some(
          (event) => {
            const eventStart = new Date(event.startTime);
            const eventEnd = new Date(event.endTime);
            // Add buffer time around existing events
            eventStart.setMinutes(eventStart.getMinutes() - buffer);
            eventEnd.setMinutes(eventEnd.getMinutes() + buffer);
            return currentTime < eventEnd && slotEnd > eventStart;
          }
        );

        // Check if slot is in the past
        const isPast = currentTime < now;

        slots.push({
          time: currentTime.toISOString(),
          available: !hasConflict && !isPast,
        });

        // Move to next slot (duration + buffer)
        currentTime = new Date(
          currentTime.getTime() + (slotDuration + buffer) * 60 * 1000
        );
      }

      return { slots };
    }),

  // Create an appointment
  createAppointment: publicProcedure
    .input(
      z.object({
        startTime: z.string(),
        clientName: z.string().min(1),
        clientEmail: z.string().email(),
        clientPhone: z.string().optional(),
        practiceArea: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const settings = await ctx.db.schedulerSettings.findUnique({
        where: { id: "default" },
      });

      if (!settings?.isEnabled) {
        throw new Error("Online booking is not currently available");
      }

      const startTime = new Date(input.startTime);
      const endTime = new Date(
        startTime.getTime() + settings.consultationDuration * 60 * 1000
      );

      // Check if slot is still available
      const existingAppointments = await ctx.db.appointment.findMany({
        where: {
          startTime: { lte: endTime },
          endTime: { gte: startTime },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      });

      if (existingAppointments.length > 0) {
        throw new Error("This time slot is no longer available");
      }

      const appointment = await ctx.db.appointment.create({
        data: {
          startTime,
          endTime,
          duration: settings.consultationDuration,
          clientName: input.clientName,
          clientEmail: input.clientEmail,
          clientPhone: input.clientPhone,
          practiceArea: input.practiceArea,
          notes: input.notes,
          consultationFee: settings.consultationFee,
          status: settings.requirePaymentUpfront ? "PENDING" : "CONFIRMED",
          paymentStatus: settings.requirePaymentUpfront ? "UNPAID" : "UNPAID",
        },
      });

      return appointment;
    }),

  // List appointments (for admin)
  listAppointments: publicProcedure
    .input(
      z.object({
        status: z
          .enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"])
          .optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input.status) where.status = input.status;
      if (input.startDate) where.startTime = { gte: new Date(input.startDate) };
      if (input.endDate) {
        where.startTime = {
          ...where.startTime,
          lte: new Date(input.endDate),
        };
      }

      const appointments = await ctx.db.appointment.findMany({
        where,
        orderBy: { startTime: "desc" },
        take: input.limit,
        skip: input.offset,
      });

      const total = await ctx.db.appointment.count({ where });

      return { appointments, total };
    }),

  // Get single appointment
  getAppointment: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const appointment = await ctx.db.appointment.findUnique({
        where: { id: input.id },
      });

      if (!appointment) {
        throw new Error("Appointment not found");
      }

      return appointment;
    }),

  // Update appointment status
  updateAppointmentStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"]),
        cancellationReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: any = { status: input.status };

      if (input.status === "CANCELLED") {
        data.cancelledAt = new Date();
        data.cancellationReason = input.cancellationReason;
      }

      const appointment = await ctx.db.appointment.update({
        where: { id: input.id },
        data,
      });

      // If confirmed and not already on calendar, add to calendar
      if (input.status === "CONFIRMED" && !appointment.calendarEventId) {
        const event = await ctx.db.calendarEvent.create({
          data: {
            title: `Consultation: ${appointment.clientName}`,
            description: `Practice Area: ${appointment.practiceArea || "Not specified"}\nPhone: ${appointment.clientPhone || "Not provided"}\nEmail: ${appointment.clientEmail}\n\nNotes: ${appointment.notes || "None"}`,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            location: "Office",
          },
        });

        await ctx.db.appointment.update({
          where: { id: input.id },
          data: { calendarEventId: event.id },
        });
      }

      return appointment;
    }),

  // Initialize Helcim checkout for appointment payment
  initializePayment: publicProcedure
    .input(z.object({ appointmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const creds = await getHelcimCredentials(ctx.db);
      if (!creds) {
        throw new Error("Online payments are not configured");
      }

      const appointment = await ctx.db.appointment.findUnique({
        where: { id: input.appointmentId },
      });

      if (!appointment) {
        throw new Error("Appointment not found");
      }

      if (appointment.paymentStatus === "PAID") {
        throw new Error("Appointment is already paid");
      }

      const amount = Number(appointment.consultationFee);

      console.log("[Scheduler] Initializing payment:", {
        appointmentId: appointment.id,
        amount,
      });

      const result = await initializeCheckout({
        amount,
        invoiceNumber: `APT-${appointment.id.slice(-8)}`,
        invoiceId: appointment.id,
        apiToken: creds.apiToken,
      });

      return { checkoutToken: result.checkoutToken, amount };
    }),

  // Confirm payment for appointment
  confirmPayment: publicProcedure
    .input(
      z.object({
        appointmentId: z.string(),
        transactionId: z.string(),
        hash: z.string(),
        rawResponse: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const appointment = await ctx.db.appointment.findUnique({
        where: { id: input.appointmentId },
      });

      if (!appointment) {
        throw new Error("Appointment not found");
      }

      // Verify the transaction hash
      const isValid = verifyTransactionResponse(
        input.appointmentId,
        input.hash,
        input.rawResponse
      );

      if (!isValid) {
        throw new Error("Transaction verification failed");
      }

      // Update appointment
      const updatedAppointment = await ctx.db.appointment.update({
        where: { id: input.appointmentId },
        data: {
          paymentStatus: "PAID",
          helcimTransactionId: input.transactionId,
          paidAt: new Date(),
          status: "CONFIRMED",
        },
      });

      // Add to calendar
      if (!updatedAppointment.calendarEventId) {
        const event = await ctx.db.calendarEvent.create({
          data: {
            title: `Consultation: ${updatedAppointment.clientName}`,
            description: `Practice Area: ${updatedAppointment.practiceArea || "Not specified"}\nPhone: ${updatedAppointment.clientPhone || "Not provided"}\nEmail: ${updatedAppointment.clientEmail}\n\nNotes: ${updatedAppointment.notes || "None"}`,
            startTime: updatedAppointment.startTime,
            endTime: updatedAppointment.endTime,
            location: "Office",
          },
        });

        await ctx.db.appointment.update({
          where: { id: input.appointmentId },
          data: { calendarEventId: event.id },
        });
      }

      return updatedAppointment;
    }),

  // Check if Helcim is configured
  helcimEnabled: publicProcedure.query(async ({ ctx }) => {
    const creds = await getHelcimCredentials(ctx.db);
    return { enabled: !!creds };
  }),
});
