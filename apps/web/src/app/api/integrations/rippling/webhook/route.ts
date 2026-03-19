import { NextRequest, NextResponse } from "next/server";
import * as rippling from "@/lib/integrations/rippling";
import * as engine from "@/lib/hr-engine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = await rippling.processWebhook(body);

    if (body.event === "employee.terminated" && body.employeeId) {
      await engine.handleOffboarding(body.employeeId, new Date());
    }

    if (body.event === "time_off.approved" && body.requestId) {
      await engine.handleTimeOffApproval(body.requestId);
    }

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("[Rippling Webhook] Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
