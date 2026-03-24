import { NextRequest, NextResponse } from "next/server";
import { getAccountingAdapter } from "@/lib/accounting-adapters";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  try {
    const provider = params.provider.toUpperCase();
    const adapter = getAccountingAdapter(provider);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const redirectUri = `${appUrl}/api/accounting/callback/${provider}`;
    const state = crypto.randomBytes(16).toString("hex");

    // Store state in cookie for CSRF validation
    const authUrl = adapter.getAuthUrl(redirectUri, state);

    const response = NextResponse.redirect(authUrl);
    response.cookies.set("accounting_oauth_state", state, {
      httpOnly: true,
      secure: true,
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
