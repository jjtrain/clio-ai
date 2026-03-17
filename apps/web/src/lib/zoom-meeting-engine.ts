import { db } from "@/lib/db";
import * as zoom from "@/lib/integrations/zoom";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function createMeetingForAppointment(appointmentId: string, templateId?: string) {
  const appt = await db.appointment.findUniqueOrThrow({ where: { id: appointmentId } });
  const template = templateId ? await db.meetingTemplate.findUnique({ where: { id: templateId } }) : null;

  const topic = `Consultation: ${appt.clientName}${appt.practiceArea ? ` — ${appt.practiceArea}` : ""}`;
  const result = await zoom.createMeeting({
    topic,
    agenda: template?.defaultAgenda || appt.notes || undefined,
    startTime: appt.startTime.toISOString(),
    duration: template?.defaultDuration || appt.duration,
    waitingRoom: template?.waitingRoom ?? true,
    muteOnEntry: template?.muteOnEntry ?? true,
    autoRecording: template?.autoRecord === "CLOUD" ? "cloud" : template?.autoRecord === "LOCAL" ? "local" : "none",
  });

  if (!result.success || !result.data) throw new Error(result.error || "Failed to create Zoom meeting");

  const meeting = await db.zoomMeeting.create({
    data: {
      zoomMeetingId: String(result.data.id),
      zoomUUID: result.data.uuid,
      hostEmail: result.data.host_email,
      appointmentId,
      topic,
      agenda: template?.defaultAgenda || appt.notes || undefined,
      startTime: appt.startTime,
      endTime: appt.endTime,
      scheduledDuration: appt.duration,
      joinUrl: result.data.join_url,
      startUrl: result.data.start_url,
      password: result.data.password,
      waitingRoomEnabled: template?.waitingRoom ?? true,
      muteOnEntry: template?.muteOnEntry ?? true,
      autoRecording: template?.autoRecord || "NONE",
    },
  });

  if (template) await db.meetingTemplate.update({ where: { id: template.id }, data: { usageCount: { increment: 1 } } });

  return meeting;
}

export async function createMeetingForMatter(params: {
  matterId: string; topic: string; startTime: string; duration: number;
  attendees: Array<{ name: string; email: string }>; templateId?: string; agenda?: string;
}) {
  const matter = await db.matter.findUniqueOrThrow({ where: { id: params.matterId }, include: { client: true } });
  const template = params.templateId ? await db.meetingTemplate.findUnique({ where: { id: params.templateId } }) : null;

  const result = await zoom.createMeeting({
    topic: params.topic,
    agenda: params.agenda || template?.defaultAgenda || undefined,
    startTime: params.startTime,
    duration: params.duration || template?.defaultDuration || 30,
    waitingRoom: template?.waitingRoom ?? undefined,
    muteOnEntry: template?.muteOnEntry ?? undefined,
    autoRecording: template?.autoRecord === "CLOUD" ? "cloud" : template?.autoRecord === "LOCAL" ? "local" : "none",
  });

  if (!result.success || !result.data) throw new Error(result.error || "Failed to create Zoom meeting");

  const endTime = new Date(new Date(params.startTime).getTime() + (params.duration || 30) * 60000);

  const calEvent = await db.calendarEvent.create({
    data: {
      matterId: params.matterId, title: params.topic,
      description: `Zoom Meeting\nJoin: ${result.data.join_url}\n\n${params.agenda || ""}`,
      startTime: new Date(params.startTime), endTime, location: result.data.join_url,
    },
  });

  const meeting = await db.zoomMeeting.create({
    data: {
      zoomMeetingId: String(result.data.id), zoomUUID: result.data.uuid,
      hostEmail: result.data.host_email, matterId: params.matterId, clientId: matter.clientId,
      calendarEventId: calEvent.id, topic: params.topic, agenda: params.agenda || template?.defaultAgenda || undefined,
      startTime: new Date(params.startTime), endTime, scheduledDuration: params.duration || 30,
      joinUrl: result.data.join_url, startUrl: result.data.start_url, password: result.data.password,
      waitingRoomEnabled: template?.waitingRoom ?? true, muteOnEntry: template?.muteOnEntry ?? true,
      autoRecording: template?.autoRecord || "NONE",
    },
  });

  if (template) await db.meetingTemplate.update({ where: { id: template.id }, data: { usageCount: { increment: 1 } } });

  return meeting;
}

