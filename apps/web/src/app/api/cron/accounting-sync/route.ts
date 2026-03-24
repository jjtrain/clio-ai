import { NextResponse } from "next/server";
import { syncAllPending, pullPaymentUpdates } from "@/lib/accounting-sync-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const firmId = "demo-firm";

    const pushResult = await syncAllPending(firmId);
    const pullResult = await pullPaymentUpdates(firmId);

    return NextResponse.json({
      ok: true,
      push: { invoices: pushResult.invoices, payments: pushResult.payments },
      pull: { updated: pullResult.updated },
      errors: [...pushResult.errors, ...pullResult.errors].length > 0
        ? [...pushResult.errors, ...pullResult.errors]
        : undefined,
    });
  } catch (error: any) {
    console.error("[Accounting Sync Cron] Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
