import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const event = payload.event || payload.type || "";

    if (event.includes("referral_received") || event.includes("new_referral")) {
      await db.referral.create({
        data: {
          provider: payload.provider || "ATTORNEY_SHARE",
          externalReferralId: payload.referral_id || payload.id,
          direction: "INBOUND", status: "RECEIVED",
          referringAttorneyName: payload.referring_attorney?.name || payload.from_name,
          referringAttorneyEmail: payload.referring_attorney?.email || payload.from_email,
          referringFirmName: payload.referring_attorney?.firm || payload.from_firm,
          clientName: payload.client_name || payload.client?.name || "Unknown",
          clientEmail: payload.client_email || payload.client?.email,
          caseType: payload.case_type || payload.practice_area,
          caseDescription: payload.case_description || payload.description,
          jurisdiction: payload.jurisdiction,
          referralFeeType: payload.fee_type,
          referralFeePercentage: payload.fee_percentage,
          receivedAt: new Date(), lastActivityAt: new Date(),
          rawPayload: JSON.stringify(payload),
        },
      });
    }

    if (event.includes("attorney_matched") || event.includes("confirmed") || event.includes("completed")) {
      const extId = payload.request_id || payload.id;
      if (extId) {
        await db.appearanceRequest.updateMany({
          where: { externalRequestId: extId },
          data: {
            status: event.includes("completed") ? "COMPLETED" : event.includes("confirmed") ? "CONFIRMED" : "ATTORNEY_FOUND",
            assignedAttorneyName: payload.attorney?.name || payload.attorney_name,
            assignedAttorneyEmail: payload.attorney?.email,
            assignedAttorneyRating: payload.attorney?.rating,
            totalCost: payload.cost || payload.total_cost,
            reportText: payload.report,
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Referral Webhook] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
