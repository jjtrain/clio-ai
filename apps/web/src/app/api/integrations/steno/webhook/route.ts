import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const event = payload.event || payload.type || "";
    const jobId = payload.job_id || payload.booking_id || payload.id;

    if (event.includes("service_completed") || event.includes("served")) {
      if (jobId) {
        await db.serviceJob.updateMany({
          where: { externalJobId: jobId },
          data: { status: "SERVED", servedDate: payload.served_date ? new Date(payload.served_date) : new Date(), serverName: payload.server_name, gpsVerified: payload.gps_verified ?? false },
        });
      }
    }

    if (event.includes("attempt")) {
      if (jobId) {
        await db.serviceJob.updateMany({ where: { externalJobId: jobId }, data: { totalAttempts: { increment: 1 }, status: payload.attempt_number ? `ATTEMPT_${payload.attempt_number}` : "IN_PROGRESS" } });
      }
    }

    if (event.includes("transcript_ready") || event.includes("deposition_completed")) {
      if (jobId) {
        await db.courtReporterJob.updateMany({
          where: { externalJobId: jobId },
          data: { transcriptStatus: event.includes("transcript") ? "FINAL_READY" : "COMPLETED", status: event.includes("transcript") ? "TRANSCRIPT_READY" : "COMPLETED", transcriptUrl: payload.transcript_url, transcriptPageCount: payload.page_count },
        });
      }
    }

    if (event.includes("reporter_assigned") || event.includes("confirmed")) {
      if (jobId) {
        await db.courtReporterJob.updateMany({
          where: { externalJobId: jobId },
          data: { status: "CONFIRMED", courtReporterName: payload.reporter_name, courtReporterFirm: payload.reporter_firm },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Process/Reporter Webhook] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
