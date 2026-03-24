import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { exchangeTeamsCode, getTeamsUserInfo } from "@/lib/meetings/teams-oauth";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");
    const userId = req.nextUrl.searchParams.get("state") || "demo-user";
    if (!code) return NextResponse.redirect(`${req.nextUrl.origin}/settings/meetings?error=no_code`);

    const tokens = await exchangeTeamsCode(code);
    const userInfo = await getTeamsUserInfo(tokens.accessToken);

    await db.videoConnection.upsert({
      where: { userId_provider: { userId, provider: "TEAMS" } },
      create: { userId, provider: "TEAMS", email: userInfo.email, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, tokenExpiry: tokens.expiresAt, tenantId: userInfo.tenantId },
      update: { email: userInfo.email, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken, tokenExpiry: tokens.expiresAt, tenantId: userInfo.tenantId, isActive: true },
    });

    return NextResponse.redirect(`${req.nextUrl.origin}/settings/meetings?teams=connected`);
  } catch (err: any) {
    return NextResponse.redirect(`${req.nextUrl.origin}/settings/meetings?error=${encodeURIComponent(err.message)}`);
  }
}
