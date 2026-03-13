import { NextRequest, NextResponse } from "next/server";
import { handleCallback } from "@/lib/google-calendar";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL("/settings/scheduler?google=error&message=" + encodeURIComponent(error), req.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/settings/scheduler?google=error&message=No+code+received", req.url)
    );
  }

  try {
    const tokens = await handleCallback(code);
    const tokenExpiry = new Date(Date.now() + tokens.expiresIn * 1000);

    await db.googleCalendarSync.upsert({
      where: { id: "default" },
      update: {
        isEnabled: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry,
        googleCalendarId: "primary",
      },
      create: {
        id: "default",
        isEnabled: true,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiry,
        googleCalendarId: "primary",
        syncDirection: "both",
      },
    });

    return NextResponse.redirect(
      new URL("/settings/scheduler?google=connected", req.url)
    );
  } catch (err: any) {
    console.error("[Google OAuth] Error:", err);
    return NextResponse.redirect(
      new URL(
        "/settings/scheduler?google=error&message=" + encodeURIComponent(err.message),
        req.url
      )
    );
  }
}
