import { db } from "@/lib/db";
import { makeApiCall } from "./provider-factory";

async function getConfig() {
  const config = await db.docToolIntegration.findUnique({ where: { provider: "GAVEL" } });
  if (!config?.isEnabled || !config?.apiKey) return null;
  return { baseUrl: config.baseUrl || "https://api.gavel.io/v1", apiKey: config.apiKey };
}
function headers(apiKey: string) { return { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }; }

export async function gavelGetTemplates(category?: string) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Gavel is not configured.", provider: "GAVEL" };
  try {
    const params = category ? `?category=${encodeURIComponent(category)}` : "";
    const res = await makeApiCall(`${config.baseUrl}/templates${params}`, { headers: headers(config.apiKey) });
    if (!res.ok) return { success: false, error: `Gavel returned ${res.status}`, provider: "GAVEL" };
    return { success: true, data: await res.json(), provider: "GAVEL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GAVEL" }; }
}

export async function gavelGenerateDocument(templateId: string, fieldValues: Record<string, any>) {
  const config = await getConfig();
  if (!config) return { success: false, error: "Gavel not configured.", provider: "GAVEL" };
  try {
    const res = await makeApiCall(`${config.baseUrl}/templates/${templateId}/generate`, { method: "POST", headers: headers(config.apiKey), body: JSON.stringify({ field_values: fieldValues }) });
    if (!res.ok) return { success: false, error: `Generation failed: ${res.status}`, provider: "GAVEL" };
    return { success: true, data: await res.json(), provider: "GAVEL" };
  } catch (err: any) { return { success: false, error: err.message, provider: "GAVEL" }; }
}
