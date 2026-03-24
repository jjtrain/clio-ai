import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, logApiAction } from "@/lib/api/auth-middleware";
import { fireWebhook } from "@/lib/webhooks/dispatcher";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(req, "CONTACTS_READ");
  if ("error" in auth) return auth.error;
  const contact = await db.client.findUnique({ where: { id: params.id } });
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  return NextResponse.json(contact);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(req, "CONTACTS_WRITE");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const contact = await db.client.update({ where: { id: params.id }, data: body });
    await logApiAction(auth.ctx.firmId, auth.ctx.apiKeyId, "UPDATE_CONTACT", "Contact", contact.id, true);
    await fireWebhook("CONTACT_UPDATED", auth.ctx.firmId, contact);
    return NextResponse.json(contact);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
