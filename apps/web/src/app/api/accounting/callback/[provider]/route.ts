import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAccountingAdapter } from "@/lib/accounting-adapters";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { provider: string } }) {
  try {
    const provider = params.provider.toUpperCase() as any;
    const code = req.nextUrl.searchParams.get("code");
    const realmId = req.nextUrl.searchParams.get("realmId"); // QuickBooks specific
    const state = req.nextUrl.searchParams.get("state");

    if (!code) {
      return NextResponse.redirect(`${req.nextUrl.origin}/settings/accounting?error=no_code`);
    }

    // Validate state
    const savedState = req.cookies.get("accounting_oauth_state")?.value;
    if (state && savedState && state !== savedState) {
      return NextResponse.redirect(`${req.nextUrl.origin}/settings/accounting?error=invalid_state`);
    }

    const adapter = getAccountingAdapter(provider);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || req.nextUrl.origin;
    const redirectUri = `${appUrl}/api/accounting/callback/${provider}`;

    const credentials = await adapter.exchangeCode(code, redirectUri);

    // Upsert integration
    await db.accountingIntegration.upsert({
      where: { provider },
      create: {
        provider,
        isEnabled: true,
        isConnected: true,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        tokenExpiresAt: credentials.expiresAt,
        realmId: realmId || credentials.realmId || null,
        tenantId: credentials.tenantId || null,
        syncDirection: "TO_EXTERNAL",
      },
      update: {
        isEnabled: true,
        isConnected: true,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        tokenExpiresAt: credentials.expiresAt,
        realmId: realmId || credentials.realmId || undefined,
        tenantId: credentials.tenantId || undefined,
        syncStatus: "IDLE",
        syncError: null,
      },
    });

    const response = NextResponse.redirect(`${req.nextUrl.origin}/settings/accounting?connected=${provider}`);
    response.cookies.delete("accounting_oauth_state");
    return response;
  } catch (err: any) {
    console.error(`[Accounting Callback] Error:`, err);
    return NextResponse.redirect(`${req.nextUrl.origin}/settings/accounting?error=${encodeURIComponent(err.message)}`);
  }
}
