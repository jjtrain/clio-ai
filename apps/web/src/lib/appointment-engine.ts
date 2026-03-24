import { db } from "@/lib/db";

// ==========================================
// SLOT GENERATION
// ==========================================

export async function getAvailableSlots(params: {
  attorneyId?: string;
  appointmentTypeId: string;
  year: number;
  month: number;
  firmId: string;
}): Promise<Array<{ date: string; slots: Array<{ startTime: Date; endTime: Date }> }>> {
  const type = await db.appointmentType.findUnique({ where: { id: params.appointmentTypeId } });
  if (!type) return [];

  const startOfMonth = new Date(params.year, params.month - 1, 1);
  const endOfMonth = new Date(params.year, params.month, 0);
  const now = new Date();
  const minBookingTime = new Date(now.getTime() + (type.minAdvanceHours || 24) * 60 * 60 * 1000);

  const availability = await db.attorneyAvailability.findMany({
    where: { firmId: params.firmId, ...(params.attorneyId ? { attorneyId: params.attorneyId } : {}), isAvailable: true },
  });

  const exceptions = await db.availabilityException.findMany({
    where: { firmId: params.firmId, ...(params.attorneyId ? { attorneyId: params.attorneyId } : {}), date: { gte: startOfMonth, lte: endOfMonth } },
  });
  const blockedDates = new Set(exceptions.filter((e) => e.allDay).map((e) => e.date.toISOString().split("T")[0]));

  const existingAppts = await db.scheduledAppointment.findMany({
    where: { firmId: params.firmId, ...(params.attorneyId ? { attorneyId: params.attorneyId } : {}), startTime: { gte: startOfMonth, lte: endOfMonth }, status: { in: ["confirmed", "pending", "in_progress"] } },
  });

  const results: Array<{ date: string; slots: Array<{ startTime: Date; endTime: Date }> }> = [];

  for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split("T")[0];
    if (blockedDates.has(dateStr)) continue;

    const dayAvail = availability.filter((a) => a.dayOfWeek === d.getDay());
    if (dayAvail.length === 0) continue;

    const daySlots: Array<{ startTime: Date; endTime: Date }> = [];
    for (const avail of dayAvail) {
      const [startH, startM] = avail.startTime.split(":").map(Number);
      const [endH, endM] = avail.endTime.split(":").map(Number);
      let slotStart = new Date(d); slotStart.setHours(startH, startM, 0, 0);
      const blockEnd = new Date(d); blockEnd.setHours(endH, endM, 0, 0);

      while (slotStart.getTime() + type.duration * 60 * 1000 <= blockEnd.getTime()) {
        const slotEnd = new Date(slotStart.getTime() + type.duration * 60 * 1000);
        if (slotStart > minBookingTime) {
          const hasConflict = existingAppts.some((a) => slotStart.getTime() < a.endTime.getTime() && slotEnd.getTime() > a.startTime.getTime());
          if (!hasConflict) daySlots.push({ startTime: new Date(slotStart), endTime: slotEnd });
        }
        slotStart = new Date(slotStart.getTime() + 30 * 60 * 1000);
      }
    }
    if (daySlots.length > 0) results.push({ date: dateStr, slots: daySlots });
  }
  return results;
}

// ==========================================
// BOOKING
// ==========================================

export async function createBooking(params: {
  appointmentTypeId: string; attorneyId?: string; startTime: Date; locationType: string;
  clientName: string; clientEmail: string; clientPhone?: string; matterId?: string;
  clientNotes?: string; bookingSource?: string; firmId: string; userId?: string;
}): Promise<any> {
  const type = await db.appointmentType.findUnique({ where: { id: params.appointmentTypeId } });
  if (!type) throw new Error("Appointment type not found");

  const endTime = new Date(params.startTime.getTime() + type.duration * 60 * 1000);
  const meetingUrl = params.locationType === "virtual" ? `https://meet.managal.app/${Math.random().toString(36).slice(2, 10)}` : null;

  const appointment = await db.scheduledAppointment.create({
    data: {
      typeId: params.appointmentTypeId, matterId: params.matterId, attorneyId: params.attorneyId,
      clientName: params.clientName, clientEmail: params.clientEmail, clientPhone: params.clientPhone,
      startTime: params.startTime, endTime, duration: type.duration, locationType: params.locationType,
      meetingUrl, status: type.autoConfirm ? "confirmed" : "pending",
      bookingSource: params.bookingSource || "manual", clientNotes: params.clientNotes,
      confirmationSentAt: new Date(), userId: params.userId, firmId: params.firmId,
    },
  });

  // Schedule reminders
  for (const r of [{ type: "24_hour", ch: "email", ms: 86400000 }, { type: "1_hour", ch: "sms", ms: 3600000 }]) {
    const at = new Date(params.startTime.getTime() - r.ms);
    if (at > new Date()) {
      await db.scheduledAppointmentReminder.create({ data: { appointmentId: appointment.id, reminderType: r.type, channel: r.ch, scheduledFor: at, firmId: params.firmId } });
    }
  }
  return appointment;
}

export async function processReminders(firmId: string): Promise<number> {
  const now = new Date();
  const due = await db.scheduledAppointmentReminder.findMany({ where: { firmId, status: "scheduled", scheduledFor: { lte: now } }, take: 50 });
  for (const r of due) { await db.scheduledAppointmentReminder.update({ where: { id: r.id }, data: { sentAt: now, status: "sent" } }); }
  return due.length;
}

export function generateICSFile(appt: { startTime: Date; endTime: Date; meetingUrl?: string | null }): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nDTSTART:${fmt(appt.startTime)}\r\nDTEND:${fmt(appt.endTime)}\r\nSUMMARY:Attorney Appointment\r\nLOCATION:${appt.meetingUrl || "Office"}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
}
