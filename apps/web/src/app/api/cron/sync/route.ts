import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const integrations = await db.accountingIntegration.findMany({
      where: { isConnected: true, autoSyncEnabled: true },
    });

    const results = [];
    for (const int of integrations) {
      try {
        await db.accountingIntegration.update({
          where: { id: int.id },
          data: { syncStatus: "SYNCING" },
        });

        // In production, call full sync logic here
        await db.accountingIntegration.update({
          where: { id: int.id },
          data: { syncStatus: "IDLE", lastSyncAt: new Date(), syncError: null },
        });

        results.push({ provider: int.provider, success: true });
      } catch (e: any) {
        await db.accountingIntegration.update({
          where: { id: int.id },
          data: { syncStatus: "ERROR", syncError: e.message },
        });
        results.push({ provider: int.provider, success: false, error: e.message });
      }
    }

    return NextResponse.json({ synced: results.length, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
