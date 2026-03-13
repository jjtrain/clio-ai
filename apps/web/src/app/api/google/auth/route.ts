import { NextResponse } from "next/server";
import { getAuthUrl } from "@/lib/google-calendar";

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "Google Calendar credentials not configured" },
      { status: 500 }
    );
  }

  const url = getAuthUrl();
  return NextResponse.redirect(url);
}
