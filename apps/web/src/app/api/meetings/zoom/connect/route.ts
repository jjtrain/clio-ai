import { NextResponse } from "next/server";
import { getZoomAuthUrl } from "@/lib/meetings/zoom-oauth";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.redirect(getZoomAuthUrl("demo-user"));
}
