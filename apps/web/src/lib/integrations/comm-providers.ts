import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

// Shared helper to get any comm provider config
async function getCommConfig(provider: string) {
  const config = await db.commIntegration.findUnique({ where: { provider } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return config;
}

function headers(apiKey: string) { return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }; }

function notConfigured(provider: string) { return { success: false, error: `${provider} is not configured. Set up in Settings → Integrations.`, provider }; }

// ─── Smith.ai ────────────────────────────────────────────────────

export async function smithAiTestConnection() {
  const c = await getCommConfig("SMITH_AI");
  if (!c) return notConfigured("Smith.ai");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.smith.ai/v1"}/account`, { headers: headers(c.apiKey!) });
    if (!res.ok) return { success: false, error: `Smith.ai returned ${res.status}`, provider: "SMITH_AI" };
    return { success: true, data: await res.json(), provider: "SMITH_AI" };
  } catch (err: any) { return { success: false, error: err.message, provider: "SMITH_AI" }; }
}

export async function smithAiGetCalls(dateRange?: { from: string; to: string }) {
  const c = await getCommConfig("SMITH_AI");
  if (!c) return notConfigured("Smith.ai");
  try {
    const params = new URLSearchParams();
    if (dateRange?.from) params.set("from", dateRange.from);
    if (dateRange?.to) params.set("to", dateRange.to);
    const res = await makeApiCall(`${c.baseUrl || "https://api.smith.ai/v1"}/calls?${params}`, { headers: headers(c.apiKey!) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "SMITH_AI" };
    return { success: true, data: await res.json(), provider: "SMITH_AI" };
  } catch (err: any) { return { success: false, error: err.message, provider: "SMITH_AI" }; }
}

// ─── Ruby Receptionists ──────────────────────────────────────────

export async function rubyTestConnection() {
  const c = await getCommConfig("RUBY_RECEPTIONISTS");
  if (!c) return notConfigured("Ruby Receptionists");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.ruby.com/v1"}/account`, { headers: headers(c.apiKey!) });
    if (!res.ok) return { success: false, error: `Ruby returned ${res.status}`, provider: "RUBY_RECEPTIONISTS" };
    return { success: true, data: await res.json(), provider: "RUBY_RECEPTIONISTS" };
  } catch (err: any) { return { success: false, error: err.message, provider: "RUBY_RECEPTIONISTS" }; }
}

// ─── PATLive ─────────────────────────────────────────────────────

export async function patliveTestConnection() {
  const c = await getCommConfig("PATLIVE");
  if (!c) return notConfigured("PATLive");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.patlive.com/v1"}/account`, { headers: headers(c.apiKey!) });
    if (!res.ok) return { success: false, error: `PATLive returned ${res.status}`, provider: "PATLIVE" };
    return { success: true, data: await res.json(), provider: "PATLIVE" };
  } catch (err: any) { return { success: false, error: err.message, provider: "PATLIVE" }; }
}

// ─── Dialpad ─────────────────────────────────────────────────────

export async function dialpadTestConnection() {
  const c = await getCommConfig("DIALPAD");
  if (!c) return notConfigured("Dialpad");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://dialpad.com/api/v2"}/accounts/self`, { headers: headers(c.apiKey!) });
    if (!res.ok) return { success: false, error: `Dialpad returned ${res.status}`, provider: "DIALPAD" };
    return { success: true, data: await res.json(), provider: "DIALPAD" };
  } catch (err: any) { return { success: false, error: err.message, provider: "DIALPAD" }; }
}

