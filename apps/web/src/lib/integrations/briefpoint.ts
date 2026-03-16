import type { DiscoveryRequest, DiscoveryResponse, ServiceResult } from "./types";
import { getProviderConfig, makeApiCall } from "./provider-factory";

const DEFAULT_BASE = "https://api.briefpoint.ai/v1";

async function getConfig() {
  const config = await getProviderConfig("BRIEFPOINT");
  if (!config?.apiKey) return null;
  return { baseUrl: config.baseUrl || DEFAULT_BASE, apiKey: config.apiKey };
}

function headers(apiKey: string) {
  return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
}

export async function briefpointGenerateResponse(request: DiscoveryRequest): Promise<ServiceResult<DiscoveryResponse>> {
  const config = await getConfig();
  if (!config) return { success: false, error: "Briefpoint is not configured. Set up in Settings → Integrations.", provider: "BRIEFPOINT" };

  try {
    const res = await makeApiCall(`${config.baseUrl}/discovery/respond`, {
      method: "POST", headers: headers(config.apiKey),
      body: JSON.stringify({ document_text: request.documentText, request_type: request.requestType, response_strategy: request.responseStrategy }),
    });
    if (!res.ok) return { success: false, error: `Briefpoint returned ${res.status}`, provider: "BRIEFPOINT" };
    const data = await res.json();
    return {
      success: true,
      data: {
        responses: (data.responses || []).map((r: any, i: number) => ({
          requestNumber: r.request_number || i + 1,
          requestText: r.request_text || r.question || "",
          response: r.response || r.answer || "",
          objections: r.objections || [],
        })),
        provider: "BRIEFPOINT",
      },
      provider: "BRIEFPOINT",
    };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "BRIEFPOINT" };
  }
}

export async function briefpointAnalyze(documentText: string): Promise<ServiceResult<any>> {
  const config = await getConfig();
  if (!config) return { success: false, error: "Briefpoint is not configured.", provider: "BRIEFPOINT" };

  try {
    const res = await makeApiCall(`${config.baseUrl}/discovery/analyze`, {
      method: "POST", headers: headers(config.apiKey),
      body: JSON.stringify({ document_text: documentText }),
    });
    if (!res.ok) return { success: false, error: `Analysis failed: ${res.status}`, provider: "BRIEFPOINT" };
    return { success: true, data: await res.json(), provider: "BRIEFPOINT" };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "BRIEFPOINT" };
  }
}

export async function briefpointGetObjections(requestType: string, jurisdiction: string): Promise<ServiceResult<string[]>> {
  const config = await getConfig();
  if (!config) return { success: false, error: "Briefpoint is not configured.", provider: "BRIEFPOINT" };

  try {
    const res = await makeApiCall(`${config.baseUrl}/objections?type=${requestType}&jurisdiction=${encodeURIComponent(jurisdiction)}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Failed: ${res.status}`, provider: "BRIEFPOINT" };
    const data = await res.json();
    return { success: true, data: data.objections || data || [], provider: "BRIEFPOINT" };
  } catch (err: any) {
    return { success: false, error: err.message, provider: "BRIEFPOINT" };
  }
}
