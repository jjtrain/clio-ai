import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { processWebhook } from "@/lib/integrations/vera";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const alert = await processWebhook(payload);

    const courtCase = alert.caseNumber ? await db.courtCase.findFirst({ where: { caseNumber: alert.caseNumber } }) : null;
    const matterId = courtCase?.matterId;
    if (!matterId) return NextResponse.json({ received: true, matched: false });

    await db.docketAlert.create({
      data: {
        provider: "VERA",
        matterId,
        externalCaseId: alert.externalId,
        alertType: alert.alertType as any,
        title: alert.title,
        description: alert.description,
        courtName: alert.courtName,
        caseNumber: alert.caseNumber,
        dueDate: alert.dueDate,
        rawPayload: JSON.stringify(alert.rawData),
      },
    });

    return NextResponse.json({ received: true, matched: true });
  } catch (err: any) {
    console.error("[VERA Webhook] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
