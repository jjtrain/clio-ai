import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api/auth-middleware";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  return NextResponse.json({ ok: true, firm: auth.ctx.firmId, plan: "pro", timestamp: new Date().toISOString() });
}
