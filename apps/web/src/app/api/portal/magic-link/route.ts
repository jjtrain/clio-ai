import { NextRequest, NextResponse } from "next/server";
import { generateMagicLink, verifyMagicLink } from "@/lib/portal/magic-link";

export const dynamic = "force-dynamic";

// POST: send magic link email
export async function POST(req: NextRequest) {
  try {
    const { email, firmName } = await req.json();
    if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });
    const result = await generateMagicLink(email, firmName);
    if (!result.sent) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ sent: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// GET: verify magic link token
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token");
    if (!token) return NextResponse.json({ error: "Token required" }, { status: 400 });
    const result = await verifyMagicLink(token);
    if (!result.valid) return NextResponse.json({ error: result.error }, { status: 401 });
    return NextResponse.json({ valid: true, userId: result.userId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
