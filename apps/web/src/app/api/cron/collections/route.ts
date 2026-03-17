import { NextResponse } from "next/server";
import { syncFromBilling } from "@/lib/collections-engine";

export async function GET() {
  try {
    const syncResult = await syncFromBilling();
    return NextResponse.json({ success: true, sync: syncResult });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
