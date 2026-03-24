import { NextResponse } from "next/server";
import { retryFailedDeliveries } from "@/lib/webhooks/dispatcher";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await retryFailedDeliveries();
    return NextResponse.json({ ok: true, ...result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
