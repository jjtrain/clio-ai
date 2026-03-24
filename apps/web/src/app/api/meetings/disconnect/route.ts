import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { provider } = await req.json();
    const userId = "demo-user";
    await db.videoConnection.deleteMany({ where: { userId, provider } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
