import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Sync reviews, campaigns, etc. from enabled providers
    const integrations = await db.marketingIntegration.findMany({ where: { isEnabled: true } });
    return NextResponse.json({ success: true, providers: integrations.map((i) => i.provider) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
