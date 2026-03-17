import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const orderId = payload.order_id || payload.id;
    if (!orderId) return NextResponse.json({ received: true });

    const filing = await db.infoTrackFiling.findFirst({ where: { infotrackOrderId: orderId } });
    if (filing) {
      await db.infoTrackFiling.update({
        where: { id: filing.id },
        data: {
          status: payload.status || filing.status,
          confirmationNumber: payload.confirmation_number,
          filingDate: payload.filing_date ? new Date(payload.filing_date) : undefined,
          servedDate: payload.served_date ? new Date(payload.served_date) : undefined,
          rejectionReason: payload.rejection_reason,
        },
      });
    }
    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
