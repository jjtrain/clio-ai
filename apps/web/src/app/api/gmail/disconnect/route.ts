import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { stopGmailWatch } from "@/lib/gmail/watch";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const userId = "demo-user";

    try { await stopGmailWatch(userId); } catch { /* ignore */ }

    await db.gmailConnection.deleteMany({ where: { userId } });

    // Also disable EmailIntegration
    try {
      await db.emailIntegration.update({
        where: { provider: "GMAIL" as any },
        data: { isEnabled: false, accessToken: null, refreshToken: null },
      });
    } catch { /* may not exist */ }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
