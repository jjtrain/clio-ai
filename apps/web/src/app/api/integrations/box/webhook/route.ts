import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  // Dropbox/OneDrive verification challenge
  const challenge = req.nextUrl.searchParams.get("challenge") || req.nextUrl.searchParams.get("validationToken");
  if (challenge) return new NextResponse(challenge, { headers: { "Content-Type": "text/plain" } });
  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json().catch(() => ({}));
    // Process file change notifications
    console.log("[Storage Webhook] Event received");
    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
