import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, logApiAction } from "@/lib/api/auth-middleware";
import { fireWebhook } from "@/lib/webhooks/dispatcher";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(req, "LEADS_READ");
  if ("error" in auth) return auth.error;
  const lead = await db.lead.findUnique({ where: { id: params.id } });
  if (!lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(req, "LEADS_WRITE");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const lead = await db.lead.update({ where: { id: params.id }, data: body });
    await logApiAction(auth.ctx.firmId, auth.ctx.apiKeyId, "UPDATE_LEAD", "Lead", lead.id, true);
    await fireWebhook("LEAD_UPDATED", auth.ctx.firmId, lead);
    return NextResponse.json(lead);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
