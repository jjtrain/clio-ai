import { db } from "@/lib/db";

export async function getProviderConfig(provider: string) {
  const integration = await db.legalToolIntegration.findUnique({ where: { provider: provider as any } });
  if (!integration || !integration.isEnabled) return null;
  return integration;
}

export async function getAllEnabledProviders() {
  return db.legalToolIntegration.findMany({ where: { isEnabled: true } });
}

export function maskApiKey(key: string | null): string | null {
  if (!key) return null;
  if (key.length <= 4) return "****";
  return "****" + key.slice(-4);
}

export async function makeApiCall(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout || 15000);

  const start = Date.now();
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const elapsed = Date.now() - start;
    console.log(`[API] ${options.method || "GET"} ${url} → ${res.status} (${elapsed}ms)`);
    return res;
  } catch (err: any) {
    const elapsed = Date.now() - start;
    console.error(`[API] ${options.method || "GET"} ${url} → ERROR (${elapsed}ms): ${err.message}`);
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
