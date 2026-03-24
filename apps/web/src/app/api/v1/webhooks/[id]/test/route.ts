import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest } from "@/lib/api/auth-middleware";
import { fireWebhook } from "@/lib/webhooks/dispatcher";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(req, "WEBHOOKS_MANAGE");
  if ("error" in auth) return auth.error;
  const sub = await db.webhookSubscription.findUnique({ where: { id: params.id } });
  if (!sub) return NextResponse.json({ error: "Subscription not found" }, { status: 404 });
  await fireWebhook(sub.event, auth.ctx.firmId, { test: true, timestamp: new Date().toISOString(), message: "This is a test webhook delivery from Managal" });
  const delivery = await db.webhookDelivery.findFirst({ where: { subscriptionId: sub.id }, orderBy: { deliveredAt: "desc" } });
  return NextResponse.json({ delivery });
}
