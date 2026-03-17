import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const caseNumber = payload.case_number || payload.docket;
    if (!caseNumber) return NextResponse.json({ received: true });

    const courtCase = await db.courtCase.findFirst({ where: { caseNumber } });
    if (courtCase) {
      await db.docketAlert.create({
        data: {
          provider: "DOCKETBIRD",
          matterId: courtCase.matterId,
          alertType: (payload.type || "NEW_FILING").toUpperCase() as any,
          title: payload.title || payload.description || "New docket entry",
          description: payload.description,
          courtName: payload.court,
          caseNumber,
          rawPayload: JSON.stringify(payload),
        },
      });
    }
    return NextResponse.json({ received: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
