import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getConfig() {
  const c = await db.processServingIntegration.findUnique({ where: { provider: "STENO" } });
  if (!c?.isEnabled || !c?.apiKey) return null;
  return { baseUrl: c.baseUrl || "https://api.steno.com/v1", apiKey: c.apiKey };
}
function headers(key: string) { return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; }

export async function stenoTestConnection() {
  const c = await getConfig();
  if (!c) return { success: false, error: "Steno is not configured. Set up in Settings → Integrations.", provider: "STENO" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/account`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "STENO" } : { success: false, error: `Steno returned ${res.status}`, provider: "STENO" };
  } catch (err: any) { return { success: false, error: err.message, provider: "STENO" }; }
}

export async function stenoRequestReporter(params: { eventDate: string; eventTime: string; estimatedDuration: number; location: string; locationType: string; jobType: string; deponentName?: string; videographerRequested?: boolean; realtimeRequested?: boolean; expeditedTranscript?: boolean; specialInstructions?: string }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Steno not configured.", provider: "STENO" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/bookings`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Booking failed: ${res.status}`, provider: "STENO" };
    const data = await res.json();
    return { success: true, data: { bookingId: data.id || data.booking_id || `steno_${Date.now()}`, status: data.status || "REQUESTED", estimatedCost: data.estimated_cost }, provider: "STENO" };
  } catch (err: any) { return { success: false, error: err.message, provider: "STENO" }; }
}

export async function stenoGetBooking(bookingId: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Steno not configured.", provider: "STENO" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/bookings/${bookingId}`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "STENO" } : { success: false, error: `Failed: ${res.status}`, provider: "STENO" };
  } catch (err: any) { return { success: false, error: err.message, provider: "STENO" }; }
}

export async function stenoGetBookings(params?: { status?: string; dateRange?: { from: string; to: string } }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Steno not configured.", provider: "STENO" };
  try {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.dateRange?.from) qs.set("from", params.dateRange.from);
    if (params?.dateRange?.to) qs.set("to", params.dateRange.to);
    const res = await makeApiCall(`${c.baseUrl}/bookings?${qs}`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "STENO" } : { success: false, error: `Failed: ${res.status}`, provider: "STENO" };
  } catch (err: any) { return { success: false, error: err.message, provider: "STENO" }; }
}

export async function stenoGetTranscript(bookingId: string, format?: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Steno not configured.", provider: "STENO" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/bookings/${bookingId}/transcript${format ? `?format=${format}` : ""}`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "STENO" } : { success: false, error: `Failed: ${res.status}`, provider: "STENO" };
  } catch (err: any) { return { success: false, error: err.message, provider: "STENO" }; }
}

export async function stenoSearchTranscripts(query: string) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Steno not configured.", provider: "STENO" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/transcripts/search?q=${encodeURIComponent(query)}`, { headers: headers(c.apiKey) });
    return res.ok ? { success: true, data: await res.json(), provider: "STENO" } : { success: false, error: `Failed: ${res.status}`, provider: "STENO" };
  } catch (err: any) { return { success: false, error: err.message, provider: "STENO" }; }
}

export async function stenoGetEstimate(params: { duration: number; jobType: string; video?: boolean; realtime?: boolean; expedited?: boolean }) {
  const c = await getConfig();
  if (!c) return { success: false, error: "Steno not configured.", provider: "STENO" };
  try {
    const res = await makeApiCall(`${c.baseUrl}/estimate`, { method: "POST", headers: headers(c.apiKey), body: JSON.stringify(params) });
    return res.ok ? { success: true, data: await res.json(), provider: "STENO" } : { success: false, error: `Failed: ${res.status}`, provider: "STENO" };
  } catch (err: any) { return { success: false, error: err.message, provider: "STENO" }; }
}
