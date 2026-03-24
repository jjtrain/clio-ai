import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest } from "@/lib/api/auth-middleware";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(req, "WEBHOOKS_MANAGE");
  if ("error" in auth) return auth.error;
  const deliveries = await db.webhookDelivery.findMany({ where: { subscriptionId: params.id }, orderBy: { deliveredAt: "desc" }, take: 50 });
  return NextResponse.json({ data: deliveries });
}
