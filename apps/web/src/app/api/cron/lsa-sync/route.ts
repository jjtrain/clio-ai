import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as googleLsa from "@/lib/integrations/google-lsa";
import * as engine from "@/lib/lsa-engine";

export async function GET(req: NextRequest) {
  try {
    const secret = req.headers.get("authorization")?.replace("Bearer ", "");
    if (secret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // 1. Sync leads from last 24h
    const leads = await googleLsa.getLeads({ startDate: since });
    let synced = 0;
    const leadsData = (leads as any)?.data || leads || [];
    for (const lead of (Array.isArray(leadsData) ? leadsData : [])) {
      const existing = await db.lSALead.findFirst({ where: { externalLeadId: lead.externalLeadId || lead.id || "" } });
      if (!existing) {
        await engine.processNewLead(lead);
        synced++;
      }
    }

    // 2. Process unprocessed leads (no AI analysis yet)
    const unprocessed = await db.lSALead.findMany({ where: { aiQualityScore: null } });
    let processed = 0;
    for (const lead of unprocessed) {
      await engine.processNewLead(lead.id);
      processed++;
    }

    // 3. Check for unanswered message leads older than 1h
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const unanswered = await db.lSALead.findMany({
      where: {
        leadType: "MESSAGE" as any,
        messageReply: null,
        leadCreatedAt: { lte: oneHourAgo },
        status: { not: "ARCHIVED" as any },
      },
    });
    let autoReplied = 0;
    for (const lead of unanswered) {
      try {
        const suggestion = await engine.suggestAutoReply(lead.id);
        if (suggestion) {
          await googleLsa.replyToMessage(lead.id, (suggestion as any).message ?? String(suggestion));
          await db.lSALead.update({ where: { id: lead.id }, data: { messageReply: (suggestion as any).message ?? String(suggestion) } });
          autoReplied++;
        }
      } catch { /* skip individual failures */ }
    }

    // 4. Snapshot daily performance
    await engine.snapshotPerformance("daily");

    return NextResponse.json({
      synced,
      processed,
      unansweredFound: unanswered.length,
      autoReplied,
      snapshotTaken: true,
    });
  } catch (err: any) {
    console.error("[LSA Sync Cron]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
