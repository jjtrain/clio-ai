import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = body.type || body.event;
    const chargeId = body.charge_id || body.data?.charge_id;

    if (!chargeId) return NextResponse.json({ received: true });

    const app = await db.financingApplication.findFirst({
      where: { affirmChargeId: chargeId },
    });

    if (!app) return NextResponse.json({ received: true, matched: false });

    switch (eventType) {
      case "charge.captured":
        await db.financingApplication.update({
          where: { id: app.id },
          data: { status: "COMPLETED", completedAt: new Date() },
        });
        break;
      case "charge.voided":
        await db.financingApplication.update({
          where: { id: app.id },
          data: { status: "CANCELLED" },
        });
        break;
      case "charge.refunded":
        await db.financingApplication.update({
          where: { id: app.id },
          data: { status: "CANCELLED" },
        });
        break;
      case "loan.defaulted":
        await db.financingApplication.update({
          where: { id: app.id },
          data: { metadata: JSON.stringify({ ...JSON.parse(app.metadata || "{}"), defaulted: true }) },
        });
        break;
    }

    return NextResponse.json({ received: true, matched: true });
  } catch (err: any) {
    console.error("[Affirm Webhook] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
