import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const event = payload.event || payload.type || "";
    const extId = payload.request_id || payload.demand_id || payload.id;

    if (event.includes("received") || event.includes("complete")) {
      if (extId) {
        await db.medicalRecordRequest.updateMany({
          where: { externalRequestId: extId },
          data: { status: "RECEIVED", receivedDate: new Date(), pageCount: payload.page_count },
        });
      }
    }

    if (event.includes("acknowledged")) {
      if (extId) {
        await db.medicalRecordRequest.updateMany({
          where: { externalRequestId: extId },
          data: { status: "ACKNOWLEDGED", acknowledgedDate: new Date() },
        });
      }
    }

    if (event.includes("rejected")) {
      if (extId) {
        await db.medicalRecordRequest.updateMany({
          where: { externalRequestId: extId },
          data: { status: "REJECTED", rejectionReason: payload.reason },
        });
      }
    }

    if (event.includes("demand_generated") || event.includes("demand_delivered")) {
      if (extId) {
        await db.demandPackage.updateMany({
          where: { externalDemandId: extId },
          data: { status: event.includes("delivered") ? "SENT" : "REVIEW", sentDate: event.includes("delivered") ? new Date() : undefined },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[PI Medical Webhook] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
