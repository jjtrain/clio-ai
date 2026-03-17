import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const sherpaId = payload.invoice_id || payload.id;
    if (!sherpaId) return NextResponse.json({ received: true });

    const sa = await db.invoiceSherpaAccount.findFirst({ where: { sherpaInvoiceId: sherpaId } });
    if (!sa) return NextResponse.json({ received: true, matched: false });

    if (payload.event === "reminder_sent") {
      await db.invoiceSherpaAccount.update({ where: { id: sa.id }, data: { remindersSent: { increment: 1 }, lastReminderDate: new Date() } });
    }
    if (payload.event === "invoice_viewed") {
      await db.invoiceSherpaAccount.update({ where: { id: sa.id }, data: { emailOpens: { increment: 1 } } });
    }

    return NextResponse.json({ received: true, matched: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
