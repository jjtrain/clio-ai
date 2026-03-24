import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncGmailHistory } from "@/lib/gmail/sync";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Decode Pub/Sub message
    const data = body.message?.data;
    if (!data) return NextResponse.json({ ok: true });

    const decoded = JSON.parse(Buffer.from(data, "base64").toString("utf-8"));
    const { emailAddress, historyId } = decoded;

    if (!emailAddress) return NextResponse.json({ ok: true });

    // Find connection by email
    const connection = await db.gmailConnection.findFirst({
      where: { email: emailAddress, syncEnabled: true },
    });

    if (!connection) return NextResponse.json({ ok: true });

    // Sync in background — return 200 immediately
    syncGmailHistory(connection.userId, historyId).catch((err) => {
      console.error(`[Gmail Webhook] Sync error for ${emailAddress}:`, err.message);
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("[Gmail Webhook] Error:", err);
    return NextResponse.json({ ok: true }); // Always return 200 to avoid retries
  }
}