export async function createInstantMeeting(params: { topic: string; matterId?: string; clientId?: string }) {
  const result = await zoom.createMeeting({
    topic: params.topic, startTime: new Date().toISOString(), duration: 30,
  });
  if (!result.success || !result.data) throw new Error(result.error || "Failed");

  const meeting = await db.zoomMeeting.create({
    data: {
      zoomMeetingId: String(result.data.id), zoomUUID: result.data.uuid,
      hostEmail: result.data.host_email, matterId: params.matterId, clientId: params.clientId,
      topic: params.topic, meetingType: "INSTANT", startTime: new Date(), scheduledDuration: 30,
      joinUrl: result.data.join_url, startUrl: result.data.start_url, password: result.data.password,
    },
  });
  return meeting;
}

export async function createRecurringMeeting(params: {
  matterId?: string; topic: string; startTime: string; duration: number;
  recurrence: { type: string; dayOfWeek?: number; dayOfMonth?: number; endAfter: number };
  attendees: Array<{ name: string; email: string }>; templateId?: string;
}) {
  const recurrenceType = params.recurrence.type === "weekly" ? 2 : params.recurrence.type === "biweekly" ? 2 : 3;
  const repeatInterval = params.recurrence.type === "biweekly" ? 2 : 1;

  const result = await zoom.createMeeting({
    topic: params.topic, startTime: params.startTime, duration: params.duration,
    recurrence: {
      type: recurrenceType, repeat_interval: repeatInterval,
      end_times: params.recurrence.endAfter,
      weekly_days: params.recurrence.dayOfWeek?.toString(),
      monthly_day: params.recurrence.dayOfMonth,
    },
  });
  if (!result.success || !result.data) throw new Error(result.error || "Failed");

  const meeting = await db.zoomMeeting.create({
    data: {
      zoomMeetingId: String(result.data.id), zoomUUID: result.data.uuid,
      hostEmail: result.data.host_email, matterId: params.matterId,
      topic: params.topic, meetingType: "RECURRING_FIXED", startTime: new Date(params.startTime),
      scheduledDuration: params.duration, joinUrl: result.data.join_url, startUrl: result.data.start_url,
      password: result.data.password, recurrence: JSON.stringify(params.recurrence),
    },
  });
  return meeting;
}

export async function processRecordingReady(meetingId: string) {
  const meeting = await db.zoomMeeting.findUniqueOrThrow({ where: { id: meetingId } });
  if (!meeting.zoomUUID) return { processed: false, error: "No UUID" };

  const recordings = await zoom.getRecordings(meeting.zoomUUID);
  if (!recordings.success) return { processed: false, error: recordings.error };

  const files = recordings.data?.recording_files || [];
  const docIds: string[] = [];

  for (const file of files) {
    if (meeting.matterId && file.download_url) {
      const doc = await db.document.create({
        data: {
          matterId: meeting.matterId!, name: `${meeting.topic} - ${file.file_type}`,
          filename: `${meeting.topic.replace(/[^a-zA-Z0-9]/g, "_")}_${file.file_type?.toLowerCase() || "file"}.${file.file_type === "MP4" ? "mp4" : file.file_type === "M4A" ? "m4a" : "txt"}`,
          mimeType: file.file_type === "MP4" ? "video/mp4" : file.file_type === "M4A" ? "audio/mp4" : "text/plain",
          size: file.file_size || 0, path: file.download_url || "",
        },
      });
      docIds.push(doc.id);
    }
  }

  // Get transcript
  const transcript = await zoom.getTranscript(meeting.zoomUUID);
  const chatMessages = await zoom.getChatMessages(meeting.zoomUUID);

  await db.zoomMeeting.update({
    where: { id: meetingId },
    data: {
      hasRecording: files.some((f: any) => f.file_type === "MP4" || f.file_type === "M4A"),
      hasTranscript: transcript.success,
      recordingFiles: JSON.stringify(files.map((f: any) => ({ fileId: f.id, fileType: f.file_type?.toLowerCase(), fileSize: f.file_size, downloadUrl: f.download_url, playUrl: f.play_url, recordingStart: f.recording_start, recordingEnd: f.recording_end }))),
      transcriptText: transcript.success ? transcript.data?.text : null,
      transcriptVTT: transcript.success ? transcript.data?.vtt : null,
      chatLog: chatMessages.success ? JSON.stringify(chatMessages.data) : null,
      recordingDocIds: docIds.length > 0 ? JSON.stringify(docIds) : null,
    },
  });

  // Auto-summarize
  const config = await db.videoIntegration.findUnique({ where: { provider: "ZOOM" } });
  if (config?.autoSummarize && transcript.success) {
    await summarizeMeeting(meetingId);
  }

  return { processed: true, files: files.length, hasTranscript: transcript.success, docIds };
}

