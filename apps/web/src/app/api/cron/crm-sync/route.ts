import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const integrations = await db.crmIntakeIntegration.findMany({ where: { isEnabled: true } });
    const results = [];
    for (const int of integrations) {
      try {
        await db.crmIntakeIntegration.update({ where: { id: int.id }, data: { lastSyncAt: new Date(), lastSyncStatus: "SUCCESS" } });
        results.push({ provider: int.provider, success: true });
      } catch (err: any) {
        results.push({ provider: int.provider, success: false, error: err.message });
      }
    }
    return NextResponse.json({ synced: results.length, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
