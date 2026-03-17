import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";
import crypto from "crypto";

const ZOOM_API = "https://api.zoom.us/v2";
const ZOOM_OAUTH = "https://zoom.us/oauth/token";

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getConfig() {
  const config = await db.videoIntegration.findUnique({ where: { provider: "ZOOM" } });
  if (!config?.isEnabled || !config?.apiKey || !config?.apiSecret) return null;
  return config;
}

export async function getAccessToken(): Promise<string | null> {
  const config = await getConfig();
  if (!config) return null;

  // Check cached token
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60000) {
    return cachedToken.token;
  }

  // Check DB token
  if (config.accessToken && config.tokenExpiresAt && new Date(config.tokenExpiresAt).getTime() > Date.now() + 60000) {
    cachedToken = { token: config.accessToken, expiresAt: new Date(config.tokenExpiresAt).getTime() };
    return config.accessToken;
  }

  // Request new token via Server-to-Server OAuth
  const credentials = Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString("base64");
  try {
    const res = await fetch(ZOOM_OAUTH, {
      method: "POST",
      headers: { Authorization: `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=account_credentials&account_id=${config.accountId}`,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;

    cachedToken = { token: data.access_token, expiresAt };
    await db.videoIntegration.update({
      where: { provider: "ZOOM" },
      data: { accessToken: data.access_token, tokenExpiresAt: new Date(expiresAt) },
    });
    return data.access_token;
  } catch {
    return null;
  }
}

async function zoomHeaders() {
  const token = await getAccessToken();
  if (!token) throw new Error("Zoom not configured or token unavailable");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function getUserId() {
  const config = await getConfig();
  return config?.userId || "me";
}

export async function testConnection() {
  try {
    const headers = await zoomHeaders();
    const userId = await getUserId();
    const res = await makeApiCall(`${ZOOM_API}/users/${userId}`, { headers });
    if (!res.ok) return { success: false, error: `Zoom API returned ${res.status}` };
    const data = await res.json();
    return { success: true, userName: `${data.first_name} ${data.last_name}`, email: data.email, accountId: data.account_id, plan: data.type, meetingCapacity: data.feature?.meeting_capacity };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function createMeeting(params: {
  topic: string; agenda?: string; startTime: string; duration: number; timezone?: string;
  password?: string; waitingRoom?: boolean; muteOnEntry?: boolean;
  autoRecording?: "none" | "local" | "cloud"; requireRegistration?: boolean;
  registrationQuestions?: Array<{ title: string; type: string; required: boolean }>;
  recurrence?: any; breakoutRooms?: Array<{ name: string; participants: string[] }>; settings?: any;
}) {
  const headers = await zoomHeaders();
  const userId = await getUserId();
  const config = await getConfig();

  const type = params.recurrence ? (params.recurrence.type ? 8 : 3) : 2; // 2=scheduled, 3=recurring no fixed, 8=recurring fixed

  const body: any = {
    topic: params.topic,
    type,
    start_time: params.startTime,
    duration: params.duration,
    timezone: params.timezone || "America/New_York",
    agenda: params.agenda,
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      mute_upon_entry: params.muteOnEntry ?? config?.defaultMuteOnEntry ?? true,
      waiting_room: params.waitingRoom ?? config?.defaultWaitingRoom ?? true,
      auto_recording: params.autoRecording || (config?.defaultRecordMeeting ? "cloud" : "none"),
      approval_type: params.requireRegistration ? 0 : 2,
      ...params.settings,
    },
  };
  if (params.password) body.password = params.password;
  if (params.recurrence) body.recurrence = params.recurrence;
  if (params.breakoutRooms?.length) {
    body.settings.breakout_room = { enable: true, rooms: params.breakoutRooms.map(r => ({ name: r.name, participants: r.participants })) };
  }

  const res = await makeApiCall(`${ZOOM_API}/users/${userId}/meetings`, {
    method: "POST", headers, body: JSON.stringify(body), timeout: 15000,
  });
  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `Create meeting failed: ${res.status} ${err}` };
  }
  const data = await res.json();
  return { success: true, data };
}

export async function getMeeting(meetingId: string) {
  const headers = await zoomHeaders();
  const res = await makeApiCall(`${ZOOM_API}/meetings/${meetingId}`, { headers });
  if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
  return { success: true, data: await res.json() };
}

export async function updateMeeting(meetingId: string, params: any) {
  const headers = await zoomHeaders();
  const res = await makeApiCall(`${ZOOM_API}/meetings/${meetingId}`, {
    method: "PATCH", headers, body: JSON.stringify(params),
  });
  if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
  return { success: true };
}

export async function deleteMeeting(meetingId: string) {
  const headers = await zoomHeaders();
  const res = await makeApiCall(`${ZOOM_API}/meetings/${meetingId}`, { method: "DELETE", headers });
  if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
  return { success: true };
}

export async function endMeeting(meetingId: string) {
  const headers = await zoomHeaders();
  const res = await makeApiCall(`${ZOOM_API}/meetings/${meetingId}/status`, {
    method: "PUT", headers, body: JSON.stringify({ action: "end" }),
  });
  if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
  return { success: true };
}

export async function listMeetings(params?: { type?: string; pageSize?: number; nextPageToken?: string }) {
  const headers = await zoomHeaders();
  const userId = await getUserId();
  const qs = new URLSearchParams();
  if (params?.type) qs.set("type", params.type);
  if (params?.pageSize) qs.set("page_size", params.pageSize.toString());
  if (params?.nextPageToken) qs.set("next_page_token", params.nextPageToken);
  const res = await makeApiCall(`${ZOOM_API}/users/${userId}/meetings?${qs}`, { headers });
  if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
  return { success: true, data: await res.json() };
}

export async function getMeetingParticipants(meetingUUID: string) {
  const headers = await zoomHeaders();
  const encoded = encodeURIComponent(encodeURIComponent(meetingUUID));
  const res = await makeApiCall(`${ZOOM_API}/past_meetings/${encoded}/participants?page_size=300`, { headers });
  if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
  return { success: true, data: await res.json() };
}

export async function addRegistrant(meetingId: string, params: { firstName: string; lastName: string; email: string; phone?: string; company?: string; customAnswers?: any[] }) {
  const headers = await zoomHeaders();
  const res = await makeApiCall(`${ZOOM_API}/meetings/${meetingId}/registrants`, {
    method: "POST", headers, body: JSON.stringify({ first_name: params.firstName, last_name: params.lastName, email: params.email, phone: params.phone, company: params.company, custom_questions: params.customAnswers }),
  });
  if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
  return { success: true, data: await res.json() };
}

export async function listRegistrants(meetingId: string, status?: string) {
  const headers = await zoomHeaders();
  const qs = status ? `?status=${status}` : "";
  const res = await makeApiCall(`${ZOOM_API}/meetings/${meetingId}/registrants${qs}`, { headers });
  if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
  return { success: true, data: await res.json() };
}

export async function approveRegistrant(meetingId: string, registrantId: string) {
  const headers = await zoomHeaders();
  const res = await makeApiCall(`${ZOOM_API}/meetings/${meetingId}/registrants/status`, {
    method: "PUT", headers, body: JSON.stringify({ action: "approve", registrants: [{ id: registrantId }] }),
  });
  if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
  return { success: true };
}

export async function denyRegistrant(meetingId: string, registrantId: string) {
  const headers = await zoomHeaders();
  const res = await makeApiCall(`${ZOOM_API}/meetings/${meetingId}/registrants/status`, {
    method: "PUT", headers, body: JSON.stringify({ action: "deny", registrants: [{ id: registrantId }] }),
  });
  if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
  return { success: true };
}

export async function getRecordings(meetingUUID: string) {
  const headers = await zoomHeaders();
  const encoded = encodeURIComponent(encodeURIComponent(meetingUUID));
  const res = await makeApiCall(`${ZOOM_API}/meetings/${encoded}/recordings`, { headers });
  if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
  return { success: true, data: await res.json() };
}

export async function listCloudRecordings(params?: { from?: string; to?: string; pageSize?: number }) {
  const headers = await zoomHeaders();
  const userId = await getUserId();
  const qs = new URLSearchParams();
  if (params?.from) qs.set("from", params.from);
  if (params?.to) qs.set("to", params.to);
  if (params?.pageSize) qs.set("page_size", params.pageSize.toString());
  const res = await makeApiCall(`${ZOOM_API}/users/${userId}/recordings?${qs}`, { headers });
  if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
  return { success: true, data: await res.json() };
}

export async function downloadRecording(downloadUrl: string): Promise<{ success: boolean; data?: Buffer; error?: string }> {
  const token = await getAccessToken();
  if (!token) return { success: false, error: "No token" };
  try {
    const res = await fetch(`${downloadUrl}?access_token=${token}`);
    if (!res.ok) return { success: false, error: `Download failed: ${res.status}` };
    const buffer = Buffer.from(await res.arrayBuffer());
    return { success: true, data: buffer };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteRecording(meetingUUID: string, fileId?: string) {
  const headers = await zoomHeaders();
  const encoded = encodeURIComponent(encodeURIComponent(meetingUUID));
  const url = fileId ? `${ZOOM_API}/meetings/${encoded}/recordings/${fileId}` : `${ZOOM_API}/meetings/${encoded}/recordings`;
  const res = await makeApiCall(url, { method: "DELETE", headers });
  if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
  return { success: true };
}

export async function getTranscript(meetingUUID: string) {
  const recordings = await getRecordings(meetingUUID);
  if (!recordings.success) return recordings;

  const transcriptFile = recordings.data?.recording_files?.find((f: any) => f.file_type === "TRANSCRIPT");
  if (!transcriptFile) return { success: false, error: "No transcript available" };

  const download = await downloadRecording(transcriptFile.download_url);
  if (!download.success || !download.data) return { success: false, error: "Failed to download transcript" };

  const vtt = download.data.toString("utf-8");
  const lines = vtt.split("\n");
  const segments: Array<{ speaker: string; text: string; startTime: string; endTime: string }> = [];
  let currentSpeaker = "";
  let currentText = "";
  let startTime = "";
  let endTime = "";

  for (const line of lines) {
    const timeMatch = line.match(/(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/);
    if (timeMatch) {
      if (currentText) segments.push({ speaker: currentSpeaker, text: currentText.trim(), startTime, endTime });
      startTime = timeMatch[1];
      endTime = timeMatch[2];
      currentText = "";
    } else if (line.trim() && !line.match(/^\d+$/) && !line.startsWith("WEBVTT")) {
      const speakerMatch = line.match(/^(.+?):\s*(.*)/);
      if (speakerMatch) { currentSpeaker = speakerMatch[1]; currentText += speakerMatch[2] + " "; }
      else { currentText += line.trim() + " "; }
    }
  }
  if (currentText) segments.push({ speaker: currentSpeaker, text: currentText.trim(), startTime, endTime });

  const text = segments.map(s => `${s.speaker}: ${s.text}`).join("\n");
  return { success: true, data: { vtt, text, segments } };
}

export async function getChatMessages(meetingUUID: string) {
  const recordings = await getRecordings(meetingUUID);
  if (!recordings.success) return recordings;

  const chatFile = recordings.data?.recording_files?.find((f: any) => f.file_type === "CHAT");
  if (!chatFile) return { success: false, error: "No chat log available" };

  const download = await downloadRecording(chatFile.download_url);
  if (!download.success || !download.data) return { success: false, error: "Failed to download chat" };

  const raw = download.data.toString("utf-8");
  const messages = raw.split("\n").filter(l => l.trim()).map(line => {
    const match = line.match(/^(\d{2}:\d{2}:\d{2})\s+From\s+(.+?)\s+to\s+(.+?):\s*(.*)/);
    if (match) return { timestamp: match[1], from: match[2], to: match[3], message: match[4] };
    return { timestamp: "", from: "", to: "", message: line };
  });
  return { success: true, data: messages };
}

export async function getUserSettings() {
  const headers = await zoomHeaders();
  const userId = await getUserId();
  const res = await makeApiCall(`${ZOOM_API}/users/${userId}/settings`, { headers });
  if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
  return { success: true, data: await res.json() };
}

export async function getUpcomingMeetings() {
  return listMeetings({ type: "upcoming" });
}

export async function getLiveMeetings() {
  return listMeetings({ type: "live" });
}

export async function createPoll(meetingId: string, params: { title: string; questions: Array<{ name: string; type: string; answers: string[] }> }) {
  const headers = await zoomHeaders();
  const res = await makeApiCall(`${ZOOM_API}/meetings/${meetingId}/polls`, {
    method: "POST", headers, body: JSON.stringify(params),
  });
  if (!res.ok) return { success: false, error: `Failed: ${res.status}` };
  return { success: true, data: await res.json() };
}

export function verifyWebhook(payload: string, signature: string, timestamp: string, secret: string): boolean {
  const message = `v0:${timestamp}:${payload}`;
  const hash = crypto.createHmac("sha256", secret).update(message).digest("hex");
  const expected = `v0=${hash}`;
  return signature === expected;
}

export async function processWebhook(payload: any) {
  const event = { type: payload.event, data: payload.payload?.object || payload.payload || {}, timestamp: payload.event_ts };

  if (event.type === "meeting.started") {
    await db.zoomMeeting.updateMany({
      where: { zoomMeetingId: String(event.data.id) },
      data: { status: "STARTED" },
    });
  }

  if (event.type === "meeting.ended") {
    const duration = event.data.duration;
    await db.zoomMeeting.updateMany({
      where: { zoomMeetingId: String(event.data.id) },
      data: { status: "ENDED", actualDuration: duration, endTime: new Date() },
    });
  }

  if (event.type === "meeting.participant_joined" || event.type === "meeting.participant_left") {
    const meeting = await db.zoomMeeting.findFirst({ where: { zoomMeetingId: String(event.data.id) } });
    if (meeting) {
      const existing = meeting.participants ? JSON.parse(meeting.participants) : [];
      const participant = event.data.participant || {};
      if (event.type === "meeting.participant_joined") {
        existing.push({ name: participant.user_name, email: participant.email, joinTime: new Date().toISOString() });
      } else {
        const p = existing.find((e: any) => e.email === participant.email || e.name === participant.user_name);
        if (p) { p.leaveTime = new Date().toISOString(); p.duration = participant.duration; }
      }
      await db.zoomMeeting.update({
        where: { id: meeting.id },
        data: { participants: JSON.stringify(existing), participantCount: existing.filter((e: any) => !e.leaveTime).length },
      });
    }
  }

  if (event.type === "recording.completed") {
    const meeting = await db.zoomMeeting.findFirst({ where: { zoomMeetingId: String(event.data.id) } });
    if (meeting) {
      const files = (event.data.recording_files || []).map((f: any) => ({
        fileId: f.id, fileType: f.file_type?.toLowerCase(), fileSize: f.file_size,
        downloadUrl: f.download_url, playUrl: f.play_url, status: f.status,
        recordingStart: f.recording_start, recordingEnd: f.recording_end,
      }));
      await db.zoomMeeting.update({
        where: { id: meeting.id },
        data: { hasRecording: true, recordingFiles: JSON.stringify(files) },
      });
    }
  }

  if (event.type === "recording.transcript_completed") {
    const meeting = await db.zoomMeeting.findFirst({ where: { zoomMeetingId: String(event.data.id) } });
    if (meeting) {
      await db.zoomMeeting.update({ where: { id: meeting.id }, data: { hasTranscript: true } });
    }
  }

  if (event.type === "meeting.registration_created") {
    const meeting = await db.zoomMeeting.findFirst({ where: { zoomMeetingId: String(event.data.id) } });
    if (meeting) {
      const reg = event.data.registrant || {};
      await db.zoomRegistrant.create({
        data: {
          meetingId: meeting.id, zoomRegistrantId: reg.id, firstName: reg.first_name || "",
          lastName: reg.last_name || "", email: reg.email || "", status: "PENDING",
        },
      });
    }
  }

  if (event.type === "meeting.deleted") {
    await db.zoomMeeting.updateMany({
      where: { zoomMeetingId: String(event.data.id) },
      data: { status: "CANCELLED" },
    });
  }

  return event;
}
