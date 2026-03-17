import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import * as zoom from "@/lib/integrations/zoom";
import * as engine from "@/lib/zoom-meeting-engine";

const MEETING_STATUS = ["WAITING", "STARTED", "ENDED", "CANCELLED"] as const;
const RECORDING_TYPE = ["NONE", "LOCAL", "CLOUD"] as const;

export const zoomRouter = router({
  // ─── Settings ──────────────────────────────────────────────
  "settings.get": publicProcedure.query(async ({ ctx }) => {
    return ctx.db.videoIntegration.findUnique({ where: { provider: "ZOOM" } });
  }),

  "settings.update": publicProcedure
    .input(z.object({
      displayName: z.string().optional(), apiKey: z.string().nullable().optional(),
      apiSecret: z.string().nullable().optional(), accountId: z.string().nullable().optional(),
      userId: z.string().nullable().optional(), isEnabled: z.boolean().optional(),
      webhookSecret: z.string().nullable().optional(), webhookVerificationToken: z.string().nullable().optional(),
      defaultMeetingDuration: z.number().optional(), defaultWaitingRoom: z.boolean().optional(),
      defaultRecordMeeting: z.boolean().optional(), defaultAutoTranscribe: z.boolean().optional(),
      defaultMuteOnEntry: z.boolean().optional(), defaultPassword: z.boolean().optional(),
      autoCreateForAppointments: z.boolean().optional(), autoSaveRecordings: z.boolean().optional(),
      autoSaveTranscripts: z.boolean().optional(), autoSummarize: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.videoIntegration.upsert({
        where: { provider: "ZOOM" },
        create: { provider: "ZOOM", displayName: input.displayName || "Zoom", ...input },
        update: input,
      });
    }),

  "settings.test": publicProcedure.mutation(async () => zoom.testConnection()),

  "settings.getDefaults": publicProcedure.query(async () => zoom.getUserSettings()),

  "settings.updateDefaults": publicProcedure
    .input(z.object({ settings: z.any() }))
    .mutation(async ({ input }) => {
      // Not implemented directly — user settings updated via Zoom dashboard
      return { success: true, message: "Update default settings via Zoom dashboard" };
    }),

  // ─── Meetings ──────────────────────────────────────────────
  "meetings.list": publicProcedure
    .input(z.object({
      matterId: z.string().optional(), clientId: z.string().optional(),
      status: z.enum(MEETING_STATUS).optional(), hasRecording: z.boolean().optional(),
      hasTranscript: z.boolean().optional(), search: z.string().optional(),
      startDate: z.string().optional(), endDate: z.string().optional(),
      limit: z.number().default(50),
    }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.matterId) where.matterId = input.matterId;
      if (input?.clientId) where.clientId = input.clientId;
      if (input?.status) where.status = input.status;
      if (input?.hasRecording !== undefined) where.hasRecording = input.hasRecording;
      if (input?.hasTranscript !== undefined) where.hasTranscript = input.hasTranscript;
      if (input?.search) where.topic = { contains: input.search, mode: "insensitive" };
      if (input?.startDate || input?.endDate) {
        where.startTime = {};
        if (input?.startDate) where.startTime.gte = new Date(input.startDate);
        if (input?.endDate) where.startTime.lte = new Date(input.endDate);
      }
      return ctx.db.zoomMeeting.findMany({
        where, include: { matter: true, client: true },
        orderBy: { startTime: "desc" }, take: input?.limit || 50,
      });
    }),

  "meetings.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.zoomMeeting.findUniqueOrThrow({
        where: { id: input.id },
        include: { matter: true, client: true, zoomRegistrants: true, recurringInstances: { orderBy: { startTime: "desc" }, take: 10 } },
      });
    }),

  "meetings.create": publicProcedure
    .input(z.object({
      topic: z.string(), startTime: z.string(), duration: z.number().default(30),
      matterId: z.string().optional(), clientId: z.string().optional(),
      attendees: z.array(z.object({ name: z.string(), email: z.string() })).optional(),
      agenda: z.string().optional(), templateId: z.string().optional(),
      autoRecord: z.enum(RECORDING_TYPE).optional(),
      waitingRoom: z.boolean().optional(), muteOnEntry: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      if (input.matterId) {
        return engine.createMeetingForMatter({
          matterId: input.matterId, topic: input.topic, startTime: input.startTime,
          duration: input.duration, attendees: input.attendees || [],
          templateId: input.templateId, agenda: input.agenda,
        });
      }
      // No matter — create standalone
      const result = await zoom.createMeeting({
        topic: input.topic, startTime: input.startTime, duration: input.duration,
        agenda: input.agenda, waitingRoom: input.waitingRoom, muteOnEntry: input.muteOnEntry,
        autoRecording: input.autoRecord === "CLOUD" ? "cloud" : input.autoRecord === "LOCAL" ? "local" : "none",
      });
      if (!result.success || !result.data) throw new Error(result.error || "Failed");
      const meeting = await db.zoomMeeting.create({
        data: {
          zoomMeetingId: String(result.data.id), zoomUUID: result.data.uuid,
          hostEmail: result.data.host_email, clientId: input.clientId,
          topic: input.topic, agenda: input.agenda, startTime: new Date(input.startTime),
          scheduledDuration: input.duration, joinUrl: result.data.join_url,
          startUrl: result.data.start_url, password: result.data.password,
        },
      });
      return meeting;
    }),

  "meetings.createForAppointment": publicProcedure
    .input(z.object({ appointmentId: z.string(), templateId: z.string().optional() }))
    .mutation(async ({ input }) => engine.createMeetingForAppointment(input.appointmentId, input.templateId)),

  "meetings.createInstant": publicProcedure
    .input(z.object({ topic: z.string(), matterId: z.string().optional(), clientId: z.string().optional() }))
    .mutation(async ({ input }) => engine.createInstantMeeting(input)),

  "meetings.createRecurring": publicProcedure
    .input(z.object({
      topic: z.string(), startTime: z.string(), duration: z.number(),
      recurrence: z.object({ type: z.string(), dayOfWeek: z.number().optional(), dayOfMonth: z.number().optional(), endAfter: z.number() }),
      matterId: z.string().optional(), attendees: z.array(z.object({ name: z.string(), email: z.string() })).optional(),
      templateId: z.string().optional(),
    }))
    .mutation(async ({ input }) => engine.createRecurringMeeting({ ...input, attendees: input.attendees || [] })),

  "meetings.update": publicProcedure
    .input(z.object({ id: z.string(), topic: z.string().optional(), startTime: z.string().optional(), duration: z.number().optional(), agenda: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      const updates: any = {};
      if (input.topic) updates.topic = input.topic;
      if (input.startTime) { updates.start_time = input.startTime; updates.timezone = meeting.timezone; }
      if (input.duration) updates.duration = input.duration;
      if (input.agenda) updates.agenda = input.agenda;
      await zoom.updateMeeting(meeting.zoomMeetingId, updates);
      const { id, ...data } = input;
      const dbUpdates: any = {};
      if (data.topic) dbUpdates.topic = data.topic;
      if (data.startTime) dbUpdates.startTime = new Date(data.startTime);
      if (data.duration) dbUpdates.scheduledDuration = data.duration;
      if (data.agenda) dbUpdates.agenda = data.agenda;
      return ctx.db.zoomMeeting.update({ where: { id }, data: dbUpdates });
    }),

  "meetings.cancel": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      await zoom.deleteMeeting(meeting.zoomMeetingId);
      return ctx.db.zoomMeeting.update({ where: { id: input.id }, data: { status: "CANCELLED" } });
    }),

  "meetings.end": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      await zoom.endMeeting(meeting.zoomMeetingId);
      return ctx.db.zoomMeeting.update({ where: { id: input.id }, data: { status: "ENDED", endTime: new Date() } });
    }),

  "meetings.getJoinUrl": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const m = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      return { joinUrl: m.joinUrl, password: m.password };
    }),

  "meetings.getUpcoming": publicProcedure.query(async ({ ctx }) => {
    return ctx.db.zoomMeeting.findMany({
      where: { status: "WAITING", startTime: { gte: new Date() } },
      include: { matter: true, client: true }, orderBy: { startTime: "asc" }, take: 20,
    });
  }),

  "meetings.getLive": publicProcedure.query(async ({ ctx }) => {
    return ctx.db.zoomMeeting.findMany({
      where: { status: "STARTED" },
      include: { matter: true, client: true }, orderBy: { startTime: "desc" },
    });
  }),

  "meetings.linkToMatter": publicProcedure
    .input(z.object({ id: z.string(), matterId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const matter = await ctx.db.matter.findUniqueOrThrow({ where: { id: input.matterId } });
      return ctx.db.zoomMeeting.update({ where: { id: input.id }, data: { matterId: input.matterId, clientId: matter.clientId } });
    }),

  "meetings.linkToClient": publicProcedure
    .input(z.object({ id: z.string(), clientId: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.zoomMeeting.update({ where: { id: input.id }, data: { clientId: input.clientId } })),

  // ─── Participants & Registration ───────────────────────────
  "participants.list": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const m = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      return m.participants ? JSON.parse(m.participants) : [];
    }),

  "participants.analytics": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const m = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      const participants = m.participants ? JSON.parse(m.participants) : [];
      return { total: participants.length, participants: participants.map((p: any) => ({ ...p, durationMin: p.duration ? Math.round(p.duration / 60) : null })) };
    }),

  "registrants.list": publicProcedure
    .input(z.object({ meetingId: z.string(), status: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      const where: any = { meetingId: input.meetingId };
      if (input.status) where.status = input.status;
      return ctx.db.zoomRegistrant.findMany({ where, orderBy: { registeredAt: "desc" } });
    }),

  "registrants.add": publicProcedure
    .input(z.object({ meetingId: z.string(), firstName: z.string(), lastName: z.string(), email: z.string(), phone: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.meetingId } });
      const result = await zoom.addRegistrant(meeting.zoomMeetingId, input);
      if (!result.success) throw new Error(result.error);
      return ctx.db.zoomRegistrant.create({
        data: { meetingId: input.meetingId, zoomRegistrantId: result.data?.registrant_id, firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone, joinUrl: result.data?.join_url },
      });
    }),

  "registrants.approve": publicProcedure
    .input(z.object({ meetingId: z.string(), registrantId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const reg = await ctx.db.zoomRegistrant.findUniqueOrThrow({ where: { id: input.registrantId } });
      const meeting = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.meetingId } });
      if (reg.zoomRegistrantId) await zoom.approveRegistrant(meeting.zoomMeetingId, reg.zoomRegistrantId);
      return ctx.db.zoomRegistrant.update({ where: { id: input.registrantId }, data: { status: "APPROVED", approvedAt: new Date() } });
    }),

  "registrants.deny": publicProcedure
    .input(z.object({ meetingId: z.string(), registrantId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const reg = await ctx.db.zoomRegistrant.findUniqueOrThrow({ where: { id: input.registrantId } });
      const meeting = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.meetingId } });
      if (reg.zoomRegistrantId) await zoom.denyRegistrant(meeting.zoomMeetingId, reg.zoomRegistrantId);
      return ctx.db.zoomRegistrant.update({ where: { id: input.registrantId }, data: { status: "DENIED" } });
    }),

  "registrants.bulkAdd": publicProcedure
    .input(z.object({ meetingId: z.string(), registrants: z.array(z.object({ firstName: z.string(), lastName: z.string(), email: z.string() })) }))
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.meetingId } });
      const results = [];
      for (const r of input.registrants) {
        const result = await zoom.addRegistrant(meeting.zoomMeetingId, r);
        const reg = await ctx.db.zoomRegistrant.create({
          data: { meetingId: input.meetingId, zoomRegistrantId: result.data?.registrant_id, firstName: r.firstName, lastName: r.lastName, email: r.email, joinUrl: result.data?.join_url },
        });
        results.push(reg);
      }
      return results;
    }),

  // ─── Recordings & Transcripts ──────────────────────────────
  "recordings.list": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const m = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      return m.recordingFiles ? JSON.parse(m.recordingFiles) : [];
    }),

  "recordings.listAll": publicProcedure
    .input(z.object({ from: z.string().optional(), to: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = { hasRecording: true };
      if (input?.from || input?.to) {
        where.startTime = {};
        if (input?.from) where.startTime.gte = new Date(input.from);
        if (input?.to) where.startTime.lte = new Date(input.to);
      }
      return ctx.db.zoomMeeting.findMany({
        where, include: { matter: true }, orderBy: { startTime: "desc" }, take: 100,
      });
    }),

  "recordings.download": publicProcedure
    .input(z.object({ id: z.string(), fileId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const m = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      const files = m.recordingFiles ? JSON.parse(m.recordingFiles) : [];
      const file = files.find((f: any) => f.fileId === input.fileId);
      if (!file?.downloadUrl) throw new Error("File not found");
      return { downloadUrl: file.downloadUrl, fileType: file.fileType };
    }),

  "recordings.downloadAll": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => engine.processRecordingReady(input.id)),

  "recordings.delete": publicProcedure
    .input(z.object({ id: z.string(), fileId: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const m = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      if (!m.zoomUUID) throw new Error("No UUID");
      return zoom.deleteRecording(m.zoomUUID, input.fileId);
    }),

  "recordings.getTranscript": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const m = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      if (m.transcriptText) return { text: m.transcriptText, vtt: m.transcriptVTT };
      if (!m.zoomUUID) return { text: null, vtt: null };
      const result = await zoom.getTranscript(m.zoomUUID);
      if (result.success && result.data) {
        await ctx.db.zoomMeeting.update({ where: { id: input.id }, data: { transcriptText: result.data.text, transcriptVTT: result.data.vtt, hasTranscript: true } });
        return { text: result.data.text, vtt: result.data.vtt, segments: result.data.segments };
      }
      return { text: null, vtt: null };
    }),

  "recordings.getChatLog": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const m = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      return m.chatLog ? JSON.parse(m.chatLog) : [];
    }),

  "recordings.process": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => engine.processRecordingReady(input.id)),

  // ─── AI Features ───────────────────────────────────────────
  "ai.summarize": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => engine.summarizeMeeting(input.id)),

  "ai.regenerateSummary": publicProcedure
    .input(z.object({ id: z.string(), instructions: z.string().optional() }))
    .mutation(async ({ input }) => engine.summarizeMeeting(input.id)),

  "ai.getActionItems": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const m = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      return m.aiActionItems ? JSON.parse(m.aiActionItems) : [];
    }),

  "ai.createTasks": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => engine.createTasksFromActionItems(input.id)),

  "ai.getDecisions": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const m = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      return m.aiKeyDecisions ? JSON.parse(m.aiKeyDecisions) : [];
    }),

  "ai.getFollowUps": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const m = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      return m.aiFollowUps ? JSON.parse(m.aiFollowUps) : [];
    }),

  "ai.sendFollowUp": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => engine.sendFollowUpEmail(input.id)),

  "ai.searchTranscripts": publicProcedure
    .input(z.object({ query: z.string(), matterId: z.string().optional() }))
    .query(async ({ input }) => engine.searchTranscripts(input.query, input.matterId)),

  "ai.compareTranscripts": publicProcedure
    .input(z.object({ meetingId1: z.string(), meetingId2: z.string() }))
    .mutation(async ({ input }) => engine.compareTranscripts(input.meetingId1, input.meetingId2)),

  "ai.generateBillingNarrative": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const m = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      const hours = ((m.actualDuration || m.scheduledDuration) / 60).toFixed(1);
      const summary = m.aiSummary ? m.aiSummary.slice(0, 200) : m.topic;
      return { narrative: `Video conference: ${m.topic} (${hours} hrs) — ${summary}`, duration: m.actualDuration || m.scheduledDuration, billable: true };
    }),

  // ─── Time Logging ──────────────────────────────────────────
  "time.autoLog": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => engine.autoLogTime(input.id)),

  "time.preview": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const m = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id }, include: { matter: true } });
      const duration = m.actualDuration || m.scheduledDuration;
      return { duration, description: `Video conference: ${m.topic}`, matter: m.matter?.name, billable: true };
    }),

  "time.adjustAndLog": publicProcedure
    .input(z.object({ id: z.string(), adjustedDuration: z.number().optional(), adjustedDescription: z.string().optional(), billable: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => {
      const m = await ctx.db.zoomMeeting.findUniqueOrThrow({ where: { id: input.id } });
      if (!m.matterId) throw new Error("Meeting not linked to a matter");
      const user = await ctx.db.user.findFirst();
      if (!user) throw new Error("No user");
      const duration = input.adjustedDuration || m.actualDuration || m.scheduledDuration;
      const entry = await ctx.db.timeEntry.create({
        data: { matterId: m.matterId, userId: user.id, description: input.adjustedDescription || `Video conference: ${m.topic}`, duration, date: m.startTime, billable: input.billable ?? true },
      });
      await ctx.db.zoomMeeting.update({ where: { id: input.id }, data: { timeEntryId: entry.id, billableTime: duration } });
      return entry;
    }),

  // ─── Templates ─────────────────────────────────────────────
  "templates.list": publicProcedure
    .input(z.object({ practiceArea: z.string().optional(), meetingType: z.string().optional(), isActive: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where: any = {};
      if (input?.practiceArea) where.practiceArea = input.practiceArea;
      if (input?.meetingType) where.meetingType = input.meetingType;
      if (input?.isActive !== undefined) where.isActive = input.isActive;
      return ctx.db.meetingTemplate.findMany({ where, orderBy: { usageCount: "desc" } });
    }),

  "templates.get": publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => ctx.db.meetingTemplate.findUniqueOrThrow({ where: { id: input.id } })),

  "templates.create": publicProcedure
    .input(z.object({
      name: z.string(), description: z.string().optional(), defaultDuration: z.number().default(30),
      defaultAgenda: z.string().optional(), waitingRoom: z.boolean().optional(), muteOnEntry: z.boolean().optional(),
      autoRecord: z.enum(RECORDING_TYPE).optional(), requireRegistration: z.boolean().optional(),
      practiceArea: z.string().optional(), meetingType: z.string().optional(),
      autoSummarize: z.boolean().optional(), autoLogTime: z.boolean().optional(),
      billingActivityCode: z.string().optional(), followUpTemplate: z.string().optional(),
      breakoutRooms: z.string().optional(), registrationQuestions: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => ctx.db.meetingTemplate.create({ data: input })),

  "templates.update": publicProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), description: z.string().optional(), defaultDuration: z.number().optional(), defaultAgenda: z.string().optional(), waitingRoom: z.boolean().optional(), muteOnEntry: z.boolean().optional(), autoRecord: z.enum(RECORDING_TYPE).optional(), practiceArea: z.string().optional(), meetingType: z.string().optional(), autoSummarize: z.boolean().optional(), autoLogTime: z.boolean().optional(), billingActivityCode: z.string().optional(), followUpTemplate: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ ctx, input }) => { const { id, ...data } = input; return ctx.db.meetingTemplate.update({ where: { id }, data }); }),

  "templates.delete": publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => ctx.db.meetingTemplate.update({ where: { id: input.id }, data: { isActive: false } })),

  "templates.duplicate": publicProcedure
    .input(z.object({ id: z.string(), newName: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const t = await ctx.db.meetingTemplate.findUniqueOrThrow({ where: { id: input.id } });
      const { id, createdAt, updatedAt, usageCount, ...rest } = t;
      return ctx.db.meetingTemplate.create({ data: { ...rest, name: input.newName, usageCount: 0 } });
    }),

  "templates.initialize": publicProcedure.mutation(async () => engine.initializeDefaultTemplates()),

  // ─── Reports ───────────────────────────────────────────────
  "reports.stats": publicProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .query(async ({ input }) => engine.getMeetingStats(input)),

  "reports.byMatter": publicProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .query(async ({ ctx, input }) => {
      const meetings = await ctx.db.zoomMeeting.findMany({
        where: { startTime: { gte: new Date(input.from), lte: new Date(input.to) }, matterId: { not: null } },
        include: { matter: true },
      });
      const byMatter: Record<string, { name: string; count: number; hours: number; recordings: number }> = {};
      for (const m of meetings) {
        const key = m.matterId!;
        if (!byMatter[key]) byMatter[key] = { name: m.matter?.name || "Unknown", count: 0, hours: 0, recordings: 0 };
        byMatter[key].count++;
        byMatter[key].hours += (m.actualDuration || m.scheduledDuration) / 60;
        if (m.hasRecording) byMatter[key].recordings++;
      }
      return Object.entries(byMatter).map(([id, data]) => ({ matterId: id, ...data })).sort((a, b) => b.hours - a.hours);
    }),

  "reports.byParticipant": publicProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .query(async ({ ctx, input }) => {
      const meetings = await ctx.db.zoomMeeting.findMany({
        where: { startTime: { gte: new Date(input.from), lte: new Date(input.to) }, participants: { not: null } },
      });
      const byParticipant: Record<string, { name: string; email: string; meetings: number; totalMinutes: number }> = {};
      for (const m of meetings) {
        const participants = JSON.parse(m.participants || "[]");
        for (const p of participants) {
          const key = p.email || p.name;
          if (!byParticipant[key]) byParticipant[key] = { name: p.name, email: p.email || "", meetings: 0, totalMinutes: 0 };
          byParticipant[key].meetings++;
          byParticipant[key].totalMinutes += p.duration ? Math.round(p.duration / 60) : (m.actualDuration || m.scheduledDuration);
        }
      }
      return Object.values(byParticipant).sort((a, b) => b.meetings - a.meetings);
    }),

  "reports.timeLogged": publicProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .query(async ({ ctx, input }) => {
      const meetings = await ctx.db.zoomMeeting.findMany({
        where: { startTime: { gte: new Date(input.from), lte: new Date(input.to) }, status: "ENDED" },
      });
      const totalMeetingMinutes = meetings.reduce((s, m) => s + (m.actualDuration || m.scheduledDuration), 0);
      const loggedMinutes = meetings.filter(m => m.timeEntryId).reduce((s, m) => s + (m.billableTime || m.actualDuration || m.scheduledDuration), 0);
      return { totalMeetingMinutes, loggedMinutes, unloggedMinutes: totalMeetingMinutes - loggedMinutes, meetingsWithTimeEntry: meetings.filter(m => m.timeEntryId).length, meetingsWithoutTimeEntry: meetings.filter(m => !m.timeEntryId).length };
    }),

  "reports.recordingStorage": publicProcedure.query(async ({ ctx }) => {
    const meetings = await ctx.db.zoomMeeting.findMany({ where: { hasRecording: true } });
    let totalFiles = 0, totalSize = 0;
    for (const m of meetings) {
      const files = m.recordingFiles ? JSON.parse(m.recordingFiles) : [];
      totalFiles += files.length;
      totalSize += files.reduce((s: number, f: any) => s + (f.fileSize || 0), 0);
    }
    return { totalMeetings: meetings.length, totalFiles, totalSizeMB: Math.round(totalSize / 1048576) };
  }),

  "reports.export": publicProcedure
    .input(z.object({ from: z.string(), to: z.string(), format: z.enum(["csv", "pdf"]).default("csv") }))
    .mutation(async ({ input }) => ({ message: `Export for ${input.from} to ${input.to} in ${input.format} format will be generated.`, status: "pending" })),
});

// Need to import db for standalone meeting creation
import { db } from "@/lib/db";
