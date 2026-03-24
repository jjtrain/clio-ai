import { NextRequest, NextResponse } from "next/server";

// Public API route for one-click survey responses from emails
// GET /api/portal/pulse/respond?token=xxx&score=5
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const score = request.nextUrl.searchParams.get("score");

  if (!token || !score) {
    return NextResponse.redirect(new URL("/portal", request.url));
  }

  // Redirect to the pulse response page with pre-filled score
  return NextResponse.redirect(
    new URL(`/pulse/respond?token=${token}&score=${score}`, request.url)
  );
}
