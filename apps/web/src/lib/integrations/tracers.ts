import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

const DEFAULT_BASE = "https://api.tracersinfo.com/v1";

async function getConfig() {
  const config = await db.investigationsIntegration.findUnique({ where: { provider: "TRACERS" } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return { baseUrl: config.baseUrl || DEFAULT_BASE, apiKey: config.apiKey, webhookUrl: config.webhookUrl };
}

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export async function testConnection() {
  const config = await getConfig();
  if (!config) return { success: false as const, error: "Tracers is not configured. Set up in Settings → Integrations.", provider: "TRACERS" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/account`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false as const, error: `Tracers returned ${res.status}`, provider: "TRACERS" };
    return { success: true as const, data: await res.json(), provider: "TRACERS" };
  } catch (err: any) { return { success: false as const, error: err.message, provider: "TRACERS" }; }
}

async function postSearch(endpoint: string, params: Record<string, any>) {
  const config = await getConfig();
  if (!config) return { success: false as const, error: "Tracers is not configured. Set up in Settings → Integrations.", provider: "TRACERS" };
  try {
    const res = await makeApiCall(`${config.baseUrl}${endpoint}`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify(params),
    });
    if (!res.ok) return { success: false as const, error: `Tracers returned ${res.status}`, provider: "TRACERS" };
    return { success: true as const, data: await res.json(), provider: "TRACERS" };
  } catch (err: any) { return { success: false as const, error: err.message, provider: "TRACERS" }; }
}

export async function personSearch(params: Record<string, any>) {
  return postSearch("/search/person", params);
}

export async function skipTrace(params: Record<string, any>) {
  return postSearch("/search/skip-trace", params);
}

export async function assetSearch(params: Record<string, any>) {
  return postSearch("/search/assets", params);
}

export async function backgroundCheck(params: Record<string, any>) {
  return postSearch("/search/background", params);
}

export async function criminalSearch(params: Record<string, any>) {
  return postSearch("/search/criminal", params);
}

export async function courtRecords(params: Record<string, any>) {
  return postSearch("/search/court-records", params);
}

export async function bankruptcySearch(params: Record<string, any>) {
  return postSearch("/search/bankruptcy", params);
}

export async function liensJudgments(params: Record<string, any>) {
  return postSearch("/search/liens-judgments", params);
}

export async function propertySearch(params: Record<string, any>) {
  return postSearch("/search/property", params);
}

export async function vehicleSearch(params: Record<string, any>) {
  return postSearch("/search/vehicle", params);
}

export async function businessSearch(params: Record<string, any>) {
  return postSearch("/search/business", params);
}

export async function uccSearch(params: Record<string, any>) {
  return postSearch("/search/ucc", params);
}

export async function phoneLookup(phone: string) {
  return postSearch("/search/phone", { phone });
}

export async function emailLookup(email: string) {
  return postSearch("/search/email", { email });
}

export async function addressHistory(params: Record<string, any>) {
  return postSearch("/search/address-history", params);
}

export async function deathSearch(params: Record<string, any>) {
  return postSearch("/search/death", params);
}

export async function professionalLicense(params: Record<string, any>) {
  return postSearch("/search/license", params);
}

export async function identityVerification(params: Record<string, any>) {
  return postSearch("/search/identity-verify", params);
}

export async function comprehensiveSearch(params: Record<string, any>) {
  return postSearch("/search/comprehensive", params);
}

export async function getSearchResult(searchId: string) {
  const config = await getConfig();
  if (!config) return { success: false as const, error: "Tracers is not configured.", provider: "TRACERS" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/searches/${searchId}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false as const, error: `Tracers returned ${res.status}`, provider: "TRACERS" };
    return { success: true as const, data: await res.json(), provider: "TRACERS" };
  } catch (err: any) { return { success: false as const, error: err.message, provider: "TRACERS" }; }
}

export async function getSearchHistory() {
  const config = await getConfig();
  if (!config) return { success: false as const, error: "Tracers is not configured.", provider: "TRACERS" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/searches`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false as const, error: `Tracers returned ${res.status}`, provider: "TRACERS" };
    return { success: true as const, data: await res.json(), provider: "TRACERS" };
  } catch (err: any) { return { success: false as const, error: err.message, provider: "TRACERS" }; }
}

export async function getCreditsBalance() {
  const config = await getConfig();
  if (!config) return { success: false as const, error: "Tracers is not configured.", provider: "TRACERS" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/account/credits`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false as const, error: `Tracers returned ${res.status}`, provider: "TRACERS" };
    return { success: true as const, data: await res.json(), provider: "TRACERS" };
  } catch (err: any) { return { success: false as const, error: err.message, provider: "TRACERS" }; }
}

export async function processWebhook(payload: any) {
  const searchId = payload.search_id || payload.searchId;
  const status = payload.status === "completed" ? "COMPLETED" : payload.status === "failed" ? "FAILED" : "PARTIAL";

  if (searchId) {
    const search = await db.investigationSearch.findFirst({ where: { externalSearchId: searchId, provider: "TRACERS" } });
    if (search) {
      await db.investigationSearch.update({
        where: { id: search.id },
        data: {
          status: status as any,
          results: payload.results ? JSON.stringify(payload.results) : undefined,
          resultCount: payload.results?.length || payload.result_count || 0,
          rawPayload: JSON.stringify(payload),
        },
      });

      if (status === "COMPLETED" && payload.results?.length) {
        const r = payload.results[0];
        await db.personRecord.create({
          data: {
            searchId: search.id,
            provider: "TRACERS",
            matterId: search.matterId,
            externalRecordId: r.id || r.record_id,
            fullName: r.full_name || r.name || search.searchSubject,
            firstName: r.first_name,
            middleName: r.middle_name,
            lastName: r.last_name,
            dateOfBirth: r.date_of_birth ? new Date(r.date_of_birth) : undefined,
            age: r.age ? parseInt(r.age) : undefined,
            ssn: r.ssn,
            gender: r.gender,
            deceased: r.deceased || false,
            currentAddress: r.current_address ? JSON.stringify(r.current_address) : undefined,
            currentCity: r.city,
            currentState: r.state,
            currentZip: r.zip,
            addressHistory: r.address_history ? JSON.stringify(r.address_history) : undefined,
            phones: r.phones ? JSON.stringify(r.phones) : undefined,
            emails: r.emails ? JSON.stringify(r.emails) : undefined,
            relatives: r.relatives ? JSON.stringify(r.relatives) : undefined,
            associates: r.associates ? JSON.stringify(r.associates) : undefined,
            criminalRecords: r.criminal_records ? JSON.stringify(r.criminal_records) : undefined,
            courtCases: r.court_cases ? JSON.stringify(r.court_cases) : undefined,
            properties: r.properties ? JSON.stringify(r.properties) : undefined,
            vehicles: r.vehicles ? JSON.stringify(r.vehicles) : undefined,
            bankruptcies: r.bankruptcies ? JSON.stringify(r.bankruptcies) : undefined,
            liensJudgments: r.liens_judgments ? JSON.stringify(r.liens_judgments) : undefined,
            uccFilings: r.ucc_filings ? JSON.stringify(r.ucc_filings) : undefined,
          },
        });
      }
    }
  }

  return { received: true, searchId, status };
}
