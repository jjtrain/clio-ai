import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getCrmConfig(provider: string) {
  const config = await db.crmIntakeIntegration.findUnique({ where: { provider } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return config;
}

function headers(apiKey: string) { return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }; }
function notConfigured(p: string) { return { success: false, error: `${p} is not configured. Set up in Settings → Integrations.`, provider: p }; }

// ─── Lawmatics ───────────────────────────────────────────────────

export async function lawmaticsTestConnection() {
  const c = await getCrmConfig("LAWMATICS");
  if (!c) return notConfigured("Lawmatics");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.lawmatics.com/v1"}/account`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "LAWMATICS" } : { success: false, error: `Lawmatics returned ${res.status}`, provider: "LAWMATICS" };
  } catch (err: any) { return { success: false, error: err.message, provider: "LAWMATICS" }; }
}

export async function lawmaticsGetContacts(params?: { page?: number }) {
  const c = await getCrmConfig("LAWMATICS");
  if (!c) return notConfigured("Lawmatics");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.lawmatics.com/v1"}/contacts?page=${params?.page || 1}`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "LAWMATICS" } : { success: false, error: `Failed: ${res.status}`, provider: "LAWMATICS" };
  } catch (err: any) { return { success: false, error: err.message, provider: "LAWMATICS" }; }
}

export async function lawmaticsGetForms() {
  const c = await getCrmConfig("LAWMATICS");
  if (!c) return notConfigured("Lawmatics");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.lawmatics.com/v1"}/forms`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "LAWMATICS" } : { success: false, error: `Failed: ${res.status}`, provider: "LAWMATICS" };
  } catch (err: any) { return { success: false, error: err.message, provider: "LAWMATICS" }; }
}

// ─── Lead Docket ─────────────────────────────────────────────────

export async function leadDocketTestConnection() {
  const c = await getCrmConfig("LEAD_DOCKET");
  if (!c) return notConfigured("Lead Docket");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.leaddocket.com/v1"}/account`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "LEAD_DOCKET" } : { success: false, error: `Failed: ${res.status}`, provider: "LEAD_DOCKET" };
  } catch (err: any) { return { success: false, error: err.message, provider: "LEAD_DOCKET" }; }
}

export async function leadDocketGetLeads(params?: { status?: string; source?: string }) {
  const c = await getCrmConfig("LEAD_DOCKET");
  if (!c) return notConfigured("Lead Docket");
  try {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.source) qs.set("source", params.source);
    const res = await makeApiCall(`${c.baseUrl || "https://api.leaddocket.com/v1"}/leads?${qs}`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "LEAD_DOCKET" } : { success: false, error: `Failed: ${res.status}`, provider: "LEAD_DOCKET" };
  } catch (err: any) { return { success: false, error: err.message, provider: "LEAD_DOCKET" }; }
}

export async function leadDocketGetSources() {
  const c = await getCrmConfig("LEAD_DOCKET");
  if (!c) return notConfigured("Lead Docket");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.leaddocket.com/v1"}/sources`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "LEAD_DOCKET" } : { success: false, error: `Failed: ${res.status}`, provider: "LEAD_DOCKET" };
  } catch (err: any) { return { success: false, error: err.message, provider: "LEAD_DOCKET" }; }
}

// ─── HubSpot ─────────────────────────────────────────────────────

export async function hubspotTestConnection() {
  const c = await getCrmConfig("HUBSPOT");
  if (!c) return notConfigured("HubSpot");
  const token = c.accessToken || c.apiKey;
  if (!token) return notConfigured("HubSpot");
  try {
    const res = await makeApiCall(`https://api.hubapi.com/crm/v3/objects/contacts?limit=1`, { headers: headers(token) });
    return res.ok ? { success: true, provider: "HUBSPOT" } : { success: false, error: `HubSpot returned ${res.status}`, provider: "HUBSPOT" };
  } catch (err: any) { return { success: false, error: err.message, provider: "HUBSPOT" }; }
}

