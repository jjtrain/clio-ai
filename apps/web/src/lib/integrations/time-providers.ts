import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getTimeConfig(provider: string) {
  const c = await db.timeTrackingIntegration.findUnique({ where: { provider } });
  if (!c?.isEnabled || !c?.apiKey) return null;
  return c;
}
function headers(key: string) { return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }; }
function notConfigured(p: string) { return { success: false, error: `${p} is not configured.`, provider: p }; }

// ─── Chrometa ────────────────────────────────────────────────────
export async function chrometaTestConnection() {
  const c = await getTimeConfig("CHROMETA");
  if (!c) return notConfigured("Chrometa");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.chrometa.com/v1"}/account`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "CHROMETA" } : { success: false, error: `Failed: ${res.status}`, provider: "CHROMETA" };
  } catch (err: any) { return { success: false, error: err.message, provider: "CHROMETA" }; }
}
export async function chrometaGetEntries(dateRange?: { from: string; to: string }) {
  const c = await getTimeConfig("CHROMETA");
  if (!c) return notConfigured("Chrometa");
  try {
    const qs = dateRange ? `?from=${dateRange.from}&to=${dateRange.to}` : "";
    const res = await makeApiCall(`${c.baseUrl || "https://api.chrometa.com/v1"}/timeslips${qs}`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "CHROMETA" } : { success: false, error: `Failed: ${res.status}`, provider: "CHROMETA" };
  } catch (err: any) { return { success: false, error: err.message, provider: "CHROMETA" }; }
}
export async function chrometaGetApplicationSummary(dateRange: { from: string; to: string }) {
  const c = await getTimeConfig("CHROMETA");
  if (!c) return notConfigured("Chrometa");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.chrometa.com/v1"}/reports/applications?from=${dateRange.from}&to=${dateRange.to}`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "CHROMETA" } : { success: false, error: `Failed: ${res.status}`, provider: "CHROMETA" };
  } catch (err: any) { return { success: false, error: err.message, provider: "CHROMETA" }; }
}

// ─── WiseTime ────────────────────────────────────────────────────
export async function wisetimeTestConnection() {
  const c = await getTimeConfig("WISETIME");
  if (!c) return notConfigured("WiseTime");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.wisetime.com/v1"}/account`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "WISETIME" } : { success: false, error: `Failed: ${res.status}`, provider: "WISETIME" };
  } catch (err: any) { return { success: false, error: err.message, provider: "WISETIME" }; }
}
export async function wisetimeGetEntries(dateRange?: { from: string; to: string }, status?: string) {
  const c = await getTimeConfig("WISETIME");
  if (!c) return notConfigured("WiseTime");
  try {
    const qs = new URLSearchParams();
    if (dateRange?.from) qs.set("from", dateRange.from);
    if (dateRange?.to) qs.set("to", dateRange.to);
    if (status) qs.set("status", status);
    const res = await makeApiCall(`${c.baseUrl || "https://api.wisetime.com/v1"}/time-entries?${qs}`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "WISETIME" } : { success: false, error: `Failed: ${res.status}`, provider: "WISETIME" };
  } catch (err: any) { return { success: false, error: err.message, provider: "WISETIME" }; }
}
export async function wisetimeGetUnreviewed() {
  const c = await getTimeConfig("WISETIME");
  if (!c) return notConfigured("WiseTime");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.wisetime.com/v1"}/time-entries?status=unreviewed`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "WISETIME" } : { success: false, error: `Failed: ${res.status}`, provider: "WISETIME" };
  } catch (err: any) { return { success: false, error: err.message, provider: "WISETIME" }; }
}

// ─── eBillity ────────────────────────────────────────────────────
export async function ebillityTestConnection() {
  const c = await getTimeConfig("EBILLITY");
  if (!c) return notConfigured("eBillity");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.ebillity.com/v1"}/account`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "EBILLITY" } : { success: false, error: `Failed: ${res.status}`, provider: "EBILLITY" };
  } catch (err: any) { return { success: false, error: err.message, provider: "EBILLITY" }; }
}
export async function ebillityGetEntries(dateRange?: { from: string; to: string }) {
  const c = await getTimeConfig("EBILLITY");
  if (!c) return notConfigured("eBillity");
  try {
    const qs = dateRange ? `?from=${dateRange.from}&to=${dateRange.to}` : "";
    const res = await makeApiCall(`${c.baseUrl || "https://api.ebillity.com/v1"}/time-entries${qs}`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "EBILLITY" } : { success: false, error: `Failed: ${res.status}`, provider: "EBILLITY" };
  } catch (err: any) { return { success: false, error: err.message, provider: "EBILLITY" }; }
}
export async function ebillityStartTimer(params: { userId?: string; description?: string }) {
  const c = await getTimeConfig("EBILLITY");
  if (!c) return notConfigured("eBillity");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.ebillity.com/v1"}/timers/start`, { method: "POST", headers: headers(c.apiKey!), body: JSON.stringify(params) });
    return res.ok ? { success: true, data: await res.json(), provider: "EBILLITY" } : { success: false, error: `Failed: ${res.status}`, provider: "EBILLITY" };
  } catch (err: any) { return { success: false, error: err.message, provider: "EBILLITY" }; }
}
