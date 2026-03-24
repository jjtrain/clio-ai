import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exchangeZoomCode, getZoomUserInfo } from "@/lib/meetings/zoom-oauth";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const userId = req.nextUrl.searchParams.get("state") || "demo-user";
    if (!code) return NextResponse.redirect(`${req.nextUrl.origin}/settings/meetings?error=no_code`);

    const tokens = await exchangeZoomCode(code);
    const userInfo = await getZoomUserInfo(tokens.accessToken);

    await db.videoConnection.upsert({
      where: { userId_provider: { userId, provider: "ZOOM" } },
      create: { userId, provider: "ZOOM", email: userInfo.email, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, tokenExpiry: tokens.expiresAt, providerUserId: userInfo.zoomUserId },
      update: { email: userInfo.email, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, tokenExpiry: tokens.expiresAt, providerUserId: userInfo.zoomUserId, isActive: true },
    });

    return NextResponse.redirect(`${req.nextUrl.origin}/settings/meetings?zoom=connected`);
  } catch (err: any) {
    return NextResponse.redirect(`${req.nextUrl.origin}/settings/meetings?error=${encodeURIComponent(err.message)}`);
  }
}
