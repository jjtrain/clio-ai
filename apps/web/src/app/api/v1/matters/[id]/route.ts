import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authenticateRequest, logApiAction } from "@/lib/api/auth-middleware";
import { fireWebhook } from "@/lib/webhooks/dispatcher";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(req, "MATTERS_READ");
  if ("error" in auth) return auth.error;
  const matter = await db.matter.findUnique({ where: { id: params.id }, include: { client: { select: { name: true, email: true } } } });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });
  return NextResponse.json(matter);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authenticateRequest(req, "MATTERS_WRITE");
  if ("error" in auth) return auth.error;
  try {
    const body = await req.json();
    const before = await db.matter.findUniqueOrThrow({ where: { id: params.id } });
    const matter = await db.matter.update({ where: { id: params.id }, data: body });
    await logApiAction(auth.ctx.firmId, auth.ctx.apiKeyId, "UPDATE_MATTER", "Matter", matter.id, true);
    if (body.pipelineStage && body.pipelineStage !== before.pipelineStage) {
      await fireWebhook("MATTER_STAGE_CHANGED", auth.ctx.firmId, { ...matter, previousStage: before.pipelineStage });
    }
    if (body.status === "CLOSED" && before.status !== "CLOSED") {
      await fireWebhook("MATTER_CLOSED", auth.ctx.firmId, matter);
    }
    return NextResponse.json(matter);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
