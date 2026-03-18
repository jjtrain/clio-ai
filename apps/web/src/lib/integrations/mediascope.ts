import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

const DEFAULT_BASE = "https://api.mediascope.ai/v1";

async function getConfig() {
  const config = await db.investigationsIntegration.findUnique({ where: { provider: "MEDIASCOPE" } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return { baseUrl: config.baseUrl || DEFAULT_BASE, apiKey: config.apiKey, webhookUrl: config.webhookUrl };
}

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

async function getRequest(endpoint: string) {
  const config = await getConfig();
  if (!config) return { success: false as const, error: "Mediascope is not configured. Set up in Settings → Integrations.", provider: "MEDIASCOPE" };
  try {
    const res = await makeApiCall(`${config.baseUrl}${endpoint}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false as const, error: `Mediascope returned ${res.status}`, provider: "MEDIASCOPE" };
    return { success: true as const, data: await res.json(), provider: "MEDIASCOPE" };
  } catch (err: any) { return { success: false as const, error: err.message, provider: "MEDIASCOPE" }; }
}

async function postRequest(endpoint: string, body: Record<string, any>) {
  const config = await getConfig();
  if (!config) return { success: false as const, error: "Mediascope is not configured. Set up in Settings → Integrations.", provider: "MEDIASCOPE" };
  try {
    const res = await makeApiCall(`${config.baseUrl}${endpoint}`, {
      method: "POST", headers: headers(config.apiKey), body: JSON.stringify(body),
    });
    if (!res.ok) return { success: false as const, error: `Mediascope returned ${res.status}`, provider: "MEDIASCOPE" };
    return { success: true as const, data: await res.json(), provider: "MEDIASCOPE" };
  } catch (err: any) { return { success: false as const, error: err.message, provider: "MEDIASCOPE" }; }
}

export async function testConnection() {
  return getRequest("/account");
}

export async function searchByImage(params: Record<string, any>) {
  return postRequest("/search/image", params);
}

export async function searchByUrl(params: Record<string, any>) {
  return postRequest("/search/url", params);
}

export async function searchLogo(params: Record<string, any>) {
  return postRequest("/search/logo", params);
}

export async function searchTrademark(params: Record<string, any>) {
  return postRequest("/search/trademark", params);
}

export async function searchProduct(params: Record<string, any>) {
  return postRequest("/search/product", params);
}

export async function getSearchResult(id: string) {
  return getRequest(`/searches/${id}`);
}

export async function getMatch(id: string) {
  return getRequest(`/matches/${id}`);
}

export async function getMatchScreenshot(id: string) {
  return getRequest(`/matches/${id}/screenshot`);
}

export async function startMonitoring(params: Record<string, any>) {
  return postRequest("/monitoring/start", params);
}

export async function stopMonitoring(id: string) {
  return postRequest(`/monitoring/${id}/stop`, {});
}

export async function getMonitoringAlerts() {
  return getRequest("/monitoring/alerts");
}

export async function acknowledgeMatchAlert(id: string) {
  return postRequest(`/monitoring/alerts/${id}/acknowledge`, {});
}

export async function generateTakedownNotice(matchId: string) {
  return postRequest(`/matches/${matchId}/takedown`, {});
}

export async function getTakedownTemplates() {
  return getRequest("/takedown/templates");
}

export async function getInfringementReport() {
  return getRequest("/reports/infringement");
}

export async function getMarketplaceAnalytics() {
  return getRequest("/analytics/marketplace");
}

export async function getStats() {
  return getRequest("/reports/stats");
}

export async function processWebhook(payload: any) {
  const searchId = payload.search_id || payload.searchId;
  const matches = payload.matches || [];

  // Find associated investigation search
  const search = searchId
    ? await db.investigationSearch.findFirst({ where: { externalSearchId: searchId, provider: "MEDIASCOPE" } })
    : null;

  const createdMatches: string[] = [];

  for (const m of matches) {
    const match = await db.visualAssetMatch.create({
      data: {
        searchId: search?.id || "",
        matterId: search?.matterId || payload.matter_id,
        matchType: (m.match_type || m.type || "IMAGE") as any,
        matchUrl: m.url || m.match_url || "",
        matchPageTitle: m.page_title,
        matchDomain: m.domain,
        matchImageUrl: m.image_url,
        originalAssetUrl: m.original_url,
        similarityScore: m.similarity_score || m.confidence || 0,
        matchDate: m.found_date ? new Date(m.found_date) : new Date(),
        platform: m.platform,
        context: m.context ? JSON.stringify(m.context) : undefined,
        sellerInfo: m.seller_info ? JSON.stringify(m.seller_info) : undefined,
        potentialInfringement: m.potential_infringement || (m.similarity_score > 0.85),
        infringementType: m.infringement_type,
        status: "NEW",
      },
    });
    createdMatches.push(match.id);
  }

  // Create monitoring alert
  const alertType = payload.alert_type || "VISUAL_ASSET_MATCH";
  const severity = payload.severity === "critical" ? "CRITICAL" : payload.severity === "warning" ? "WARNING" : "INFO";

  const alert = await db.monitoringAlert.create({
    data: {
      provider: "MEDIASCOPE",
      externalAlertId: payload.id || payload.alert_id,
      matterId: search?.matterId || payload.matter_id,
      monitoringType: alertType as any,
      subject: payload.asset_name || payload.subject || "Visual Asset",
      title: payload.title || `${matches.length} new visual match(es) found`,
      description: payload.description || `Found ${matches.length} potential match(es) for monitored visual asset.`,
      severity: severity as any,
      data: JSON.stringify(payload),
      linkedSearchId: search?.id,
      linkedVisualMatchId: createdMatches[0] || undefined,
    },
  });

  return { received: true, alertId: alert.id, matchIds: createdMatches };
}
