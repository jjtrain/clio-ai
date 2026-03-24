import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { scheduleMeeting, cancelMeeting } from "@/lib/meetings/create-meeting";
import { sendMeetingInviteEmail } from "@/lib/meetings/invite-email";

export const meetingsUnifiedRouter = router({
  getConnectionStatus: publicProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.userId || "demo-user";
    const connections = await ctx.db.videoConnection.findMany({ where: { userId, isActive: true } });
    return {
      zoom: connections.find((c) => c.provider === "ZOOM") ? { connected: true, email: connections.find((c) => c.provider === "ZOOM")!.email } : null,
      teams: connections.find((c) => c.provider === "TEAMS") ? { connected: true, email: connections.find((c) => c.provider === "TEAMS")!.email } : null,
    };
  }),

  listMeetings: publicProcedure
    .input(z.object({
      matterId: z.string().optional(),
      status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.status) where.status = input.status;
      if (input?.startDate || input?.endDate) {
        where.scheduledAt = {};
        if (input?.startDate) where.scheduledAt.gte = new Date(input.startDate);
        if (input?.endDate) where.scheduledAt.lte = new Date(input.endDate);
      }
      return ctx.db.meetingEvent.findMany({
        where,
        include: { attendees: true },
        orderBy: { scheduledAt: "desc" },
        take: input?.limit || 50,
      });
    }),

  getMeeting: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.meetingEvent.findUniqueOrThrow({
        where: { id: input.id },
        include: { attendees: true },
      });
    }),

  getUpcomingMeetings: publicProcedure
    .input(z.object({ limit: z.number().default(10) }).optional())
    .query(async ({ ctx, input }) => {
      return ctx.db.meetingEvent.findMany({
        where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } },
        include: { attendees: true },
        orderBy: { scheduledAt: "asc" },
        take: input?.limit || 10,
      });
    }),

  scheduleMeeting: publicProcedure
    .input(z.object({
      provider: z.enum(["ZOOM", "TEAMS"]),
      title: z.string().min(1),
      agenda: z.string().optional(),
      scheduledAt: z.string(),
      durationMinutes: z.number().min(5).max(480),
      timezone: z.string().default("America/New_York"),
      matterId: z.string().optional(),
      attendeeEmails: z.array(z.string()),
      sendInviteEmail: z.boolean().default(true),
      createCalendarEvent: z.boolean().default(true),
      createTimeEntry: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.userId || "demo-user";
      const firmId = ctx.session?.firmId || "demo-firm";
      return scheduleMeeting({
        userId,
        firmId,
        provider: input.provider,
        title: input.title,
        agenda: input.agenda,
        scheduledAt: new Date(input.scheduledAt),
        durationMinutes: input.durationMinutes,
        timezone: input.timezone,
        matterId: input.matterId,
        attendeeEmails: input.attendeeEmails,
        sendInviteEmail: input.sendInviteEmail,
        createCalendarEvent: input.createCalendarEvent,
        createTimeEntry: input.createTimeEntry,
      });
    }),

  cancelMeeting: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session?.userId || "demo-user";
      return cancelMeeting(input.id, userId);
    }),

  updateMeeting: publicProcedure
    .input(z.object({ id: z.string(), title: z.string().optional(), agenda: z.string().optional(), scheduledAt: z.string().optional(), durationMinutes: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const update: any = { ...data };
      if (data.scheduledAt) update.scheduledAt = new Date(data.scheduledAt);
      return ctx.db.meetingEvent.update({ where: { id }, data: update });
    }),

  resendInvite: publicProcedure
    .input(z.object({ meetingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.meetingEvent.findUniqueOrThrow({ where: { id: input.meetingId }, include: { attendees: true } });
      const userId = ctx.session?.userId || "demo-user";
      await sendMeetingInviteEmail(meeting, userId);
      return { sent: true };
    }),

  addAttendee: publicProcedure
    .input(z.object({ meetingId: z.string(), email: z.string(), name: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.meetingAttendee.create({
        data: { meetingId: input.meetingId, email: input.email, name: input.name },
      });
    }),

  removeAttendee: publicProcedure
    .input(z.object({ attendeeId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.meetingAttendee.delete({ where: { id: input.attendeeId } });
    }),

  logActualDuration: publicProcedure
    .input(z.object({ meetingId: z.string(), actualMinutes: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.meetingEvent.update({
        where: { id: input.meetingId },
        data: { actualDurationMins: input.actualMinutes },
      });
      if (meeting.timeEntryId) {
        await ctx.db.timeEntry.update({ where: { id: meeting.timeEntryId }, data: { duration: input.actualMinutes } });
      }
      return meeting;
    }),

  linkToMatter: publicProcedure
    .input(z.object({ meetingId: z.string(), matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.meetingEvent.update({ where: { id: input.meetingId }, data: { matterId: input.matterId } });
    }),
});
