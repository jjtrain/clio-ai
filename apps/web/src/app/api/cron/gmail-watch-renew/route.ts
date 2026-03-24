import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renewGmailWatch } from "@/lib/gmail/watch";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const cutoff = new Date(Date.now() + 48 * 3600000); // 48 hours from now

    const connections = await db.gmailConnection.findMany({
      where: {
        syncEnabled: true,
        OR: [
          { watchExpiry: { lt: cutoff } },
          { watchExpiry: null },
        ],
      },
    });

    let renewed = 0;
    const errors: string[] = [];

    for (const conn of connections) {
      try {
        await renewGmailWatch(conn.userId);
        renewed++;
      } catch (err: any) {
        errors.push(`${conn.email}: ${err.message}`);
      }
    }

    return NextResponse.json({ ok: true, renewed, errors: errors.length > 0 ? errors : undefined });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
