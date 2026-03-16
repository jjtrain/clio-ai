import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exchangeXeroCode } from "@/lib/xero";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const baseUrl = process.env.NEXTAUTH_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  if (!code) return NextResponse.redirect(`${baseUrl}/integrations?error=no_code`);

  try {
    const redirectUri = `${baseUrl}/api/xero/callback`;
    const result = await exchangeXeroCode(code, redirectUri);

    await db.accountingIntegration.upsert({
      where: { provider: "XERO" },
      create: {
        provider: "XERO",
        isEnabled: true,
        isConnected: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
        tenantId: result.tenantId,
        companyName: "Xero Organization",
      },
      update: {
        isConnected: true,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        tokenExpiresAt: new Date(Date.now() + result.expiresIn * 1000),
        tenantId: result.tenantId,
      },
    });

    return NextResponse.redirect(`${baseUrl}/integrations?connected=xero`);
  } catch (err: any) {
    console.error("[Xero Callback] Error:", err.message);
    return NextResponse.redirect(`${baseUrl}/integrations?error=${encodeURIComponent(err.message)}`);
  }
}
