import { db } from "@/lib/db";

export async function getUnifiedCalendar(dateRange: { from: string; to: string }) {
  const builtIn = await db.calendarEvent.findMany({
    where: { startTime: { gte: new Date(dateRange.from), lte: new Date(dateRange.to) } },
    orderBy: { startTime: "asc" },
  });
  const external = await db.externalBooking.findMany({
    where: { startTime: { gte: new Date(dateRange.from), lte: new Date(dateRange.to) }, status: { not: "CANCELLED" } },
    orderBy: { startTime: "asc" },
  });

  const unified = [
    ...builtIn.map((e) => ({ type: "builtin" as const, id: e.id, title: e.title, startTime: e.startTime, endTime: e.endTime, provider: "CLIO_AI" })),
    ...external.map((b) => ({ type: "external" as const, id: b.id, title: b.eventName, startTime: b.startTime, endTime: b.endTime, provider: b.provider, bookerName: b.bookerName, status: b.status })),
  ].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return unified;
}

export async function matchBookerToContact(email: string, phone?: string) {
  if (email) {
    const client = await db.client.findFirst({ where: { email } });
    if (client) return { type: "client" as const, id: client.id, name: client.name };
    const lead = await db.lead.findFirst({ where: { email } });
    if (lead) return { type: "lead" as const, id: lead.id, name: lead.name };
  }
  if (phone) {
    const clean = phone.replace(/\D/g, "").slice(-10);
    if (clean.length >= 7) {
      const client = await db.client.findFirst({ where: { phone: { contains: clean } } });
      if (client) return { type: "client" as const, id: client.id, name: client.name };
    }
  }
  return null;
}

export async function syncBookingToBuiltIn(booking: any) {
  const match = await matchBookerToContact(booking.bookerEmail, booking.bookerPhone);

  // Create calendar event
  const event = await db.calendarEvent.create({
    data: {
      title: booking.eventName,
      startTime: new Date(booking.startTime),
      endTime: new Date(booking.endTime),
      location: booking.location,
      description: `Booked via ${booking.provider}. ${booking.bookerName} (${booking.bookerEmail})`,
    },
  });

  // Update booking with local references
  await db.externalBooking.update({
    where: { id: booking.id },
    data: {
      calendarEventId: event.id,
      clientId: match?.type === "client" ? match.id : undefined,
      leadId: match?.type === "lead" ? match.id : undefined,
    },
  });

  // Auto-create lead if no match
  if (!match && booking.bookerEmail) {
    const lead = await db.lead.create({
      data: { name: booking.bookerName, email: booking.bookerEmail, phone: booking.bookerPhone, source: "OTHER", status: "NEW", priority: "MEDIUM" },
    });
    await db.externalBooking.update({ where: { id: booking.id }, data: { leadId: lead.id } });
  }

  return { eventId: event.id, matched: match };
}

export async function getBookingAnalytics(dateRange: { from: string; to: string }) {
  const bookings = await db.externalBooking.findMany({
    where: { startTime: { gte: new Date(dateRange.from), lte: new Date(dateRange.to) } },
  });

  const byProvider: Record<string, number> = {};
  let cancelled = 0, noShows = 0, completed = 0;

  for (const b of bookings) {
    byProvider[b.provider] = (byProvider[b.provider] || 0) + 1;
    if (b.status === "CANCELLED") cancelled++;
    if (b.status === "NO_SHOW") noShows++;
    if (b.status === "COMPLETED") completed++;
  }

  return {
    totalBookings: bookings.length, byProvider, cancelled, noShows, completed,
    cancellationRate: bookings.length > 0 ? (cancelled / bookings.length) * 100 : 0,
    noShowRate: bookings.length > 0 ? (noShows / bookings.length) * 100 : 0,
  };
}