export async function summarizeMeeting(meetingId: string) {
  const meeting = await db.zoomMeeting.findUniqueOrThrow({ where: { id: meetingId } });

  const content = meeting.transcriptText || meeting.chatLog || `Meeting: ${meeting.topic}\nParticipants: ${meeting.participantCount}\nDuration: ${meeting.actualDuration || meeting.scheduledDuration} minutes`;
  if (!content || content.length < 50) return { summary: "Insufficient data for summary" };

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 3000,
    system: `You are a legal assistant summarizing a meeting for a law firm. Based on the following meeting transcript, generate:

1. MEETING SUMMARY (3-5 paragraphs): Concise summary of what was discussed, decisions made, and outcomes. Focus on legally relevant content.

2. KEY DECISIONS: Format as JSON array: [{"decision":"...","context":"...","participants":"..."}]

3. ACTION ITEMS: Format as JSON array: [{"item":"...","assignedTo":"...","deadline":"...","priority":"high|medium|low"}]

4. FOLLOW-UP TASKS: Format as JSON array: [{"task":"...","assignedTo":"...","dueDate":"..."}]

Return as JSON: {"summary":"markdown text","decisions":[...],"actionItems":[...],"followUps":[...]}`,
    messages: [{ role: "user", content: `Meeting: ${meeting.topic}\nDate: ${meeting.startTime.toISOString()}\nDuration: ${meeting.actualDuration || meeting.scheduledDuration} min\n\nTranscript/Content:\n${content.slice(0, 50000)}` }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  let parsed: any;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: text };
  } catch {
    parsed = { summary: text };
  }

  await db.zoomMeeting.update({
    where: { id: meetingId },
    data: {
      aiSummary: parsed.summary || text,
      aiActionItems: parsed.actionItems ? JSON.stringify(parsed.actionItems) : null,
      aiKeyDecisions: parsed.decisions ? JSON.stringify(parsed.decisions) : null,
      aiFollowUps: parsed.followUps ? JSON.stringify(parsed.followUps) : null,
    },
  });

  // Save summary as document
  if (meeting.matterId && parsed.summary) {
    const doc = await db.document.create({
      data: { matterId: meeting.matterId!, name: `Meeting Summary: ${meeting.topic}`, filename: `summary_${meeting.topic.replace(/[^a-zA-Z0-9]/g, "_")}.md`, mimeType: "text/markdown", size: parsed.summary.length, path: "" },
    });
    await db.zoomMeeting.update({ where: { id: meetingId }, data: { summaryDocId: doc.id } });
  }

  return { summary: parsed.summary, actionItems: parsed.actionItems, decisions: parsed.decisions, followUps: parsed.followUps };
}

export async function autoLogTime(meetingId: string) {
  const meeting = await db.zoomMeeting.findUniqueOrThrow({ where: { id: meetingId } });
  if (!meeting.matterId) throw new Error("Meeting not linked to a matter");

  const durationMinutes = meeting.actualDuration || meeting.scheduledDuration;
  const hours = durationMinutes / 60;
  const description = meeting.aiSummary
    ? `Video conference: ${meeting.topic} (${hours.toFixed(1)} hrs) — ${meeting.aiSummary.slice(0, 200)}`
    : `Video conference: ${meeting.topic} (${hours.toFixed(1)} hrs)`;

  // Get a user to assign the time entry to
  const user = await db.user.findFirst();
  if (!user) throw new Error("No user found");

  const entry = await db.timeEntry.create({
    data: {
      matterId: meeting.matterId, userId: user.id,
      description: description.slice(0, 500),
      duration: durationMinutes, date: meeting.startTime, billable: true,
    },
  });

  await db.zoomMeeting.update({ where: { id: meetingId }, data: { timeEntryId: entry.id, billableTime: durationMinutes } });
  return entry;
}

export async function createTasksFromActionItems(meetingId: string) {
  const meeting = await db.zoomMeeting.findUniqueOrThrow({ where: { id: meetingId } });
  if (!meeting.aiActionItems) return [];

  const items = JSON.parse(meeting.aiActionItems);
  const tasks = [];

  for (const item of items) {
    const task = await db.task.create({
      data: {
        matterId: meeting.matterId,
        title: (item.item || item.task || "Follow-up from meeting").slice(0, 200),
        description: `From Zoom meeting: ${meeting.topic}\n${item.item || item.task || ""}`,
        status: "NOT_STARTED",
        priority: item.priority === "high" ? "HIGH" : item.priority === "low" ? "LOW" : "MEDIUM",
        dueDate: item.deadline ? new Date(item.deadline) : new Date(Date.now() + 7 * 86400000),
      },
    });
    tasks.push(task);
  }
  return tasks;
}

