import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";
import { authenticateRequest } from "@/lib/api/auth-middleware";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, "WEBHOOKS_MANAGE");
  if ("error" in auth) return auth.error;
  const subs = await db.webhookSubscription.findMany({ where: { firmId: auth.ctx.firmId }, orderBy: { createdAt: "desc" } });
  return NextResponse.json({ data: subs });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, "WEBHOOKS_MANAGE");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    if (!body.event || !body.targetUrl) return NextResponse.json({ error: "event and targetUrl required" }, { status: 400 });
    const secret = crypto.randomBytes(32).toString("hex");
    const sub = await db.webhookSubscription.create({
      data: { firmId: auth.ctx.firmId, apiKeyId: auth.ctx.apiKeyId, event: body.event, targetUrl: body.targetUrl, secret, description: body.description },
    });
    return NextResponse.json({ ...sub, secret }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
