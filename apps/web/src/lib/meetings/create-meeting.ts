import { db } from "@/lib/db";
import { getZoomClient } from "./zoom-oauth";
import { getTeamsClient } from "./teams-oauth";
import { sendMeetingInviteEmail } from "./invite-email";

interface ScheduleParams {
  userId: string;
  firmId: string;
  matterId?: string;
  provider: "ZOOM" | "TEAMS";
  title: string;
  agenda?: string;
  scheduledAt: Date;
  durationMinutes: number;
  timezone: string;
  attendeeEmails: string[];
  sendInviteEmail: boolean;
  createCalendarEvent: boolean;
  createTimeEntry: boolean;
}

// ─── Zoom Meeting ───────────────────────────────────────────────

async function createZoomMeeting(params: ScheduleParams) {
  const { api, connection } = await getZoomClient(params.userId);
  const zoomUserId = connection.providerUserId || "me";

  const res = await api.post(`/users/${zoomUserId}/meetings`, {
    type: 2,
    topic: params.title,
    agenda: params.agenda || "",
    start_time: params.scheduledAt.toISOString(),
    duration: params.durationMinutes,
    timezone: params.timezone,
    settings: {
      waiting_room: true,
      join_before_host: false,
      mute_upon_entry: true,
      auto_recording: "none",
      registrants_email_notification: false,
    },
  });

  return {
    externalMeetingId: String(res.data.id),
    joinUrl: res.data.join_url,
    hostUrl: res.data.start_url,
    password: res.data.password,
    dialInNumbers: res.data.settings?.global_dial_in_numbers || null,
  };
}

// ─── Teams Meeting ──────────────────────────────────────────────

async function createTeamsMeeting(params: ScheduleParams) {
  const { api } = await getTeamsClient(params.userId);

  const endTime = new Date(params.scheduledAt.getTime() + params.durationMinutes * 60000);

  const res = await api.post("/me/onlineMeetings", {
    subject: params.title,
    startDateTime: params.scheduledAt.toISOString(),
    endDateTime: endTime.toISOString(),
    participants: {
      attendees: params.attendeeEmails.map((email) => ({
        upn: email,
        role: "attendee",
      })),
    },
  });

  return {
    externalMeetingId: res.data.id,
    joinUrl: res.data.joinWebUrl || res.data.joinUrl,
    hostUrl: null,
    password: null,
    dialInNumbers: res.data.audioConferencing?.dialinUrl ? [{ number: res.data.audioConferencing.tollNumber }] : null,
  };
}

// ─── Main Scheduling Flow ───────────────────────────────────────

export async function scheduleMeeting(params: ScheduleParams) {
  // 1. Create meeting on provider
  const providerResult = params.provider === "ZOOM"
    ? await createZoomMeeting(params)
    : await createTeamsMeeting(params);

  // 2. Create MeetingEvent
  const meeting = await db.meetingEvent.create({
    data: {
      firmId: params.firmId,
      matterId: params.matterId || null,
      createdById: params.userId,
      title: params.title,
      agenda: params.agenda || null,
      provider: params.provider,
      externalMeetingId: providerResult.externalMeetingId,
      joinUrl: providerResult.joinUrl,
      hostUrl: providerResult.hostUrl,
      password: providerResult.password,
      dialInNumbers: providerResult.dialInNumbers || undefined,
      scheduledAt: params.scheduledAt,
      durationMinutes: params.durationMinutes,
      timezone: params.timezone,
      attendees: {
        create: [
          { email: "host@firm.com", name: "Host", role: "HOST" },
          ...params.attendeeEmails.map((email) => ({
            email,
            role: "ATTENDEE" as const,
          })),
        ],
      },
    },
    include: { attendees: true },
  });

  // 3. Create calendar event
  if (params.createCalendarEvent) {
    try {
      const calEvent = await db.calendarEvent.create({
        data: {
          matterId: params.matterId || null,
          title: `${params.provider === "ZOOM" ? "🎥" : "📹"} ${params.title}`,
          description: `Join: ${providerResult.joinUrl}${providerResult.password ? `\nPassword: ${providerResult.password}` : ""}${params.agenda ? `\n\nAgenda: ${params.agenda}` : ""}`,
          startTime: params.scheduledAt,
          endTime: new Date(params.scheduledAt.getTime() + params.durationMinutes * 60000),
          location: providerResult.joinUrl,
          eventType: "meeting",
        },
      });
      await db.meetingEvent.update({ where: { id: meeting.id }, data: { calendarEventId: calEvent.id } });
    } catch { /* calendar event creation is best-effort */ }
  }

  // 4. Create time entry placeholder
  if (params.createTimeEntry && params.matterId) {
    try {
      const te = await db.timeEntry.create({
        data: {
          matterId: params.matterId,
          userId: params.userId,
          description: `Meeting: ${params.title}`,
          duration: params.durationMinutes,
          date: params.scheduledAt,
          billable: true,
        },
      });
      await db.meetingEvent.update({ where: { id: meeting.id }, data: { timeEntryId: te.id } });
    } catch { /* time entry creation is best-effort */ }
  }

  // 5. Send invite email
  if (params.sendInviteEmail) {
    try {
      await sendMeetingInviteEmail(meeting, params.userId);
    } catch { /* email sending is best-effort */ }
  }

  return meeting;
}

// ─── Cancel Meeting ─────────────────────────────────────────────

export async function cancelMeeting(meetingId: string, userId: string) {
  const meeting = await db.meetingEvent.findUniqueOrThrow({ where: { id: meetingId } });

  try {
    if (meeting.provider === "ZOOM") {
      const { api } = await getZoomClient(userId);
      await api.delete(`/meetings/${meeting.externalMeetingId}`);
    } else {
      const { api } = await getTeamsClient(userId);
      await api.delete(`/me/onlineMeetings/${meeting.externalMeetingId}`);
    }
  } catch { /* Provider deletion is best-effort */ }

  return db.meetingEvent.update({
    where: { id: meetingId },
    data: { status: "CANCELLED" },
  });
}
