import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, logApiAction } from "@/lib/api/auth-middleware";
import { fireWebhook } from "@/lib/webhooks/dispatcher";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(req, "LEADS_WRITE");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const lead = await db.lead.findUniqueOrThrow({ where: { id: params.id } });

    // Create client from lead
    let client = await db.client.findFirst({ where: { email: lead.email || undefined } });
    if (!client) {
      client = await db.client.create({ data: { name: lead.name, email: lead.email, phone: lead.phone } });
    }

    // Create matter
    const matterCount = await db.matter.count();
    const matter = await db.matter.create({
      data: {
        clientId: client.id,
        name: body.matterName || `${lead.name} - ${body.practiceArea || lead.practiceArea || "General"}`,
        matterNumber: `MAT-${String(matterCount + 1).padStart(5, "0")}`,
        practiceArea: body.practiceArea || lead.practiceArea || null,
        status: "OPEN",
        intakeSource: lead.source || "API",
      },
    });

    await db.lead.update({ where: { id: lead.id }, data: { status: "CONVERTED" } });
    await logApiAction(auth.ctx.firmId, auth.ctx.apiKeyId, "CONVERT_LEAD", "Lead", lead.id, true);
    await fireWebhook("LEAD_CONVERTED", auth.ctx.firmId, { lead, matter, client });

    return NextResponse.json({ lead, matter, client });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
