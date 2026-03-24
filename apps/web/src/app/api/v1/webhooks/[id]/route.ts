import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest } from "@/lib/api/auth-middleware";
export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(req, "WEBHOOKS_MANAGE");
  if ("error" in auth) return auth.error;
  await db.webhookSubscription.delete({ where: { id: params.id } });
  return NextResponse.json({ deleted: true });
}
