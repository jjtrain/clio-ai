import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exchangeQBCode } from "@/lib/quickbooks";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const realmId = req.nextUrl.searchParams.get("realmId");
  const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  if (!code) return NextResponse.redirect(`${baseUrl}/integrations?error=no_code`);

  try {
    const redirectUri = `${baseUrl}/api/quickbooks/callback`;
    const result = await exchangeQBCode(code, realmId || "", redirectUri);

    await db.accountingIntegration.upsert({
      where: { provider: "QUICKBOOKS" },
      create: {
        provider: "QUICKBOOKS",
        isEnabled: true,
        isConnected: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
        realmId: realmId || undefined,
        companyName: "QuickBooks Company",
      },
      update: {
        isConnected: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
        realmId: realmId || undefined,
      },
    });

    return NextResponse.redirect(`${baseUrl}/integrations?connected=quickbooks`);
  } catch (err: any) {
    console.error("[QB Callback] Error:", err.message);
    return NextResponse.redirect(`${baseUrl}/integrations?error=${encodeURIComponent(err.message)}`);
  }
}
