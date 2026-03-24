import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, logApiAction } from "@/lib/api/auth-middleware";
import { fireWebhook } from "@/lib/webhooks/dispatcher";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, "CONTACTS_READ");
  if ("error" in auth) return auth.error;
  const url = req.nextUrl;
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 100);
  const search = url.searchParams.get("search");
  const where: any = {};
  if (search) where.OR = [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }];
  const [data, total] = await Promise.all([
    db.client.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
    db.client.count({ where }),
  ]);
  return NextResponse.json({ data, meta: { total, page, limit } });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, "CONTACTS_WRITE");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    if (!body.name || !body.email) return NextResponse.json({ error: "name and email are required" }, { status: 400 });
    const existing = await db.client.findFirst({ where: { email: { equals: body.email, mode: "insensitive" } } });
    if (existing) return NextResponse.json({ error: "Contact with this email exists", existingId: existing.id }, { status: 409 });
    const contact = await db.client.create({ data: { name: body.name, email: body.email, phone: body.phone || null, address: body.address || null } });
    await logApiAction(auth.ctx.firmId, auth.ctx.apiKeyId, "CREATE_CONTACT", "Contact", contact.id, true);
    await fireWebhook("CONTACT_CREATED", auth.ctx.firmId, contact);
    return NextResponse.json(contact, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
