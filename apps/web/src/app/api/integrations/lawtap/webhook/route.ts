import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchBookerToContact, syncBookingToBuiltIn } from "@/lib/scheduling-engine";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const event = payload.event || payload.type || "";
    const provider = payload.provider || "UNKNOWN";

    if (event.includes("created") || event.includes("booked") || event.includes("scheduled")) {
      const booking = await db.externalBooking.create({
        data: {
          provider,
          externalBookingId: payload.booking_id || payload.event_id || payload.uri || String(Date.now()),
          bookerName: payload.invitee?.name || payload.client_name || payload.name || "Unknown",
          bookerEmail: payload.invitee?.email || payload.client_email || payload.email || "",
          bookerPhone: payload.invitee?.phone || payload.client_phone || payload.phone,
          eventName: payload.event_name || payload.title || payload.event_type?.name || "Appointment",
          startTime: new Date(payload.start_time || payload.start || payload.scheduled_event?.start_time || new Date()),
          endTime: new Date(payload.end_time || payload.end || payload.scheduled_event?.end_time || new Date()),
          duration: payload.duration || 30,
          status: "SCHEDULED",
          location: payload.location?.location || payload.location,
          intakeAnswers: payload.questions_and_answers ? JSON.stringify(payload.questions_and_answers) : undefined,
          rawPayload: JSON.stringify(payload),
        },
      });
      // Sync to built-in calendar
      try { await syncBookingToBuiltIn(booking); } catch {}
    }

    if (event.includes("cancel")) {
      const extId = payload.booking_id || payload.event_id || payload.uri;
      if (extId) {
        await db.externalBooking.updateMany({
          where: { externalBookingId: extId },
          data: { status: "CANCELLED", cancellationReason: payload.reason || payload.cancellation?.reason, cancelledAt: new Date() },
        });
      }
    }

    if (event.includes("reminder") || event.includes("confirmation")) {
      const extId = payload.appointment_id || payload.booking_id;
      if (extId) {
        const booking = await db.externalBooking.findFirst({ where: { externalBookingId: extId } });
        if (booking) {
          await db.reminderLog.create({
            data: {
              provider, bookingId: booking.id,
              recipientName: payload.recipient_name || booking.bookerName,
              recipientEmail: payload.recipient_email || booking.bookerEmail,
              method: payload.method?.toUpperCase() || "EMAIL",
              status: payload.response ? "CONFIRMED" : "SENT",
              scheduledFor: new Date(), sentAt: new Date(),
              response: payload.response,
            },
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Scheduling Webhook] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
