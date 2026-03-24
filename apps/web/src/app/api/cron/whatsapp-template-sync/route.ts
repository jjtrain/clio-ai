import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncTemplates } from "@/lib/whatsapp/template-sync";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const connections = await db.whatsAppConnection.findMany({ where: { isActive: true } });
    let total = 0;
    for (const conn of connections) {
      try { const r = await syncTemplates(conn.firmId); total += r.synced; } catch {}
    }
    return NextResponse.json({ ok: true, synced: total });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
