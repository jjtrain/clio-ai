import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const claimId = payload.claim_id || payload.id;
    if (!claimId) return NextResponse.json({ received: true });

    const cb = await db.collBoxAccount.findFirst({ where: { collboxClaimId: claimId } });
    if (!cb) return NextResponse.json({ received: true, matched: false });

    if (payload.event === "payment_received" && payload.amount) {
      await db.collBoxAccount.update({ where: { id: cb.id }, data: { amountRecovered: { increment: Number(payload.amount) }, lastUpdateAt: new Date() } });
      await db.collectionActivity.create({ data: { accountId: cb.collectionAccountId, activityType: "PAYMENT_RECEIVED", description: `CollBox payment: $${Number(payload.amount).toFixed(2)}`, amount: Number(payload.amount) } });
    }

    if (payload.status) {
      await db.collBoxAccount.update({ where: { id: cb.id }, data: { collboxStatus: payload.status, lastUpdateAt: new Date() } });
    }

    return NextResponse.json({ received: true, matched: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
