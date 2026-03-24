import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exchangeCodeForTokens, getUserEmail } from "@/lib/gmail/oauth";
import { setupGmailWatch } from "@/lib/gmail/watch";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const userId = req.nextUrl.searchParams.get("state") || "demo-user";

    if (!code) {
      return NextResponse.redirect(`${req.nextUrl.origin}/settings/email?error=no_code`);
    }

    const tokens = await exchangeCodeForTokens(code);
    const email = await getUserEmail(tokens.accessToken);

    // Save connection
    await db.gmailConnection.upsert({
      where: { userId },
      create: {
        userId,
        email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.expiry,
      },
      update: {
        email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry: tokens.expiry,
      },
    });

    // Also update EmailIntegration for the existing email system
    await db.emailIntegration.upsert({
      where: { provider: "GMAIL" as any },
      create: {
        provider: "GMAIL" as any,
        displayName: "Gmail",
        isEnabled: true,
        emailAddress: email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiry,
      },
      update: {
        isEnabled: true,
        emailAddress: email,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiry,
      },
    });

    // Set up Gmail push watch
    try {
      await setupGmailWatch(userId);
    } catch {
      // Non-fatal — push notifications optional
    }

    return NextResponse.redirect(`${req.nextUrl.origin}/settings/email?connected=true`);
  } catch (err: any) {
    console.error("[Gmail Callback] Error:", err);
    return NextResponse.redirect(`${req.nextUrl.origin}/settings/email?error=${encodeURIComponent(err.message)}`);
  }
}
