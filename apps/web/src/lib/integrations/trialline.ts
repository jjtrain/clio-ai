import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

const DEFAULT_BASE = "https://api.trialline.net/v1";

async function getConfig() {
  const c = await db.visualsIntegration.findUnique({ where: { provider: "TRIALLINE" } });
  if (!c?.isEnabled || !c?.apiKey) return null;
  return { baseUrl: c.baseUrl || DEFAULT_BASE, apiKey: c.apiKey };
}

function headers(key: string) {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function testConnection() {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine is not configured. Set up in Settings → Integrations.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/account`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "TRIALLINE" } : { success: false, error: `TrialLine returned ${res.status}`, provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function createTimeline(params: { title: string; description?: string; matterId?: string; startDate?: string; endDate?: string; theme?: string; category?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
    return { success: true, data: await res.json(), provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function getTimeline(id: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "TRIALLINE" } : { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function getTimelines(params?: { page?: number; limit?: number; status?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.status) qs.set("status", params.status);
    const res = await makeApiCall(`${c.baseUrl}/timelines?${qs}`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "TRIALLINE" } : { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function updateTimeline(id: string, params: Record<string, any>) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}`, { method: "PUT", headers: headers(c.apiKey), body: JSON.stringify(params) });
    return res.ok ? { success: true, data: await res.json(), provider: "TRIALLINE" } : { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function deleteTimeline(id: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}`, { method: "DELETE", headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: { deleted: true }, provider: "TRIALLINE" } : { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function addEvent(id: string, params: { title: string; date: string; description?: string; category?: string; tags?: string[]; documents?: string[] }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}/events`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
    return { success: true, data: await res.json(), provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function updateEvent(id: string, eventId: string, params: Record<string, any>) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}/events/${eventId}`, { method: "PUT", headers: headers(c.apiKey), body: JSON.stringify(params) });
    return res.ok ? { success: true, data: await res.json(), provider: "TRIALLINE" } : { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function deleteEvent(id: string, eventId: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}/events/${eventId}`, { method: "DELETE", headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: { deleted: true }, provider: "TRIALLINE" } : { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function bulkAddEvents(id: string, events: Array<{ title: string; date: string; description?: string; category?: string }>) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}/events/bulk`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify({ events }) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
    return { success: true, data: await res.json(), provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function getEvents(id: string, params?: { category?: string; startDate?: string; endDate?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.startDate) qs.set("startDate", params.startDate);
    if (params?.endDate) qs.set("endDate", params.endDate);
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}/events?${qs}`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "TRIALLINE" } : { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function reorderEvents(id: string, eventIds: string[]) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}/events/reorder`, { method: "PUT", headers: headers(c.apiKey), body: JSON.stringify({ eventIds }) });
    return res.ok ? { success: true, data: await res.json(), provider: "TRIALLINE" } : { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function addAnnotation(id: string, params: { eventId?: string; text: string; author?: string; type?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}/annotations`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
    return { success: true, data: await res.json(), provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function setFilters(id: string, filters: Record<string, any>) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}/filters`, { method: "PUT", headers: headers(c.apiKey), body: JSON.stringify(filters) });
    return res.ok ? { success: true, data: await res.json(), provider: "TRIALLINE" } : { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function shareTimeline(id: string, params: { recipients?: string[]; accessLevel?: string; expiresAt?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}/share`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
    return { success: true, data: await res.json(), provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function getShareUrl(id: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}/share`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "TRIALLINE" } : { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function revokeShare(id: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}/share`, { method: "DELETE", headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: { revoked: true }, provider: "TRIALLINE" } : { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function exportTimeline(id: string, params: { format: string; includeAnnotations?: boolean; includeDocuments?: boolean }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}/export`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
    return { success: true, data: await res.json(), provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function getEmbedCode(id: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}/embed`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "TRIALLINE" } : { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function duplicateTimeline(id: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/timelines/${id}/duplicate`, { method: "POST", headers: headers(c.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
    return { success: true, data: await res.json(), provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function getCategories() {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/categories`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "TRIALLINE" } : { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function getThemes() {
  const c = await getConfig();
  if (!c) return { success: false, error: "TrialLine not configured.", provider: "TRIALLINE" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/themes`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "TRIALLINE" } : { success: false, error: `Failed: ${res.status}`, provider: "TRIALLINE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "TRIALLINE" }; }
}

export async function processWebhook(payload: any) {
  const timelineId = payload.timeline_id || payload.timelineId;
  const events = payload.events || [];
  const action = payload.action || payload.type;

  const timeline = timelineId
    ? await db.caseTimeline.findFirst({ where: { externalTimelineId: timelineId, provider: "TRIALLINE" } })
    : null;

  if (action === "timeline.updated" && timeline) {
    await db.caseTimeline.update({
      where: { id: timeline.id },
      data: {
        title: payload.title || timeline.title,
        description: payload.description || timeline.description,
        updatedAt: new Date(),
      },
    });
  }

  const createdEventIds: string[] = [];

  for (const evt of events) {
    const event = await db.timelineEvent.create({
      data: {
        timelineId: timeline?.id || "",
        title: evt.title || evt.name || "Untitled Event",
        date: evt.date ? new Date(evt.date) : new Date(),
        description: evt.description,
        category: (evt.category || "OTHER") as any,
        source: "trialline",
        externalEventId: evt.id || evt.event_id,
      },
    });
    createdEventIds.push(event.id);
  }

  if (action === "timeline.deleted" && timeline) {
    await db.caseTimeline.update({
      where: { id: timeline.id },
      data: { status: "ARCHIVED" },
    });
  }

  return { received: true, timelineId: timeline?.id, eventIds: createdEventIds, action };
}
