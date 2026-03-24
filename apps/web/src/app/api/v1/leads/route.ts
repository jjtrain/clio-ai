import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, logApiAction } from "@/lib/api/auth-middleware";
import { hasScope } from "@/lib/api/keys";
import { fireWebhook } from "@/lib/webhooks/dispatcher";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req, "LEADS_READ");
  if ("error" in auth) return auth.error;

  const url = req.nextUrl;
  const page = Number(url.searchParams.get("page") || "1");
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 100);
  const status = url.searchParams.get("status");
  const practiceArea = url.searchParams.get("practiceArea");

  const where: any = {};
  if (status) where.status = status;
  if (practiceArea) where.practiceArea = practiceArea;

  const [data, total] = await Promise.all([
    db.lead.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" } }),
    db.lead.count({ where }),
  ]);

  return NextResponse.json({ data, meta: { total, page, limit } });
}

export async function POST(req: NextRequest) {
  const auth = await authenticateRequest(req, "LEADS_WRITE");
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { firstName, lastName, email, phone, practiceArea, source, sourceDetail, notes, assignedAttorneyEmail } = body;

    if (!firstName || !lastName || !email) {
      return NextResponse.json({ error: "firstName, lastName, and email are required" }, { status: 400 });
    }

    // Duplicate detection
    const existingLead = await db.lead.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (existingLead) {
      return NextResponse.json({ error: "Lead with this email already exists", existingId: existingLead.id }, { status: 409 });
    }

    const lead = await db.lead.create({
      data: {
        name: `${firstName} ${lastName}`,
        email,
        phone: phone || null,
        practiceArea: practiceArea || null,
        source: source || "API",
        notes: notes || null,
        status: "NEW",
      },
    });

    await logApiAction(auth.ctx.firmId, auth.ctx.apiKeyId, "CREATE_LEAD", "Lead", lead.id, true, undefined, { firstName, lastName, email });
    await fireWebhook("LEAD_CREATED", auth.ctx.firmId, { id: lead.id, firstName, lastName, email, phone, practiceArea, source, createdAt: lead.createdAt });

    return NextResponse.json(lead, { status: 201 });
  } catch (err: any) {
    await logApiAction(auth.ctx.firmId, auth.ctx.apiKeyId, "CREATE_LEAD", "Lead", undefined, false, err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
