import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchToMatter, applyRoundingRule } from "@/lib/time-tracking-engine";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const provider = payload.provider || "UNKNOWN";
    const entry = payload.timeslip || payload.time_entry || payload;

    if (entry.id || entry.entry_id || entry.timeslip_id) {
      const extId = entry.id || entry.entry_id || entry.timeslip_id;
      const duration = entry.duration || entry.duration_seconds || 0;
      const hours = Math.round((duration / 3600) * 100) / 100;

      const match = await matchToMatter({
        description: entry.description || entry.notes,
        documentName: entry.document_name || entry.document,
        emailSubject: entry.email_subject,
        application: entry.application || entry.app,
      });

      await db.externalTimeEntry.upsert({
        where: { provider_externalEntryId: { provider, externalEntryId: extId } },
        create: {
          provider, externalEntryId: extId,
          date: new Date(entry.date || entry.start_time || new Date()),
          startTime: entry.start_time ? new Date(entry.start_time) : undefined,
          endTime: entry.end_time ? new Date(entry.end_time) : undefined,
          duration, durationHours: hours,
          description: entry.description || entry.notes,
          application: entry.application || entry.app,
          documentName: entry.document_name || entry.document,
          emailSubject: entry.email_subject,
          source: entry.source || "AUTOMATIC",
          matterId: match.matterId,
          clientId: match.clientId,
          matterMatchConfidence: match.confidence,
          matterMatchMethod: match.method,
          rawPayload: JSON.stringify(payload),
        },
        update: { duration, durationHours: hours },
      });
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Time Webhook] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