export async function hubspotGetContacts(params?: { limit?: number }) {
  const c = await getCrmConfig("HUBSPOT");
  if (!c) return notConfigured("HubSpot");
  const token = c.accessToken || c.apiKey;
  try {
    const res = await makeApiCall(`https://api.hubapi.com/crm/v3/objects/contacts?limit=${params?.limit || 50}&properties=firstname,lastname,email,phone,company,lifecyclestage`, { headers: headers(token!) });
    return res.ok ? { success: true, data: await res.json(), provider: "HUBSPOT" } : { success: false, error: `Failed: ${res.status}`, provider: "HUBSPOT" };
  } catch (err: any) { return { success: false, error: err.message, provider: "HUBSPOT" }; }
}

export async function hubspotGetForms() {
  const c = await getCrmConfig("HUBSPOT");
  if (!c) return notConfigured("HubSpot");
  const token = c.accessToken || c.apiKey;
  try {
    const res = await makeApiCall(`https://api.hubapi.com/marketing/v3/forms`, { headers: headers(token!) });
    return res.ok ? { success: true, data: await res.json(), provider: "HUBSPOT" } : { success: false, error: `Failed: ${res.status}`, provider: "HUBSPOT" };
  } catch (err: any) { return { success: false, error: err.message, provider: "HUBSPOT" }; }
}

// ─── Cognito Forms ───────────────────────────────────────────────

export async function cognitoTestConnection() {
  const c = await getCrmConfig("COGNITO_FORMS");
  if (!c) return notConfigured("Cognito Forms");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.cognitoforms.com/v1"}/forms`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, provider: "COGNITO_FORMS" } : { success: false, error: `Failed: ${res.status}`, provider: "COGNITO_FORMS" };
  } catch (err: any) { return { success: false, error: err.message, provider: "COGNITO_FORMS" }; }
}

export async function cognitoGetForms() {
  const c = await getCrmConfig("COGNITO_FORMS");
  if (!c) return notConfigured("Cognito Forms");
  try {
    const res = await makeApiCall(`${c.baseUrl || "https://api.cognitoforms.com/v1"}/forms`, { headers: headers(c.apiKey!) });
    return res.ok ? { success: true, data: await res.json(), provider: "COGNITO_FORMS" } : { success: false, error: `Failed: ${res.status}`, provider: "COGNITO_FORMS" };
  } catch (err: any) { return { success: false, error: err.message, provider: "COGNITO_FORMS" }; }
}

// ─── Wufoo ───────────────────────────────────────────────────────

export async function wufooTestConnection() {
  const c = await getCrmConfig("WUFOO");
  if (!c) return notConfigured("Wufoo");
  const subdomain = c.accountId || "forms";
  try {
    const auth = Buffer.from(`${c.apiKey}:password`).toString("base64");
    const res = await makeApiCall(`https://${subdomain}.wufoo.com/api/v3/users.json`, { headers: { Authorization: `Basic ${auth}` } });
    return res.ok ? { success: true, provider: "WUFOO" } : { success: false, error: `Failed: ${res.status}`, provider: "WUFOO" };
  } catch (err: any) { return { success: false, error: err.message, provider: "WUFOO" }; }
}

export async function wufooGetForms() {
  const c = await getCrmConfig("WUFOO");
  if (!c) return notConfigured("Wufoo");
  const subdomain = c.accountId || "forms";
  try {
    const auth = Buffer.from(`${c.apiKey}:password`).toString("base64");
    const res = await makeApiCall(`https://${subdomain}.wufoo.com/api/v3/forms.json`, { headers: { Authorization: `Basic ${auth}` } });
    return res.ok ? { success: true, data: await res.json(), provider: "WUFOO" } : { success: false, error: `Failed: ${res.status}`, provider: "WUFOO" };
  } catch (err: any) { return { success: false, error: err.message, provider: "WUFOO" }; }
}
