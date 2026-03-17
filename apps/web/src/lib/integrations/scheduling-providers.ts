import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getSchedConfig(provider: string) {
  const c = await db.schedulingIntegration.findUnique({ where: { provider } });
  if (!c?.isEnabled || !c?.apiKey) return null;
  return c;
}
function headers(key: string) { return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; }
function notConfigured(p: string) { return { success: false, error: `${p} is not configured.`, provider: p }; }

// ─── Apptoto ─────────────────────────────────────────────────────
export async function apptotoTestConnection() {
  const c = await getSchedConfig("APPTOTO");
  if (!c) return notConfigured("Apptoto");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.apptoto.com/v1"}/account`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "APPTOTO" } : { success: false, error: `Failed: ${res.status}`, provider: "APPTOTO" };
  } catch (err: any) { return { success: false, error: err.message, provider: "APPTOTO" }; }
}
export async function apptotoGetAppointments(dateRange?: { from: string; to: string }) {
  const c = await getSchedConfig("APPTOTO");
  if (!c) return notConfigured("Apptoto");
  try {
    const qs = dateRange ? `?from=${dateRange.from}&to=${dateRange.to}` : "";
    const res = await makeApiCall(`${c.baseUrl || "https://api.apptoto.com/v1"}/appointments${qs}`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "APPTOTO" } : { success: false, error: `Failed: ${res.status}`, provider: "APPTOTO" };
  } catch (err: any) { return { success: false, error: err.message, provider: "APPTOTO" }; }
}
export async function apptotoGetReminderProfiles() {
  const c = await getSchedConfig("APPTOTO");
  if (!c) return notConfigured("Apptoto");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.apptoto.com/v1"}/reminder-profiles`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "APPTOTO" } : { success: false, error: `Failed: ${res.status}`, provider: "APPTOTO" };
  } catch (err: any) { return { success: false, error: err.message, provider: "APPTOTO" }; }
}

// ─── Attornify ───────────────────────────────────────────────────
export async function attornifyTestConnection() {
  const c = await getSchedConfig("ATTORNIFY");
  if (!c) return notConfigured("Attornify");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.attornify.com/v1"}/account`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "ATTORNIFY" } : { success: false, error: `Failed: ${res.status}`, provider: "ATTORNIFY" };
  } catch (err: any) { return { success: false, error: err.message, provider: "ATTORNIFY" }; }
}
export async function attornifyGetEventTypes() {
  const c = await getSchedConfig("ATTORNIFY");
  if (!c) return notConfigured("Attornify");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.attornify.com/v1"}/event-types`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "ATTORNIFY" } : { success: false, error: `Failed: ${res.status}`, provider: "ATTORNIFY" };
  } catch (err: any) { return { success: false, error: err.message, provider: "ATTORNIFY" }; }
}
export async function attornifyGetBookings(dateRange?: { from: string; to: string }) {
  const c = await getSchedConfig("ATTORNIFY");
  if (!c) return notConfigured("Attornify");
  try {
    const qs = dateRange ? `?from=${dateRange.from}&to=${dateRange.to}` : "";
    const res = await makeApiCall(`${c.baseUrl || "https://api.attornify.com/v1"}/bookings${qs}`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "ATTORNIFY" } : { success: false, error: `Failed: ${res.status}`, provider: "ATTORNIFY" };
  } catch (err: any) { return { success: false, error: err.message, provider: "ATTORNIFY" }; }
}

// ─── LawTap ──────────────────────────────────────────────────────
export async function lawtapTestConnection() {
  const c = await getSchedConfig("LAWTAP");
  if (!c) return notConfigured("LawTap");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.lawtap.com/v1"}/account`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "LAWTAP" } : { success: false, error: `Failed: ${res.status}`, provider: "LAWTAP" };
  } catch (err: any) { return { success: false, error: err.message, provider: "LAWTAP" }; }
}
export async function lawtapGetServices() {
  const c = await getSchedConfig("LAWTAP");
  if (!c) return notConfigured("LawTap");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.lawtap.com/v1"}/services`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "LAWTAP" } : { success: false, error: `Failed: ${res.status}`, provider: "LAWTAP" };
  } catch (err: any) { return { success: false, error: err.message, provider: "LAWTAP" }; }
}

// ─── Calendly ────────────────────────────────────────────────────
export async function calendlyTestConnection() {
  const c = await getSchedConfig("CALENDLY");
  if (!c) return notConfigured("Calendly");
  const token = c.accessToken || c.apiKey;
  if (!token) return notConfigured("Calendly");
  try {
    const res = await makeApiCall("https://api.calendly.com/users/me", { headers: headers(token) });
    if (!res.ok) return { success: false, error: `Calendly returned ${res.status}`, provider: "CALENDLY" };
    const data = await res.json();
    return { success: true, data: { name: data.resource?.name, email: data.resource?.email, schedulingUrl: data.resource?.scheduling_url }, provider: "CALENDLY" };
  } catch (err: any) { return { success: false, error: err.message, provider: "CALENDLY" }; }
}
export async function calendlyGetEventTypes() {
  const c = await getSchedConfig("CALENDLY");
  if (!c) return notConfigured("Calendly");
  const token = c.accessToken || c.apiKey;
  const userUri = c.userId;
  if (!token || !userUri) return notConfigured("Calendly");
  try {
    const res = await makeApiCall(`https://api.calendly.com/event_types?user=${encodeURIComponent(userUri)}&count=50`, { headers: headers(token) });
    return res.ok ? { success: true, data: await res.json(), provider: "CALENDLY" } : { success: false, error: `Failed: ${res.status}`, provider: "CALENDLY" };
  } catch (err: any) { return { success: false, error: err.message, provider: "CALENDLY" }; }
}
export async function calendlyGetScheduledEvents(dateRange?: { from: string; to: string }) {
  const c = await getSchedConfig("CALENDLY");
  if (!c) return notConfigured("Calendly");
  const token = c.accessToken || c.apiKey;
  const userUri = c.userId;
  if (!token || !userUri) return notConfigured("Calendly");
  try {
    const qs = new URLSearchParams({ user: userUri, count: "50" });
    if (dateRange?.from) qs.set("min_start_time", dateRange.from);
    if (dateRange?.to) qs.set("max_start_time", dateRange.to);
    const res = await makeApiCall(`https://api.calendly.com/scheduled_events?${qs}`, { headers: headers(token) });
    return res.ok ? { success: true, data: await res.json(), provider: "CALENDLY" } : { success: false, error: `Failed: ${res.status}`, provider: "CALENDLY" };
  } catch (err: any) { return { success: false, error: err.message, provider: "CALENDLY" }; }
}
