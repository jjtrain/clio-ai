import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, hasScope } from "./keys";
import { db } from "@/lib/db";

export interface ApiContext {
  firmId: string;
  apiKeyId: string;
  scopes: string[];
}

export async function authenticateRequest(
  req: NextRequest,
  requiredScope?: string,
): Promise<{ ctx: ApiContext } | { error: NextResponse }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { error: NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 }) };
  }

  const rawKey = authHeader.slice(7);
  const result = await validateApiKey(rawKey);

  if (!result?.valid) {
    return { error: NextResponse.json({ error: "Invalid or expired API key" }, { status: 401 }) };
  }

  if (requiredScope && !hasScope(result.scopes!, requiredScope)) {
    return { error: NextResponse.json({ error: `Missing required scope: ${requiredScope}` }, { status: 403 }) };
  }

  return {
    ctx: {
      firmId: result.firmId!,
      apiKeyId: result.apiKey.id,
      scopes: result.scopes!,
    },
  };
}

export async function logApiAction(
  firmId: string,
  apiKeyId: string,
  action: string,
  resourceType?: string,
  resourceId?: string,
  success: boolean = true,
  errorMsg?: string,
  payload?: any,
) {
  await db.automationLog.create({
    data: {
      firmId,
      source: "api",
      action,
      resourceType,
      resourceId,
      apiKeyId,
      success,
      errorMsg,
      payload: payload || undefined,
    },
  });
}
