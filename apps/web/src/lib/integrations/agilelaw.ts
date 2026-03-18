import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

const DEFAULT_BASE = "https://api.agilelaw.com/v1";

async function getConfig() {
  const c = await db.visualsIntegration.findUnique({ where: { provider: "AGILELAW" } });
  if (!c?.isEnabled || !c?.apiKey) return null;
  return { baseUrl: c.baseUrl || DEFAULT_BASE, apiKey: c.apiKey };
}

function headers(key: string) {
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export async function testConnection() {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw is not configured. Set up in Settings → Integrations.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/account`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `AgileLaw returned ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function createSession(params: { title: string; deponentName: string; depositionDate: string; matterId?: string; location?: string; attorneys?: string[] }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
    return { success: true, data: await res.json(), provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function getSession(id: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function getSessions(params?: { page?: number; limit?: number; status?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.status) qs.set("status", params.status);
    const res = await makeApiCall(`${c.baseUrl}/sessions?${qs}`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function updateSession(id: string, params: Record<string, any>) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}`, { method: "PUT", headers: headers(c.apiKey), body: JSON.stringify(params) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function deleteSession(id: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}`, { method: "DELETE", headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: { deleted: true }, provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function startSession(id: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/start`, { method: "POST", headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function endSession(id: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/end`, { method: "POST", headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function addExhibit(id: string, params: { name: string; description?: string; fileUrl?: string; fileData?: string; mimeType?: string; exhibitNumber?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/exhibits`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
    return { success: true, data: await res.json(), provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function addExhibitFromUrl(id: string, params: { url: string; name: string; exhibitNumber?: string; description?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/exhibits/from-url`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
    return { success: true, data: await res.json(), provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function bulkAddExhibits(id: string, exhibits: Array<{ name: string; fileUrl?: string; exhibitNumber?: string }>) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/exhibits/bulk`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify({ exhibits }) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
    return { success: true, data: await res.json(), provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function getExhibits(id: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/exhibits`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function getExhibit(id: string, exhibitId: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/exhibits/${exhibitId}`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function updateExhibit(id: string, exhibitId: string, params: Record<string, any>) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/exhibits/${exhibitId}`, { method: "PUT", headers: headers(c.apiKey), body: JSON.stringify(params) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function deleteExhibit(id: string, exhibitId: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/exhibits/${exhibitId}`, { method: "DELETE", headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: { deleted: true }, provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function reorderExhibits(id: string, exhibitIds: string[]) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/exhibits/reorder`, { method: "PUT", headers: headers(c.apiKey), body: JSON.stringify({ exhibitIds }) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function presentExhibit(id: string, params: { exhibitId: string; page?: number; zoom?: number }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/present`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function presentPage(id: string, params: { exhibitId: string; page: number; annotations?: boolean }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/present/page`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function addAnnotation(id: string, exhibitId: string, params: { text: string; page?: number; x?: number; y?: number; type?: string; color?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/exhibits/${exhibitId}/annotations`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
    return { success: true, data: await res.json(), provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function getAnnotations(id: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/annotations`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function deleteAnnotation(id: string, annotationId: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/annotations/${annotationId}`, { method: "DELETE", headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: { deleted: true }, provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function stampExhibit(id: string, exhibitId: string, params: { stampType: string; text?: string; position?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/exhibits/${exhibitId}/stamp`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function markExhibit(id: string, exhibitId: string, params: { markType: string; label?: string; page?: number }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/exhibits/${exhibitId}/mark`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function offerIntoEvidence(id: string, exhibitId: string, params: { offeredBy?: string; basis?: string; notes?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/exhibits/${exhibitId}/offer`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function recordObjection(id: string, exhibitId: string, params: { objectionType: string; objectedBy?: string; basis?: string; ruling?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/exhibits/${exhibitId}/objection`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function linkTranscript(id: string, params: { transcriptUrl?: string; transcriptText?: string; provider?: string; bookingId?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/transcript`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function shareSession(id: string, params: { recipients?: string[]; accessLevel?: string; expiresAt?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/share`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
    return { success: true, data: await res.json(), provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function getShareUrl(id: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/share`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "AGILELAW" } : { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function exportSession(id: string, params: { format: string; includeAnnotations?: boolean; includeExhibits?: boolean }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/export`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
    return { success: true, data: await res.json(), provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function exportExhibitList(id: string, params?: { format?: string; includeStatus?: boolean }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "AgileLaw not configured.", provider: "AGILELAW" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/sessions/${id}/exhibit-list/export`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params || {}) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "AGILELAW" };
    return { success: true, data: await res.json(), provider: "AGILELAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "AGILELAW" }; }
}

export async function processWebhook(payload: any) {
  const sessionId = payload.session_id || payload.sessionId;
  const action = payload.action || payload.type;

  const session = sessionId
    ? await db.depositionSession.findFirst({ where: { externalSessionId: sessionId, provider: "AGILELAW" } })
    : null;

  if (action === "session.updated" && session) {
    await db.depositionSession.update({
      where: { id: session.id },
      data: {
        title: payload.title || session.title,
        status: payload.status || session.status,
        updatedAt: new Date(),
      },
    });
  }

  if (action === "session.started" && session) {
    await db.depositionSession.update({
      where: { id: session.id },
      data: { status: "IN_PROGRESS" },
    });
  }

  if (action === "session.ended" && session) {
    await db.depositionSession.update({
      where: { id: session.id },
      data: { status: "COMPLETED" },
    });
  }

  const exhibitIds: string[] = [];

  if (payload.exhibits) {
    for (const ex of payload.exhibits) {
      const exhibit = await db.depositionExhibit.create({
        data: {
          sessionId: session?.id || "",
          externalExhibitId: ex.id || ex.exhibit_id,
          title: ex.name || ex.title || "Untitled Exhibit",
          exhibitNumber: ex.exhibit_number || ex.number || "0",
          description: ex.description,
          externalDocUrl: ex.file_url || ex.url,
          fileType: ex.mime_type,
          pageCount: ex.page_count,
        },
      });
      exhibitIds.push(exhibit.id);
    }
  }

  const annotationIds: string[] = [];

  if (payload.annotations) {
    for (const ann of payload.annotations) {
      const annotation = await db.depositionAnnotation.create({
        data: {
          sessionId: session?.id || "",
          exhibitId: ann.exhibit_id || undefined,
          annotationType: (ann.type === "highlight" ? "HIGHLIGHT" : ann.type === "redaction" ? "REDACTION" : "TEXT_NOTE") as any,
          content: ann.text || ann.content || "",
          transcriptPage: ann.page || undefined,
          createdBy: ann.author || "agilelaw",
          coordinates: ann.metadata ? JSON.stringify(ann.metadata) : undefined,
        },
      });
      annotationIds.push(annotation.id);
    }
  }

  return { received: true, sessionId: session?.id, exhibitIds, annotationIds, action };
}
