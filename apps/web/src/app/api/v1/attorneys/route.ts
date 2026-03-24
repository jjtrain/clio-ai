import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest } from "@/lib/api/auth-middleware";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await authenticateRequest(req);
  if ("error" in auth) return auth.error;
  const users = await db.user.findMany({ select: { id: true, name: true, email: true } });
  return NextResponse.json({ data: users });
}
