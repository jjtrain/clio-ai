import { NextResponse } from "next/server";
import { DeadlineEngine } from "@/lib/docketing/deadline-engine";

export async function GET() {
  try {
    const engine = new DeadlineEngine();
    const result = await engine.recalculatePriorities();
    return NextResponse.json({ success: true, updated: result.updated });
  } catch (err: any) {
    console.error("[Recalculate Priorities] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