export async function dialpadGetCalls(dateRange?: { from: string; to: string }) {
  const c = await getCommConfig("DIALPAD");
  if (!c) return notConfigured("Dialpad");
  try {
    const params = new URLSearchParams();
    if (dateRange?.from) params.set("started_after", dateRange.from);
    if (dateRange?.to) params.set("started_before", dateRange.to);
    const res = await makeApiCall(`${c.baseUrl || "https://dialpad.com/api/v2"}/calls?${params}`, { headers: headers(c.apiKey!) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "DIALPAD" };
    return { success: true, data: await res.json(), provider: "DIALPAD" };
  } catch (err: any) { return { success: false, error: err.message, provider: "DIALPAD" }; }
}

// ─── Case Status ─────────────────────────────────────────────────

export async function caseStatusTestConnection() {
  const c = await getCommConfig("CASE_STATUS");
  if (!c) return notConfigured("Case Status");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.casestatus.com/v1"}/account`, { headers: headers(c.apiKey!) });
    if (!res.ok) return { success: false, error: `Case Status returned ${res.status}`, provider: "CASE_STATUS" };
    return { success: true, data: await res.json(), provider: "CASE_STATUS" };
  } catch (err: any) { return { success: false, error: err.message, provider: "CASE_STATUS" }; }
}

export async function caseStatusCreateCase(params: { clientName: string; clientEmail: string; caseName: string; caseType: string; stage: string }) {
  const c = await getCommConfig("CASE_STATUS");
  if (!c) return notConfigured("Case Status");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.casestatus.com/v1"}/cases`, { method: "POST", headers: headers(c.apiKey!), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "CASE_STATUS" };
    return { success: true, data: await res.json(), provider: "CASE_STATUS" };
  } catch (err: any) { return { success: false, error: err.message, provider: "CASE_STATUS" }; }
}

export async function caseStatusSendMessage(caseId: string, message: string) {
  const c = await getCommConfig("CASE_STATUS");
  if (!c) return notConfigured("Case Status");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.casestatus.com/v1"}/cases/${caseId}/messages`, { method: "POST", headers: headers(c.apiKey!), body: JSON.stringify({ message }) });
    return { success: res.ok, provider: "CASE_STATUS" };
  } catch (err: any) { return { success: false, error: err.message, provider: "CASE_STATUS" }; }
}

// ─── Privilege.law ───────────────────────────────────────────────

export async function privilegeTestConnection() {
  const c = await getCommConfig("PRIVILEGE_LAW");
  if (!c) return notConfigured("Privilege.law");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.privilege.law/v1"}/account`, { headers: headers(c.apiKey!) });
    if (!res.ok) return { success: false, error: `Privilege.law returned ${res.status}`, provider: "PRIVILEGE_LAW" };
    return { success: true, data: await res.json(), provider: "PRIVILEGE_LAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "PRIVILEGE_LAW" }; }
}

export async function privilegeSendMessage(params: { clientId: string; body: string; subject?: string }) {
  const c = await getCommConfig("PRIVILEGE_LAW");
  if (!c) return notConfigured("Privilege.law");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.privilege.law/v1"}/messages`, { method: "POST", headers: headers(c.apiKey!), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "PRIVILEGE_LAW" };
    return { success: true, data: await res.json(), provider: "PRIVILEGE_LAW" };
  } catch (err: any) { return { success: false, error: err.message, provider: "PRIVILEGE_LAW" }; }
}

// ─── Hona ────────────────────────────────────────────────────────

export async function honaTestConnection() {
  const c = await getCommConfig("HONA");
  if (!c) return notConfigured("Hona");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.hona.com/v1"}/account`, { headers: headers(c.apiKey!) });
    if (!res.ok) return { success: false, error: `Hona returned ${res.status}`, provider: "HONA" };
    return { success: true, data: await res.json(), provider: "HONA" };
  } catch (err: any) { return { success: false, error: err.message, provider: "HONA" }; }
}

export async function honaCreateCase(params: { clientName: string; clientEmail: string; caseName: string; caseType: string; milestones?: Array<{ name: string; order: number }> }) {
  const c = await getCommConfig("HONA");
  if (!c) return notConfigured("Hona");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.hona.com/v1"}/cases`, { method: "POST", headers: headers(c.apiKey!), body: JSON.stringify(params) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "HONA" };
    return { success: true, data: await res.json(), provider: "HONA" };
  } catch (err: any) { return { success: false, error: err.message, provider: "HONA" }; }
}
