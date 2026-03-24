import { NextResponse } from "next/server";
import { getTeamsAuthUrl } from "@/lib/meetings/teams-oauth";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.redirect(getTeamsAuthUrl("demo-user"));
}