export async function sendFollowUpEmail(meetingId: string) {
  const meeting = await db.zoomMeeting.findUniqueOrThrow({ where: { id: meetingId }, include: { client: true } });
  if (!meeting.client?.email) return { sent: false, error: "No client email" };

  const summary = meeting.aiSummary || `Thank you for meeting with us regarding ${meeting.topic}.`;
  const actionItems = meeting.aiActionItems ? JSON.parse(meeting.aiActionItems) : [];

  const body = `Dear ${meeting.client.name},\n\nThank you for meeting with us today.\n\n## Summary\n${summary}\n\n## Next Steps\n${actionItems.map((a: any, i: number) => `${i + 1}. ${a.item || a.task}`).join("\n")}\n\nPlease let us know if you have any questions.\n\nBest regards`;

  return { sent: true, to: meeting.client.email, subject: `Follow-up: ${meeting.topic}`, body };
}

export async function searchTranscripts(query: string, matterId?: string) {
  const where: any = { transcriptText: { not: null } };
  if (matterId) where.matterId = matterId;

  const meetings = await db.zoomMeeting.findMany({ where, orderBy: { startTime: "desc" }, take: 50 });
  const results = [];

  for (const m of meetings) {
    const text = m.transcriptText || "";
    const lowerText = text.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerText.indexOf(lowerQuery);
    if (idx >= 0) {
      const start = Math.max(0, idx - 100);
      const end = Math.min(text.length, idx + query.length + 100);
      results.push({ meetingId: m.id, topic: m.topic, date: m.startTime, excerpt: "..." + text.slice(start, end) + "...", matterId: m.matterId });
    }
  }
  return results;
}

export async function compareTranscripts(meetingId1: string, meetingId2: string) {
  const m1 = await db.zoomMeeting.findUniqueOrThrow({ where: { id: meetingId1 } });
  const m2 = await db.zoomMeeting.findUniqueOrThrow({ where: { id: meetingId2 } });

  if (!m1.transcriptText || !m2.transcriptText) throw new Error("Both meetings must have transcripts");

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    system: "You are a legal analyst comparing two meeting transcripts for a law firm. Identify: new positions stated, changed positions, resolved items, new issues raised, and key differences. Use markdown.",
    messages: [{
      role: "user",
      content: `Meeting 1 (${m1.topic}, ${m1.startTime.toLocaleDateString()}):\n${m1.transcriptText.slice(0, 20000)}\n\nMeeting 2 (${m2.topic}, ${m2.startTime.toLocaleDateString()}):\n${m2.transcriptText.slice(0, 20000)}`,
    }],
  });

  return message.content[0].type === "text" ? message.content[0].text : "";
}

export async function getMeetingStats(dateRange: { from: string; to: string }) {
  const where = { startTime: { gte: new Date(dateRange.from), lte: new Date(dateRange.to) } };

  const meetings = await db.zoomMeeting.findMany({ where, include: { matter: true } });
  const totalMeetings = meetings.length;
  const totalMinutes = meetings.reduce((s, m) => s + (m.actualDuration || m.scheduledDuration), 0);
  const totalHours = totalMinutes / 60;
  const withRecording = meetings.filter(m => m.hasRecording).length;
  const withTranscript = meetings.filter(m => m.hasTranscript).length;
  const withSummary = meetings.filter(m => m.aiSummary).length;

  const byMatter: Record<string, { name: string; count: number; hours: number }> = {};
  for (const m of meetings) {
    if (m.matterId) {
      const key = m.matterId;
      if (!byMatter[key]) byMatter[key] = { name: m.matter?.name || "Unknown", count: 0, hours: 0 };
      byMatter[key].count++;
      byMatter[key].hours += (m.actualDuration || m.scheduledDuration) / 60;
    }
  }

  return {
    totalMeetings, totalHours: Math.round(totalHours * 10) / 10,
    avgDuration: totalMeetings > 0 ? Math.round(totalMinutes / totalMeetings) : 0,
    avgParticipants: totalMeetings > 0 ? Math.round(meetings.reduce((s, m) => s + m.participantCount, 0) / totalMeetings) : 0,
    recordingRate: totalMeetings > 0 ? Math.round((withRecording / totalMeetings) * 100) : 0,
    transcriptRate: totalMeetings > 0 ? Math.round((withTranscript / totalMeetings) * 100) : 0,
    summaryRate: totalMeetings > 0 ? Math.round((withSummary / totalMeetings) * 100) : 0,
    byMatter: Object.values(byMatter).sort((a, b) => b.hours - a.hours),
  };
}

