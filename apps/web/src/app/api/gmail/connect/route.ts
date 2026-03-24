import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/gmail/oauth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const userId = "demo-user"; // In production, get from session
    const authUrl = getAuthUrl(userId);
    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
