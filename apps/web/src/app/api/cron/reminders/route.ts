import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendAppointmentReminder } from "@/lib/email";

export async function GET(req: NextRequest) {
  // Verify cron secret for Vercel Cron Jobs
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const settings = await db.schedulerSettings.findUnique({
      where: { id: "default" },
    });

    if (!settings?.sendReminders) {
      return NextResponse.json({ message: "Reminders disabled", sent: 0 });
    }

    const now = new Date();
    const reminderHours = settings.reminderHoursBefore;
    const reminderWindow = new Date(now.getTime() + reminderHours * 60 * 60 * 1000);

    // Find confirmed appointments within the reminder window that haven't been reminded
    const appointments = await db.appointment.findMany({
      where: {
        status: "CONFIRMED",
        startTime: {
          gte: now,
          lte: reminderWindow,
        },
        reminderSentAt: null,
      },
    });

    // Get firm info for email
    const firmSettings = await db.settings.findUnique({ where: { id: "default" } });
    const fromEmail = settings.reminderEmailFrom || `noreply@${process.env.RESEND_DOMAIN || "example.com"}`;

    let sent = 0;
    for (const apt of appointments) {
      const result = await sendAppointmentReminder({
        clientName: apt.clientName,
        clientEmail: apt.clientEmail,
        startTime: apt.startTime,
        endTime: apt.endTime,
        practiceArea: apt.practiceArea,
        firmName: firmSettings?.firmName || undefined,
        fromEmail,
      });

      if (result.success) {
        await db.appointment.update({
          where: { id: apt.id },
          data: { reminderSentAt: new Date() },
        });
        sent++;
      }
    }

    // Handle second reminder if configured
    if (settings.secondReminderHours) {
      const secondWindow = new Date(
        now.getTime() + settings.secondReminderHours * 60 * 60 * 1000
      );

      const secondReminders = await db.appointment.findMany({
        where: {
          status: "CONFIRMED",
          startTime: {
            gte: now,
            lte: secondWindow,
          },
          reminderSentAt: { not: null },
          // Only send second reminder if first was sent more than secondReminderHours ago
        },
      });

      // For second reminders, we check if enough time has passed since first
      for (const apt of secondReminders) {
        if (!apt.reminderSentAt) continue;
        const hoursSinceFirst =
          (now.getTime() - apt.reminderSentAt.getTime()) / (60 * 60 * 1000);

        // Only send second if it's been at least (reminderHours - secondReminderHours) since first
        if (hoursSinceFirst >= reminderHours - settings.secondReminderHours) {
          // Check we haven't already sent a second (use a time-based heuristic)
          const hoursBefore =
            (apt.startTime.getTime() - now.getTime()) / (60 * 60 * 1000);
          if (hoursBefore <= settings.secondReminderHours + 0.5) {
            const result = await sendAppointmentReminder({
              clientName: apt.clientName,
              clientEmail: apt.clientEmail,
              startTime: apt.startTime,
              endTime: apt.endTime,
              practiceArea: apt.practiceArea,
              firmName: firmSettings?.firmName || undefined,
              fromEmail,
            });
            if (result.success) sent++;
          }
        }
      }
    }

    return NextResponse.json({ success: true, sent });
  } catch (error: any) {
    console.error("[Cron Reminders] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