export async function handleMeetingEndPostProcessing(meetingId: string) {
  const meeting = await db.zoomMeeting.findUniqueOrThrow({ where: { id: meetingId } });
  const results: Record<string, any> = {};

  // Pull participants
  if (meeting.zoomUUID) {
    const participants = await zoom.getMeetingParticipants(meeting.zoomUUID);
    if (participants.success) {
      const list = participants.data?.participants || [];
      await db.zoomMeeting.update({
        where: { id: meetingId },
        data: {
          participants: JSON.stringify(list.map((p: any) => ({ name: p.name, email: p.user_email, joinTime: p.join_time, leaveTime: p.leave_time, duration: p.duration }))),
          participantCount: list.length,
        },
      });
      results.participants = list.length;
    }
  }

  // Process recording if available
  if (meeting.hasRecording || meeting.autoRecording === "CLOUD") {
    try {
      results.recording = await processRecordingReady(meetingId);
    } catch (err: any) {
      results.recording = { error: err.message };
    }
  } else if (!meeting.hasRecording) {
    // No recording, try to summarize from what we have
    try {
      results.summary = await summarizeMeeting(meetingId);
    } catch (err: any) {
      results.summary = { error: err.message };
    }
  }

  // Auto-log time
  const config = await db.videoIntegration.findUnique({ where: { provider: "ZOOM" } });
  if (meeting.matterId && !meeting.timeEntryId) {
    try {
      results.timeEntry = await autoLogTime(meetingId);
    } catch (err: any) {
      results.timeEntry = { error: err.message };
    }
  }

  return results;
}

export async function initializeDefaultTemplates() {
  const count = await db.meetingTemplate.count();
  if (count > 0) return { initialized: false, message: "Templates already exist" };

  const templates = [
    { name: "Client Consultation", defaultDuration: 30, defaultAgenda: "Initial consultation to discuss your legal matter", waitingRoom: true, muteOnEntry: true, autoRecord: "CLOUD" as const, autoSummarize: true, autoLogTime: true, billingActivityCode: "CONSULTATION", meetingType: "consultation", followUpTemplate: "Thank you for the consultation. Here is a summary of what we discussed: [summary]. Next steps: [action_items]." },
    { name: "Deposition Prep", defaultDuration: 60, defaultAgenda: "Preparation session for upcoming deposition", waitingRoom: false, muteOnEntry: false, autoRecord: "CLOUD" as const, autoSummarize: true, autoLogTime: true, billingActivityCode: "DEPO_PREP", meetingType: "deposition_prep", practiceArea: "Litigation" },
    { name: "Settlement Negotiation", defaultDuration: 60, defaultAgenda: "Settlement discussion", waitingRoom: true, autoRecord: "CLOUD" as const, autoSummarize: true, autoLogTime: true, billingActivityCode: "NEGOTIATION", meetingType: "settlement" },
    { name: "Team Case Review", defaultDuration: 30, defaultAgenda: "Internal case review and strategy discussion", waitingRoom: false, muteOnEntry: true, autoRecord: "NONE" as const, autoSummarize: true, autoLogTime: false, meetingType: "case_review" },
    { name: "Client Update Call", defaultDuration: 15, defaultAgenda: "Case status update", waitingRoom: true, muteOnEntry: true, autoRecord: "NONE" as const, autoSummarize: true, autoLogTime: true, billingActivityCode: "CLIENT_COMM", meetingType: "client_update", followUpTemplate: "Thank you for joining today's update call. Here's what we covered: [summary]." },
    { name: "Mediation Session", defaultDuration: 120, defaultAgenda: "Mediation session", waitingRoom: true, autoRecord: "NONE" as const, autoSummarize: false, autoLogTime: true, billingActivityCode: "MEDIATION", meetingType: "mediation", breakoutRooms: JSON.stringify([{ name: "Plaintiff Caucus" }, { name: "Defendant Caucus" }, { name: "Mediator Room" }]) },
  ];

  await db.meetingTemplate.createMany({ data: templates as any[] });
  return { initialized: true, count: templates.length };
}
