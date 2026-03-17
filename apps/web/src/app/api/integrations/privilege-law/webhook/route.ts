import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchCallerToClient } from "@/lib/communications-engine";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const phone = payload.caller_phone || payload.phone || payload.from_number || "";
    const match = phone ? await matchCallerToClient(phone) : null;

    if (payload.type?.includes("call") || payload.event?.includes("call")) {
      await db.callRecord.create({
        data: {
          provider: payload.provider || "UNKNOWN",
          externalCallId: payload.call_id || payload.id,
          clientId: match?.type === "client" ? match.id : undefined,
          leadId: match?.type === "lead" ? match.id : undefined,
          direction: payload.direction || "INBOUND",
          callerName: payload.caller_name || payload.name,
          callerPhone: phone,
          callerEmail: payload.email,
          status: payload.status || "ANSWERED",
          disposition: payload.disposition,
          duration: payload.duration,
          startedAt: payload.started_at ? new Date(payload.started_at) : new Date(),
          summary: payload.summary || payload.notes,
          isUrgent: payload.is_urgent ?? false,
          actionRequired: payload.action_required ?? false,
          rawPayload: JSON.stringify(payload),
        },
      });
    }

    if (payload.type?.includes("chat") || payload.event?.includes("message")) {
      const conv = payload.conversation_id ? await db.chatConversation.findFirst({ where: { externalChatId: payload.conversation_id } }) : null;
      if (conv) {
        await db.chatMsg.create({ data: { conversationId: conv.id, sender: payload.sender || "VISITOR", content: payload.message || payload.content || "", timestamp: new Date() } });
        await db.chatConversation.update({ where: { id: conv.id }, data: { messageCount: { increment: 1 } } });
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("[Webhook] Error:", err.message);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
