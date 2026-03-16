import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { syncAllData } from "@/lib/integrations/ourfamilywizard";

export async function GET() {
  try {
    const settings = await db.oFWSettings.findUnique({ where: { id: "default" } });
    if (!settings?.isEnabled || !settings?.autoSyncEnabled) {
      return NextResponse.json({ skipped: true, reason: "OFW auto-sync not enabled" });
    }

    const connections = await db.oFWConnection.findMany({ where: { connectionStatus: "ACTIVE" } });
    const results = [];

    for (const conn of connections) {
      try {
        const summary = await syncAllData(conn.id);
        results.push({ connectionId: conn.id, ...summary, success: true });
      } catch (err: any) {
        results.push({ connectionId: conn.id, success: false, error: err.message });
      }
    }

    await db.oFWSettings.update({ where: { id: "default" }, data: { lastSyncAt: new Date(), lastSyncStatus: "SUCCESS" } });
    return NextResponse.json({ synced: results.length, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
